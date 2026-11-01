import { indexedVaultStorage } from '@/lib/client/vault-adapter';
import { decryptVault, type VaultProfileV1 } from '@/lib/shared/vault';
import { emptyClaim, recomputeClaims } from '@/lib/shared/vault/claims';
import { contentHash, createKeyEnvelope, openKeyEnvelope, randomId, rewrapKeyEnvelope } from '@/lib/shared/vault/crypto';
import {
  CLAIM_FIELDS, VAULT_SCHEMA_VERSION, parseApplication, parseClaim, parseConsent, parseDocument, parseObservation, parseProfileV2,
  type Application, type Claim, type ClaimField, type ClaimSource, type ConsentRecord, type Observation, type ProcessingState,
  type Rotation, type VaultDocument, type VaultProfileV2,
} from '@/lib/shared/vault/model';
import { allRecords, commit, getRecord, openBytes, openRecord, recordsFor, sealBytes, sealRecord, transact, type RecordStore, type StoredCell, type WriteOperation } from './store';

/**
 * The unlocked Vault.
 *
 * The passphrase is used to unwrap the data key and is then dropped; it is never
 * stored, and device biometrics do not unlock this. `epoch` rises on every lock,
 * delete and reset, and every write re-checks it, so a slow job started before a
 * lock cannot land afterwards.
 */
const PROFILE_ID = 'profile';
const KEY_ID = 'key';
const APPLICATION_ID = 'application';
const DISMISSAL_ID = 'readiness-dismissal';

type MetaCell = { id: string; envelope?: unknown; schema_version?: number };

export type VaultStatus = 'none' | 'v1_only' | 'ready';
export type ImportOutcome = { document: VaultDocument; duplicate_of?: VaultDocument };

export class VaultV2 {
  private key: CryptoKey | undefined;
  private epochValue = 0;

  get unlocked(): boolean { return this.key !== undefined; }
  get epoch(): number { return this.epochValue; }

  private requireKey(): CryptoKey {
    if (!this.key) throw new Error('vault_locked');
    return this.key;
  }

  private guard(epoch: number): void {
    if (epoch !== this.epochValue || !this.key) throw new Error('vault_locked');
  }

  lock(): void { this.epochValue += 1; this.key = undefined; }

  static async status(): Promise<VaultStatus> {
    const meta = await transact(['meta'], 'readonly', tx => getRecord(tx, 'meta', KEY_ID)).catch(() => undefined) as MetaCell | undefined;
    if (meta?.envelope) return 'ready';
    return (await indexedVaultStorage.read()) === undefined ? 'none' : 'v1_only';
  }

  /** Creates a new Vault: one wrapped data key, a v2 profile and the claims it seeds. */
  async create(profile: Omit<VaultProfileV2, 'version'>, secret: string, now = new Date()): Promise<void> {
    const existing = await VaultV2.status();
    if (existing === 'ready') throw new Error('vault_exists');
    const { envelope, key } = await createKeyEnvelope(secret, now);
    const parsed = parseProfileV2({ ...profile, version: 2 });
    const claims = seedClaims(parsed, now);
    const epoch = this.epochValue;
    await commit([
      { store: 'meta', action: 'put', cell: { id: KEY_ID, envelope, schema_version: VAULT_SCHEMA_VERSION } as unknown as StoredCell },
      { store: 'profile', action: 'put', cell: await sealRecord(key, 'profile', PROFILE_ID, parsed) },
      ...await sealClaims(key, claims),
    ]);
    this.guardAfterWrite(epoch);
    this.key = key;
  }

  private guardAfterWrite(epoch: number): void {
    if (epoch !== this.epochValue) throw new Error('vault_locked');
  }

  /**
   * Unlocks, migrating a v1 profile on first use. The v1 record is left in place
   * until the v2 write has committed, so a failure part-way leaves the old Vault
   * openable rather than destroying it.
   */
  async unlock(secret: string, now = new Date()): Promise<void> {
    const epoch = this.epochValue;
    const meta = await transact(['meta'], 'readonly', tx => getRecord(tx, 'meta', KEY_ID)) as MetaCell | undefined;
    if (meta?.envelope) {
      if (meta.schema_version !== undefined && meta.schema_version > VAULT_SCHEMA_VERSION) throw new Error('unsupported_version');
      const key = await openKeyEnvelope(meta.envelope, secret);
      this.guardAfterWrite(epoch);
      this.key = key;
      return;
    }
    const legacy = await indexedVaultStorage.read();
    if (legacy === undefined) throw new Error('vault_missing');
    const profile = await decryptVault(legacy, secret);
    const { envelope, key } = await createKeyEnvelope(secret, now);
    const migrated = migrateProfile(profile, now);
    const claims = seedClaims(migrated, now);
    await commit([
      { store: 'meta', action: 'put', cell: { id: KEY_ID, envelope, schema_version: VAULT_SCHEMA_VERSION } as unknown as StoredCell },
      { store: 'profile', action: 'put', cell: await sealRecord(key, 'profile', PROFILE_ID, migrated) },
      ...await sealClaims(key, claims),
    ]);
    this.guardAfterWrite(epoch);
    this.key = key;
  }

  async changePassphrase(currentSecret: string, nextSecret: string, now = new Date()): Promise<void> {
    const meta = await transact(['meta'], 'readonly', tx => getRecord(tx, 'meta', KEY_ID)) as MetaCell | undefined;
    if (!meta?.envelope) throw new Error('vault_missing');
    const envelope = await rewrapKeyEnvelope(meta.envelope, currentSecret, nextSecret, now);
    await commit([{ store: 'meta', action: 'put', cell: { id: KEY_ID, envelope, schema_version: VAULT_SCHEMA_VERSION } as unknown as StoredCell }]);
  }

  // --- profile and claims ---------------------------------------------------

  async readProfile(): Promise<VaultProfileV2> {
    const key = this.requireKey();
    const cell = await transact(['profile'], 'readonly', tx => getRecord(tx, 'profile', PROFILE_ID));
    if (!cell) throw new Error('vault_missing');
    return parseProfileV2(await openRecord(key, 'profile', cell));
  }

  async listClaims(): Promise<Claim[]> {
    const key = this.requireKey();
    const cells = await transact(['claims'], 'readonly', tx => allRecords(tx, 'claims'));
    return Promise.all(cells.map(async cell => parseClaim(await openRecord(key, 'claims', cell))));
  }

  /**
   * The one write path for an identity value. It updates the self-entered profile
   * and the claim together, then recomputes which evidence still agrees, so the two
   * can never drift apart.
   */
  async setClaimValue(field: ClaimField, value: string, source: ClaimSource, now = new Date()): Promise<void> {
    const key = this.requireKey();
    const epoch = this.epochValue;
    const trimmed = value.trim();
    if (!trimmed) throw new Error('invalid_value');
    const cells = await transact(['profile', 'claims', 'observations'], 'readonly', async tx => ({
      profile: await getRecord(tx, 'profile', PROFILE_ID),
      claim: await getRecord(tx, 'claims', field),
      observations: await allRecords(tx, 'observations'),
    }));
    if (!cells.profile) throw new Error('vault_missing');
    const profile = parseProfileV2(await openRecord(key, 'profile', cells.profile));
    const entry = { value: trimmed, provenance: 'self_entered' as const, updated_at: now.toISOString() };
    const nextProfile = parseProfileV2({
      ...profile,
      ...(field === 'legal_name' ? { legal_name: entry } : {}),
      ...(field === 'address' ? { delivery_address: entry } : {}),
      ...(field === 'email' ? { email: entry } : {}),
      ...(field === 'date_of_birth' ? { date_of_birth: entry } : {}),
    });
    const observations = await openObservations(key, cells.observations);
    const previous = cells.claim ? parseClaim(await openRecord(key, 'claims', cells.claim)) : emptyClaim(field, null, source, now);
    const updated = recomputeClaims([{ ...previous, value: trimmed, source, updated_at: now.toISOString() }], observations)[0];
    this.guard(epoch);
    await commit([
      { store: 'profile', action: 'put', cell: await sealRecord(key, 'profile', PROFILE_ID, nextProfile) },
      { store: 'claims', action: 'put', cell: await sealRecord(key, 'claims', field, updated) },
    ]);
    this.guard(epoch);
  }

  async saveDesignations(designations: string[], now = new Date()): Promise<void> {
    const key = this.requireKey();
    const epoch = this.epochValue;
    const cell = await transact(['profile'], 'readonly', tx => getRecord(tx, 'profile', PROFILE_ID));
    if (!cell) throw new Error('vault_missing');
    const profile = parseProfileV2(await openRecord(key, 'profile', cell));
    const next = parseProfileV2({ ...profile, designations: designations.map(value => ({ value: value.trim(), provenance: 'self_entered' as const, updated_at: now.toISOString() })) });
    this.guard(epoch);
    await commit([{ store: 'profile', action: 'put', cell: await sealRecord(key, 'profile', PROFILE_ID, next) }]);
    this.guard(epoch);
  }

  // --- documents ------------------------------------------------------------

  async listDocuments(): Promise<VaultDocument[]> {
    const key = this.requireKey();
    const cells = await transact(['documents'], 'readonly', tx => allRecords(tx, 'documents'));
    const documents = await Promise.all(cells.map(async cell => parseDocument(await openRecord(key, 'documents', cell))));
    return documents.sort((a, b) => b.imported_at.localeCompare(a.imported_at));
  }

  async listObservations(documentId?: string): Promise<Observation[]> {
    const key = this.requireKey();
    const cells = await transact(['observations'], 'readonly', tx => (documentId ? recordsFor(tx, 'observations', documentId) : allRecords(tx, 'observations')));
    return Promise.all(cells.map(async cell => parseObservation(await openRecord(key, 'observations', cell))));
  }

  /**
   * Stores the file itself. Analysis is a separate, separately consented step, so a
   * document can be kept without ever being read.
   */
  async addDocument(input: { bytes: Uint8Array; filename: string; media_type: string; processing?: ProcessingState }, now = new Date()): Promise<ImportOutcome> {
    const key = this.requireKey();
    const epoch = this.epochValue;
    const hash = await contentHash(input.bytes);
    const existing = await this.listDocuments();
    const duplicate = existing.find(document => document.content_hash === hash);
    const document: VaultDocument = parseDocument({
      id: randomId(),
      filename: input.filename.slice(0, 260) || 'document',
      media_type: input.media_type || 'application/octet-stream',
      byte_length: input.bytes.byteLength,
      content_hash: hash,
      imported_at: now.toISOString(),
      classification: null,
      page_count: null,
      rotation: 0,
      processing: input.processing ?? 'stored',
      // Identical bytes are grouped with the original, so a re-import cannot look like fresh evidence.
      ...(duplicate ? { group_id: duplicate.group_id ?? duplicate.id } : {}),
    });
    await commit([
      { store: 'documents', action: 'put', cell: await sealRecord(key, 'documents', document.id, document) },
      { store: 'blobs', action: 'put', cell: await sealBytes(key, 'blobs', document.id, input.bytes, { document_id: document.id }) },
    ]);
    this.guard(epoch);
    return { document, ...(duplicate ? { duplicate_of: duplicate } : {}) };
  }

  async readDocumentBytes(id: string): Promise<Uint8Array> {
    const key = this.requireKey();
    const cell = await transact(['blobs'], 'readonly', tx => getRecord(tx, 'blobs', id));
    if (!cell) throw new Error('document_missing');
    return openBytes(key, 'blobs', cell);
  }

  async readThumbnail(id: string): Promise<Uint8Array | undefined> {
    const key = this.requireKey();
    const cell = await transact(['thumbnails'], 'readonly', tx => getRecord(tx, 'thumbnails', id));
    return cell ? openBytes(key, 'thumbnails', cell) : undefined;
  }

  async updateDocument(id: string, patch: Partial<Pick<VaultDocument, 'label' | 'processing' | 'failure_reason' | 'rotation' | 'group_id'>>): Promise<VaultDocument> {
    const key = this.requireKey();
    const epoch = this.epochValue;
    const cell = await transact(['documents'], 'readonly', tx => getRecord(tx, 'documents', id));
    if (!cell) throw new Error('document_missing');
    const document = parseDocument(await openRecord(key, 'documents', cell));
    const next = parseDocument({ ...document, ...patch });
    this.guard(epoch);
    await commit([{ store: 'documents', action: 'put', cell: await sealRecord(key, 'documents', id, next) }]);
    this.guard(epoch);
    return next;
  }

  /**
   * Writes one analysis run: the document's new state, its proposals, its
   * thumbnail and the recomputed claims, in a single transaction. `generation`
   * rejects a result produced before a lock, reset or re-import.
   */
  async saveAnalysis(input: {
    document_id: string;
    generation: number;
    classification: VaultDocument['classification'];
    page_count: number | null;
    rotation: Rotation;
    analysis: NonNullable<VaultDocument['analysis']>;
    observations: Omit<Observation, 'id' | 'document_id' | 'created_at' | 'review'>[];
    extracted_text: string;
    thumbnail?: Uint8Array;
  }, now = new Date()): Promise<{ document: VaultDocument; observations: Observation[] }> {
    const key = this.requireKey();
    const epoch = this.epochValue;
    if (input.generation !== this.epochValue) throw new Error('vault_locked');
    const cells = await transact(['documents', 'observations', 'claims'], 'readonly', async tx => ({
      document: await getRecord(tx, 'documents', input.document_id),
      stale: await recordsFor(tx, 'observations', input.document_id),
      observations: await allRecords(tx, 'observations'),
      claims: await allRecords(tx, 'claims'),
    }));
    if (!cells.document) throw new Error('document_missing');
    const document = parseDocument(await openRecord(key, 'documents', cells.document));
    const next = parseDocument({ ...document, classification: input.classification, page_count: input.page_count, rotation: input.rotation, processing: 'analysed', analysis: input.analysis });

    const observations: Observation[] = input.observations.map(candidate => parseObservation({
      ...candidate,
      id: randomId(),
      document_id: input.document_id,
      review: 'pending',
      created_at: now.toISOString(),
    }));
    const staleIds = new Set(cells.stale.map(cell => cell.id));
    const remaining = (await openObservations(key, cells.observations)).filter(observation => !staleIds.has(observation.id));
    const claims = recomputeClaims(await openClaims(key, cells.claims), [...remaining, ...observations]);

    this.guard(epoch);
    await commit([
      // A re-run replaces this document's proposals rather than stacking duplicates on them.
      ...[...staleIds].map(id => ({ store: 'observations' as const, action: 'delete' as const, id })),
      ...await Promise.all(observations.map(async observation => ({ store: 'observations' as const, action: 'put' as const, cell: await sealRecord(key, 'observations', observation.id, observation, { document_id: input.document_id }) }))),
      { store: 'documents', action: 'put', cell: await sealRecord(key, 'documents', next.id, next) },
      ...(input.thumbnail ? [{ store: 'thumbnails' as const, action: 'put' as const, cell: await sealBytes(key, 'thumbnails', next.id, input.thumbnail, { document_id: next.id }) }] : []),
      ...await sealClaims(key, claims),
    ]);
    this.guard(epoch);
    return { document: next, observations };
  }

  async reviewObservation(id: string, decision: 'accepted' | 'rejected', now = new Date()): Promise<void> {
    const key = this.requireKey();
    const epoch = this.epochValue;
    const cells = await transact(['observations', 'claims'], 'readonly', async tx => ({
      target: await getRecord(tx, 'observations', id),
      observations: await allRecords(tx, 'observations'),
      claims: await allRecords(tx, 'claims'),
    }));
    if (!cells.target) throw new Error('observation_missing');
    const observation = parseObservation(await openRecord(key, 'observations', cells.target));
    const next = parseObservation({ ...observation, review: decision, reviewed_at: now.toISOString() });
    const observations = (await openObservations(key, cells.observations)).map(entry => (entry.id === id ? next : entry));
    const claims = recomputeClaims(await openClaims(key, cells.claims), observations);
    this.guard(epoch);
    await commit([
      { store: 'observations', action: 'put', cell: await sealRecord(key, 'observations', id, next, { document_id: next.document_id }) },
      ...await sealClaims(key, claims),
    ]);
    this.guard(epoch);
  }

  /** Deletes the document and everything derived from it, then recomputes what is left. */
  async deleteDocument(id: string): Promise<void> {
    const key = this.requireKey();
    const epoch = this.epochValue;
    const cells = await transact(['observations', 'claims'], 'readonly', async tx => ({
      own: await recordsFor(tx, 'observations', id),
      observations: await allRecords(tx, 'observations'),
      claims: await allRecords(tx, 'claims'),
    }));
    const removed = new Set(cells.own.map(cell => cell.id));
    const remaining = (await openObservations(key, cells.observations)).filter(observation => !removed.has(observation.id));
    const claims = recomputeClaims(await openClaims(key, cells.claims), remaining);
    this.guard(epoch);
    await commit([
      ...[...removed].map(observationId => ({ store: 'observations' as const, action: 'delete' as const, id: observationId })),
      { store: 'blobs', action: 'delete', id },
      { store: 'thumbnails', action: 'delete', id },
      { store: 'documents', action: 'delete', id },
      ...await sealClaims(key, claims),
    ]);
    this.guard(epoch);
  }

  // --- consent --------------------------------------------------------------

  async recordConsent(consent: Omit<ConsentRecord, 'id'>): Promise<ConsentRecord> {
    const key = this.requireKey();
    const record = parseConsent({ ...consent, id: randomId() });
    await commit([{ store: 'consents', action: 'put', cell: await sealRecord(key, 'consents', record.id, record) }]);
    return record;
  }

  async withdrawConsent(id: string, now = new Date()): Promise<void> {
    const key = this.requireKey();
    const cell = await transact(['consents'], 'readonly', tx => getRecord(tx, 'consents', id));
    if (!cell) return;
    const consent = parseConsent(await openRecord(key, 'consents', cell));
    await commit([{ store: 'consents', action: 'put', cell: await sealRecord(key, 'consents', id, parseConsent({ ...consent, withdrawn_at: now.toISOString() })) }]);
  }

  async listConsents(): Promise<ConsentRecord[]> {
    const key = this.requireKey();
    const cells = await transact(['consents'], 'readonly', tx => allRecords(tx, 'consents'));
    return Promise.all(cells.map(async cell => parseConsent(await openRecord(key, 'consents', cell))));
  }

  // --- application ----------------------------------------------------------

  async readApplication(): Promise<Application | undefined> {
    const key = this.requireKey();
    const cell = await transact(['applications'], 'readonly', tx => getRecord(tx, 'applications', APPLICATION_ID));
    return cell ? parseApplication(await openRecord(key, 'applications', cell)) : undefined;
  }

  async saveApplication(application: Application): Promise<Application> {
    const key = this.requireKey();
    const epoch = this.epochValue;
    const parsed = parseApplication(application);
    await commit([{ store: 'applications', action: 'put', cell: await sealRecord(key, 'applications', APPLICATION_ID, parsed) }]);
    this.guard(epoch);
    return parsed;
  }

  async deleteApplication(): Promise<void> {
    this.requireKey();
    await commit([{ store: 'applications', action: 'delete', id: APPLICATION_ID }]);
  }

  /**
   * Remembers that the user dismissed the "you can apply" prompt, against a
   * signature of the evidence behind it. New evidence changes the signature and the
   * prompt comes back; nothing else does.
   */
  async readDismissal(): Promise<string | undefined> {
    const key = this.requireKey();
    const cell = await transact(['applications'], 'readonly', tx => getRecord(tx, 'applications', DISMISSAL_ID));
    if (!cell) return undefined;
    const value = await openRecord(key, 'applications', cell) as { signature?: unknown };
    return typeof value?.signature === 'string' ? value.signature : undefined;
  }

  async saveDismissal(signature: string, now = new Date()): Promise<void> {
    const key = this.requireKey();
    await commit([{ store: 'applications', action: 'put', cell: await sealRecord(key, 'applications', DISMISSAL_ID, { signature: signature.slice(0, 512), dismissed_at: now.toISOString() }) }]);
  }
}

const openObservations = (key: CryptoKey, cells: StoredCell[]) =>
  Promise.all(cells.map(async cell => parseObservation(await openRecord(key, 'observations', cell))));

const openClaims = (key: CryptoKey, cells: StoredCell[]) =>
  Promise.all(cells.map(async cell => parseClaim(await openRecord(key, 'claims', cell))));

const sealClaims = async (key: CryptoKey, claims: Claim[]): Promise<WriteOperation[]> =>
  Promise.all(claims.map(async claim => ({ store: 'claims' as const, action: 'put' as const, cell: await sealRecord(key, 'claims', claim.field, claim) })));

/** v1 held no date of birth and no designations; both start empty rather than invented. */
export function migrateProfile(profile: VaultProfileV1, now: Date): VaultProfileV2 {
  return parseProfileV2({
    version: 2,
    legal_name: profile.legal_name,
    delivery_address: profile.delivery_address,
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.selfie ? { selfie: profile.selfie } : {}),
    designations: [],
    ...(now ? {} : {}),
  });
}

export function seedClaims(profile: VaultProfileV2, now: Date): Claim[] {
  const values: Record<ClaimField, string | null> = {
    legal_name: profile.legal_name.value,
    address: profile.delivery_address.value,
    email: profile.email?.value ?? null,
    date_of_birth: profile.date_of_birth?.value ?? null,
  };
  return CLAIM_FIELDS.map(field => emptyClaim(field, values[field], 'self_entered', now));
}

/** Legacy consumers (disclosure, the Zik ID demo) still speak v1. */
export function toProfileV1(profile: VaultProfileV2): VaultProfileV1 {
  return {
    version: 1,
    legal_name: profile.legal_name,
    delivery_address: profile.delivery_address,
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.selfie ? { selfie: profile.selfie } : {}),
  };
}

export type { RecordStore };
