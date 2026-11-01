import { describe, it, expect } from 'vitest';
import { evaluateReadiness, READINESS_POLICY_VERSION } from '@/lib/shared/policy/zik-id-readiness';
import { recomputeClaims, emptyClaim } from '@/lib/shared/vault/claims';
import type { Claim, Observation, VaultDocument } from '@/lib/shared/vault/model';

const now = new Date('2026-09-18T00:00:00Z');

const document = (id: string, classification: VaultDocument['classification'], extra: Partial<VaultDocument> = {}): VaultDocument => ({
  id, filename: `${id}.png`, media_type: 'image/png', byte_length: 1000, content_hash: `hash-${id}`,
  imported_at: '2026-09-17T00:00:00Z', classification, page_count: 1, rotation: 0, processing: 'analysed',
  analysis: { engine: 'test', method: 'ocr', completed_at: '2026-09-17T00:00:00Z', recognition_quality: 92 }, ...extra,
});

let counter = 0;
const observation = (documentId: string, field: Observation['field'], normalised: string | null, review: Observation['review'] = 'accepted'): Observation => ({
  id: `obs-${(counter += 1)}`, document_id: documentId, page: 1, field, raw_text: normalised ?? '', normalised,
  ambiguities: [], method: 'labelled_field', parser_version: 'test', recognition_quality: 92, excerpt: '', review,
  created_at: '2026-09-17T00:00:00Z',
});

const claims = (overrides: Partial<Record<Claim['field'], string | null>> = {}): Claim[] => {
  const values = { legal_name: 'Alex Morgan Rivers', date_of_birth: '1994-03-12', address: 'Flat 3, 14 Harbour Lane, Bristol, BS1 4TR', email: 'alex@example.invalid', ...overrides };
  return (Object.keys(values) as Claim['field'][]).map(field => emptyClaim(field, values[field] ?? null, 'self_entered', now));
};

const eligible = () => {
  const documents = [document('passport', 'passport'), document('bill', 'address_evidence')];
  const observations = [
    observation('passport', 'legal_name', 'ALEX MORGAN RIVERS'),
    observation('passport', 'date_of_birth', '1994-03-12'),
    observation('passport', 'expiry_date', '2030-04-15'),
    observation('bill', 'legal_name', 'Alex Morgan Rivers'),
    observation('bill', 'address', 'Flat 3, 14 Harbour Lane, Bristol, BS1 4TR'),
    observation('bill', 'issue_date', '2026-08-30'),
  ];
  return { documents, observations, claims: recomputeClaims(claims(), observations), pass: { active: true }, now };
};

describe('Zik ID readiness policy v1', () => {
  it('reaches ready_to_apply for a complete, reviewed, independent set', () => {
    const result = evaluateReadiness(eligible());
    expect(result.policy_version).toBe(READINESS_POLICY_VERSION);
    expect(result.status).toBe('ready_to_apply');
    expect(result.reasons).toEqual([]);
    expect(result.evidence).toEqual({ primary_document_id: 'passport', supporting_document_id: 'bill' });
  });

  it('requires an active Zik Pass without borrowing its age assertion', () => {
    const result = evaluateReadiness({ ...eligible(), pass: { active: false } });
    expect(result.status).toBe('not_ready');
    expect(result.reasons).toContain('no_active_pass');
  });

  it('will not count a second scan of the same document as support', () => {
    const base = eligible();
    const rescan = document('passport-rescan', 'passport', { content_hash: 'hash-passport', group_id: 'passport' });
    const result = evaluateReadiness({
      ...base,
      documents: [base.documents[0], rescan],
      observations: base.observations.filter(entry => entry.document_id === 'passport')
        .concat([observation('passport-rescan', 'legal_name', 'ALEX MORGAN RIVERS'), observation('passport-rescan', 'date_of_birth', '1994-03-12'), observation('passport-rescan', 'expiry_date', '2030-04-15')]),
    });
    expect(result.status).not.toBe('ready_to_apply');
    expect(result.reasons).toContain('duplicate_evidence_only');
  });

  it('will not count extra unrelated documents as a missing requirement met', () => {
    const base = eligible();
    const extras = [document('cert-1', 'certificate'), document('cert-2', 'certificate'), document('contract-1', 'contract')];
    const result = evaluateReadiness({
      ...base,
      documents: [base.documents[0], ...extras],
      observations: base.observations.filter(entry => entry.document_id === 'passport')
        .concat(extras.map(entry => observation(entry.id, 'legal_name', 'Alex Morgan Rivers'))),
    });
    expect(result.status).not.toBe('ready_to_apply');
    expect(result.reasons).toContain('no_supporting_document');
  });

  it('rejects expired primary evidence', () => {
    const base = eligible();
    const result = evaluateReadiness({
      ...base,
      observations: base.observations.map(entry => (entry.field === 'expiry_date' ? { ...entry, normalised: '2020-04-15' } : entry)),
    });
    expect(result.status).toBe('not_ready');
    expect(result.reasons).toContain('photo_id_expired');
  });

  it('treats address evidence older than 90 days as out of date', () => {
    const base = eligible();
    const result = evaluateReadiness({
      ...base,
      observations: base.observations.map(entry => (entry.field === 'issue_date' ? { ...entry, normalised: '2025-05-02' } : entry)),
    });
    expect(result.status).not.toBe('ready_to_apply');
    expect(result.reasons).toContain('supporting_address_out_of_date');
  });

  it('holds at needs_review while proposals are unreviewed', () => {
    const base = eligible();
    const result = evaluateReadiness({
      ...base,
      observations: base.observations.map(entry => (entry.document_id === 'passport' && entry.field === 'date_of_birth' ? { ...entry, review: 'pending' as const } : entry)),
    });
    expect(result.status).toBe('needs_review');
    expect(result.reasons).toContain('primary_evidence_unreviewed');
  });

  it('holds at needs_review on a material date of birth conflict', () => {
    const base = eligible();
    const observations = [...base.observations, observation('bill', 'date_of_birth', '1974-03-12')];
    const result = evaluateReadiness({ ...base, observations, claims: recomputeClaims(claims(), observations) });
    expect(result.status).toBe('needs_review');
    expect(result.reasons).toContain('conflict_date_of_birth');
  });

  it('never proposes readiness from a photo ID alone', () => {
    const base = eligible();
    const result = evaluateReadiness({ ...base, documents: [base.documents[0]], observations: base.observations.filter(entry => entry.document_id === 'passport') });
    expect(result.status).toBe('not_ready');
    expect(result.reasons).toContain('no_supporting_document');
    expect(result.next_actions.length).toBeGreaterThan(0);
  });

  it('ignores evidence whose analysis never completed', () => {
    const base = eligible();
    const result = evaluateReadiness({ ...base, documents: base.documents.map(entry => (entry.id === 'bill' ? { ...entry, processing: 'failed' as const } : entry)) });
    expect(result.status).not.toBe('ready_to_apply');
  });
});

describe('honest reporting before a primary document is settled', () => {
  it('does not claim reviews are complete while proposals are waiting', () => {
    const documents = [document('passport', 'passport')];
    const observations = [
      observation('passport', 'legal_name', 'ALEX MORGAN RIVERS', 'pending'),
      observation('passport', 'date_of_birth', '1994-03-12', 'pending'),
      observation('passport', 'expiry_date', '2030-04-15', 'pending'),
    ];
    const result = evaluateReadiness({ documents, observations, claims: claims(), pass: { active: true }, now });
    expect(result.requirements.find(entry => entry.id === 'proposals_reviewed')?.satisfied).toBe(false);
    expect(result.reasons).toContain('primary_evidence_unreviewed');
  });

  it('asks for a second document rather than blaming one that does not exist', () => {
    const documents = [document('passport', 'passport')];
    const observations = [observation('passport', 'legal_name', 'ALEX MORGAN RIVERS', 'pending')];
    const result = evaluateReadiness({ documents, observations, claims: claims(), pass: { active: true }, now });
    const support = result.requirements.find(entry => entry.id === 'independent_support');
    expect(support?.reasons).toEqual(['no_supporting_document']);
    expect(result.reasons).not.toContain('supporting_evidence_unreviewed');
  });
});
