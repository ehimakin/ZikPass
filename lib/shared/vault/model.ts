import { boundedString, strictObject, type SelfEntered, type VaultProfileV1 } from '@/lib/shared/vault';

/**
 * Vault v2 record model.
 *
 * The separation this file exists to keep: an Observation is text read from a
 * document, a Claim is the value the user stands behind, and an Attestation is a
 * check made by someone authorised to make it. OCR produces Observations only.
 * Recognition quality says how legible the text was; it says nothing about whether
 * the document is genuine or belongs to the person holding it.
 */
export const VAULT_SCHEMA_VERSION = 2;
export const PARSER_VERSION = 'zik-extract/1';

export const DOCUMENT_CLASSES = ['passport', 'driving_licence', 'address_evidence', 'certificate', 'contract', 'unknown'] as const;
export type DocumentClass = typeof DOCUMENT_CLASSES[number];

export const PROCESSING_STATES = ['stored', 'queued', 'analysing', 'analysed', 'failed', 'unsupported', 'cancelled'] as const;
export type ProcessingState = typeof PROCESSING_STATES[number];

export const OBSERVATION_FIELDS = ['legal_name', 'date_of_birth', 'address', 'expiry_date', 'issue_date', 'document_number', 'issuer', 'document_title', 'other_subject'] as const;
export type ObservationField = typeof OBSERVATION_FIELDS[number];

export const CLAIM_FIELDS = ['legal_name', 'date_of_birth', 'address', 'email'] as const;
export type ClaimField = typeof CLAIM_FIELDS[number];

export const REVIEW_DECISIONS = ['pending', 'accepted', 'rejected'] as const;
export type ReviewDecision = typeof REVIEW_DECISIONS[number];

/** Why a value needs a human: we never guess past one of these. */
export const AMBIGUITIES = ['date_order', 'century', 'multiple_subjects', 'initials_only', 'low_recognition', 'not_the_subject'] as const;
export type Ambiguity = typeof AMBIGUITIES[number];

export const EXTRACTION_METHODS = ['mrz', 'labelled_field', 'pattern', 'pdf_text_layer'] as const;
export type ExtractionMethod = typeof EXTRACTION_METHODS[number];

export const ANALYSIS_METHODS = ['pdf_text_layer', 'ocr', 'mixed'] as const;
export type AnalysisMethod = typeof ANALYSIS_METHODS[number];

export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = typeof ROTATIONS[number];

export type VaultDocument = {
  id: string;
  filename: string;
  label?: string;
  media_type: string;
  byte_length: number;
  /** SHA-256 of the stored bytes. Identical hash means identical bytes, nothing more. */
  content_hash: string;
  imported_at: string;
  classification: DocumentClass | null;
  page_count: number | null;
  rotation: Rotation;
  processing: ProcessingState;
  failure_reason?: string;
  /** Set when the user groups alternative scans of one real-world document. */
  group_id?: string;
  analysis?: {
    engine: string;
    method: AnalysisMethod;
    completed_at: string;
    /** Mean OCR confidence 0-100, or null for a text layer. Legibility, not authenticity. */
    recognition_quality: number | null;
  };
};

export type Observation = {
  id: string;
  document_id: string;
  page: number;
  field: ObservationField;
  /** Exactly what was read, before any tidying. */
  raw_text: string;
  /** Our proposal, or null when the source is too ambiguous to normalise honestly. */
  normalised: string | null;
  ambiguities: Ambiguity[];
  method: ExtractionMethod;
  parser_version: string;
  recognition_quality: number | null;
  excerpt: string;
  box?: { x: number; y: number; width: number; height: number };
  review: ReviewDecision;
  reviewed_at?: string;
  created_at: string;
};

export const CLAIM_SOURCES = ['self_entered', 'user_corrected', 'accepted_extraction'] as const;
export type ClaimSource = typeof CLAIM_SOURCES[number];

/** Reserved for a real issuer check. Nothing in this sprint may write one. */
export type Attestation = { verifier: string; method: string; scope: string; checked_at: string; reference: string };

export type Claim = {
  field: ClaimField;
  value: string | null;
  source: ClaimSource;
  updated_at: string;
  supporting_observation_ids: string[];
  conflicting_observation_ids: string[];
  attestations: Attestation[];
};

export const CONSENT_SCOPES = ['store', 'analyse', 'share'] as const;
export type ConsentScope = typeof CONSENT_SCOPES[number];

export type ConsentRecord = {
  id: string;
  scope: ConsentScope;
  purpose: string;
  policy_version: string;
  /** What the user actually picked, so a changed scope can invalidate this grant. */
  source_descriptor: string;
  source_fingerprint: string;
  file_count: number;
  granted_at: string;
  withdrawn_at?: string;
};

export const APPLICATION_STATES = ['draft', 'pending_onboarding', 'stale', 'withdrawn'] as const;
export type ApplicationState = typeof APPLICATION_STATES[number];

export type ApplicationEvidence = { document_id: string; content_hash: string; observation_ids: string[] };

export type Application = {
  id: string;
  policy_version: string;
  state: ApplicationState;
  created_at: string;
  updated_at: string;
  claim_snapshot: Partial<Record<ClaimField, string>>;
  evidence_snapshot: ApplicationEvidence[];
  readiness_reasons: string[];
  /** Filled by an onboarding adapter. Local state never confers issuance. */
  onboarding?: { adapter: string; reference: string; status: string; updated_at: string };
  stale_reason?: string;
};

export type VaultProfileV2 = {
  version: 2;
  legal_name: SelfEntered;
  delivery_address: SelfEntered;
  email?: SelfEntered;
  date_of_birth?: SelfEntered;
  designations: SelfEntered[];
  selfie?: VaultProfileV1['selfie'];
};

/** Some fields are legitimately empty (an excerpt for a value with no surrounding text). */
const optionalText = (value: unknown, max: number): string => {
  if (typeof value !== 'string' || value.length > max) throw new Error('invalid_schema');
  return value;
};
const isoDate = (value: unknown): string => {
  const s = boundedString(value, 40);
  if (!Number.isFinite(Date.parse(s))) throw new Error('invalid_schema');
  return s;
};
const member = <T extends string>(value: unknown, allowed: readonly T[]): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error('invalid_schema');
  return value as T;
};
const list = <T>(value: unknown, item: (entry: unknown) => T, max = 200): T[] => {
  if (!Array.isArray(value) || value.length > max) throw new Error('invalid_schema');
  return value.map(item);
};
const count = (value: unknown, max: number): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) throw new Error('invalid_schema');
  return value;
};
const id = (value: unknown): string => {
  const s = boundedString(value, 64);
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('invalid_schema');
  return s;
};
const rotation = (value: unknown): Rotation => {
  if (!ROTATIONS.includes(value as Rotation)) throw new Error('invalid_schema');
  return value as Rotation;
};
const quality = (value: unknown): number | null => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new Error('invalid_schema');
  return value;
};

export function parseDocument(value: unknown): VaultDocument {
  const r = strictObject(value, ['id', 'filename', 'media_type', 'byte_length', 'content_hash', 'imported_at', 'classification', 'page_count', 'rotation', 'processing'], ['label', 'failure_reason', 'group_id', 'analysis']);
  const analysis = r.analysis === undefined ? undefined : (() => {
    const a = strictObject(r.analysis, ['engine', 'method', 'completed_at', 'recognition_quality']);
    return { engine: boundedString(a.engine, 80), method: member(a.method, ANALYSIS_METHODS), completed_at: isoDate(a.completed_at), recognition_quality: quality(a.recognition_quality) };
  })();
  return {
    id: id(r.id),
    filename: boundedString(r.filename, 260),
    ...(r.label === undefined ? {} : { label: boundedString(r.label, 120) }),
    media_type: boundedString(r.media_type, 120),
    byte_length: count(r.byte_length, 1024 * 1024 * 1024),
    content_hash: boundedString(r.content_hash, 64),
    imported_at: isoDate(r.imported_at),
    classification: r.classification === null ? null : member(r.classification, DOCUMENT_CLASSES),
    page_count: r.page_count === null ? null : count(r.page_count, 10000),
    rotation: rotation(r.rotation),
    processing: member(r.processing, PROCESSING_STATES),
    ...(r.failure_reason === undefined ? {} : { failure_reason: boundedString(r.failure_reason, 300) }),
    ...(r.group_id === undefined ? {} : { group_id: id(r.group_id) }),
    ...(analysis === undefined ? {} : { analysis }),
  };
}

export function parseObservation(value: unknown): Observation {
  const r = strictObject(value, ['id', 'document_id', 'page', 'field', 'raw_text', 'normalised', 'ambiguities', 'method', 'parser_version', 'recognition_quality', 'excerpt', 'review', 'created_at'], ['box', 'reviewed_at']);
  const box = r.box === undefined ? undefined : (() => {
    const b = strictObject(r.box, ['x', 'y', 'width', 'height']);
    const unit = (v: unknown) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < -1 || v > 2) throw new Error('invalid_schema'); return v; };
    return { x: unit(b.x), y: unit(b.y), width: unit(b.width), height: unit(b.height) };
  })();
  return {
    id: id(r.id),
    document_id: id(r.document_id),
    page: count(r.page, 10000),
    field: member(r.field, OBSERVATION_FIELDS),
    raw_text: optionalText(r.raw_text, 2000),
    normalised: r.normalised === null ? null : boundedString(r.normalised, 512),
    ambiguities: list(r.ambiguities, entry => member(entry, AMBIGUITIES), 8),
    method: member(r.method, EXTRACTION_METHODS),
    parser_version: boundedString(r.parser_version, 40),
    recognition_quality: quality(r.recognition_quality),
    excerpt: optionalText(r.excerpt, 600),
    ...(box === undefined ? {} : { box }),
    review: member(r.review, REVIEW_DECISIONS),
    ...(r.reviewed_at === undefined ? {} : { reviewed_at: isoDate(r.reviewed_at) }),
    created_at: isoDate(r.created_at),
  };
}

export function parseClaim(value: unknown): Claim {
  const r = strictObject(value, ['field', 'value', 'source', 'updated_at', 'supporting_observation_ids', 'conflicting_observation_ids', 'attestations']);
  return {
    field: member(r.field, CLAIM_FIELDS),
    value: r.value === null ? null : boundedString(r.value, 512),
    source: member(r.source, CLAIM_SOURCES),
    updated_at: isoDate(r.updated_at),
    supporting_observation_ids: list(r.supporting_observation_ids, id, 500),
    conflicting_observation_ids: list(r.conflicting_observation_ids, id, 500),
    attestations: list(r.attestations, entry => {
      const a = strictObject(entry, ['verifier', 'method', 'scope', 'checked_at', 'reference']);
      return { verifier: boundedString(a.verifier, 120), method: boundedString(a.method, 120), scope: boundedString(a.scope, 200), checked_at: isoDate(a.checked_at), reference: boundedString(a.reference, 200) };
    }, 20),
  };
}

export function parseConsent(value: unknown): ConsentRecord {
  const r = strictObject(value, ['id', 'scope', 'purpose', 'policy_version', 'source_descriptor', 'source_fingerprint', 'file_count', 'granted_at'], ['withdrawn_at']);
  return {
    id: id(r.id),
    scope: member(r.scope, CONSENT_SCOPES),
    purpose: boundedString(r.purpose, 300),
    policy_version: boundedString(r.policy_version, 40),
    source_descriptor: boundedString(r.source_descriptor, 300),
    source_fingerprint: boundedString(r.source_fingerprint, 128),
    file_count: count(r.file_count, 100000),
    granted_at: isoDate(r.granted_at),
    ...(r.withdrawn_at === undefined ? {} : { withdrawn_at: isoDate(r.withdrawn_at) }),
  };
}

export function parseApplication(value: unknown): Application {
  const r = strictObject(value, ['id', 'policy_version', 'state', 'created_at', 'updated_at', 'claim_snapshot', 'evidence_snapshot', 'readiness_reasons'], ['onboarding', 'stale_reason']);
  const snapshot = strictObject(r.claim_snapshot, [], [...CLAIM_FIELDS]);
  return {
    id: id(r.id),
    policy_version: boundedString(r.policy_version, 40),
    state: member(r.state, APPLICATION_STATES),
    created_at: isoDate(r.created_at),
    updated_at: isoDate(r.updated_at),
    claim_snapshot: Object.fromEntries(Object.entries(snapshot).map(([key, entry]) => [key, boundedString(entry, 512)])),
    evidence_snapshot: list(r.evidence_snapshot, entry => {
      const e = strictObject(entry, ['document_id', 'content_hash', 'observation_ids']);
      return { document_id: id(e.document_id), content_hash: boundedString(e.content_hash, 64), observation_ids: list(e.observation_ids, id, 200) };
    }, 200),
    readiness_reasons: list(r.readiness_reasons, entry => boundedString(entry, 120), 40),
    ...(r.onboarding === undefined ? {} : (() => {
      const o = strictObject(r.onboarding, ['adapter', 'reference', 'status', 'updated_at']);
      return { onboarding: { adapter: boundedString(o.adapter, 80), reference: boundedString(o.reference, 200), status: boundedString(o.status, 60), updated_at: isoDate(o.updated_at) } };
    })()),
    ...(r.stale_reason === undefined ? {} : { stale_reason: boundedString(r.stale_reason, 300) }),
  };
}

function parseSelfEntered(value: unknown): SelfEntered {
  const r = strictObject(value, ['value', 'provenance', 'updated_at']);
  if (r.provenance !== 'self_entered') throw new Error('invalid_schema');
  return { value: boundedString(r.value), provenance: 'self_entered', updated_at: isoDate(r.updated_at) };
}

export function parseProfileV2(value: unknown): VaultProfileV2 {
  const r = strictObject(value, ['version', 'legal_name', 'delivery_address', 'designations'], ['email', 'date_of_birth', 'selfie']);
  if (r.version !== 2) throw new Error('unsupported_version');
  const selfie = r.selfie === undefined ? undefined : (() => {
    const s = strictObject(r.selfie, ['data_url', 'provenance', 'captured_at']);
    const dataUrl = boundedString(s.data_url, 250000);
    if (s.provenance !== 'device_selfie' || !/^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)) throw new Error('invalid_schema');
    return { data_url: dataUrl, provenance: 'device_selfie' as const, captured_at: isoDate(s.captured_at) };
  })();
  return {
    version: 2,
    legal_name: parseSelfEntered(r.legal_name),
    delivery_address: parseSelfEntered(r.delivery_address),
    ...(r.email === undefined ? {} : { email: parseSelfEntered(r.email) }),
    ...(r.date_of_birth === undefined ? {} : { date_of_birth: parseSelfEntered(r.date_of_birth) }),
    designations: list(r.designations, parseSelfEntered, 50),
    ...(selfie === undefined ? {} : { selfie }),
  };
}
