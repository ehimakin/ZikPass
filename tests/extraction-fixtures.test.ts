import { describe, it, expect } from 'vitest';
import transcripts from '@/tests/fixtures/ocr-transcripts.json';
import manifest from '@/tests/fixtures/documents/MANIFEST.json';
import { classify, extractCandidates, type Candidate } from '@/lib/shared/analysis/extract';
import type { ObservationField } from '@/lib/shared/vault/model';

/**
 * Field-level accuracy against the text real in-browser OCR actually produced.
 * The transcripts are recorded by `npm run measure:ocr`; re-record them after any
 * engine or pipeline change rather than relaxing what these tests expect.
 */
const now = new Date('2026-09-18T00:00:00Z');
type Transcript = { ok: boolean; text: string; method: string | null; error: string | null; recognition_quality: number | null };
const recorded = transcripts.transcripts as Record<string, Transcript>;

function read(name: string) {
  const record = recorded[name];
  if (!record) throw new Error(`No recorded transcript for ${name}. Run npm run measure:ocr.`);
  const classification = classify(record.text);
  const candidates = record.ok
    ? extractCandidates({ text: record.text, document_class: classification.document_class, method: record.method === 'pdf_text_layer' ? 'pdf_text_layer' : 'labelled_field', now })
    : [];
  const value = (field: ObservationField) => candidates.find(candidate => candidate.field === field)?.normalised ?? null;
  const entry = (field: ObservationField) => candidates.find(candidate => candidate.field === field);
  const all = (field: ObservationField) => candidates.filter(candidate => candidate.field === field);
  return { record, classification, candidates, value, entry, all };
}

const SUBJECT = { name: 'ALEX MORGAN RIVERS', dob: '1994-03-12', address: 'Flat 3, 14 Harbour Lane, Bristol, BS1 4TR' };
const sameName = (candidate: Candidate | undefined) => candidate?.normalised?.toUpperCase();

describe('fixture coverage', () => {
  it('has a recorded transcript for every committed fixture', () => {
    for (const fixture of manifest.fixtures) expect(recorded[fixture.file], fixture.file).toBeDefined();
    expect(manifest.fixtures.length).toBeGreaterThanOrEqual(12);
  });
});

describe('passport extraction', () => {
  it('reads name, date of birth, expiry and number from the MRZ of a clean scan', () => {
    const { classification, value } = read('passport-clean.png');
    expect(classification.document_class).toBe('passport');
    expect(classification.matched).toContain('mrz');
    expect(value('legal_name')).toBe(SUBJECT.name);
    expect(value('date_of_birth')).toBe(SUBJECT.dob);
    expect(value('expiry_date')).toBe('2030-04-15');
    expect(value('document_number')).toBe('987654321');
  });

  it('reads an expired passport correctly rather than hiding the expiry', () => {
    expect(read('passport-expired.png').value('expiry_date')).toBe('2020-04-15');
  });

  it('recovers a sideways photo and still reads the same values', () => {
    const { value } = read('passport-rotated.jpg');
    expect(recorded['passport-rotated.jpg'].text.length).toBeGreaterThan(200);
    expect(value('legal_name')).toBe(SUBJECT.name);
    expect(value('date_of_birth')).toBe(SUBJECT.dob);
  });

  it('still reads a degraded scan, and never proposes a date of birth it cannot check', () => {
    const { value } = read('passport-degraded.jpg');
    expect(value('date_of_birth')).toBe(SUBJECT.dob);
  });

  it('proposes nothing wrong when the MRZ is unreadable', () => {
    const { classification, value, candidates } = read('passport-rescan.jpg');
    expect(classification.document_class).toBe('passport');
    // Column bleed on a two-column card must not become a name.
    expect(value('legal_name')).toBeNull();
    for (const candidate of candidates) expect(candidate.ambiguities).toContain('low_recognition');
  });
});

describe('driving licence extraction', () => {
  it('reads the numbered fields of the UK photocard layout', () => {
    const { classification, value } = read('driving-licence-clean.png');
    expect(classification.document_class).toBe('driving_licence');
    expect(value('legal_name')).toBe(SUBJECT.name);
    expect(value('date_of_birth')).toBe(SUBJECT.dob);
    expect(value('address')).toBe(SUBJECT.address);
  });

  it('reads a conflicting date of birth as written, so review can surface it', () => {
    expect(read('driving-licence-dob-conflict.png').value('date_of_birth')).toBe('1974-03-12');
  });
});

describe('address evidence extraction', () => {
  it('reads a text-layer bill without touching OCR', () => {
    const { record, value } = read('utility-bill-recent.pdf');
    expect(record.method).toBe('pdf_text_layer');
    expect(sameName(read('utility-bill-recent.pdf').entry('legal_name'))).toBe(SUBJECT.name);
    expect(value('address')).toBe(SUBJECT.address);
    expect(value('issue_date')).toBe('2026-08-30');
    expect(value('issuer')).toBe('Severn Light & Power');
  });

  it('reads a scanned statement through OCR', () => {
    const { record, value } = read('bank-statement-scanned.pdf');
    expect(record.method).toBe('ocr');
    expect(value('address')).toBe(SUBJECT.address);
    expect(value('issue_date')).toBe('2026-08-14');
  });

  it('reads a stale bill without pretending it is current', () => {
    expect(read('utility-bill-stale.pdf').value('issue_date')).toBe('2025-05-02');
  });

  it('refuses to guess an ambiguous date', () => {
    const { entry } = read('utility-bill-ambiguous-date.pdf');
    expect(entry('issue_date')?.normalised).toBeNull();
    expect(entry('issue_date')?.ambiguities).toContain('date_order');
    expect(entry('issue_date')?.raw_text).toBe('03/04/26');
  });

  it('flags a name given only as initials instead of expanding it', () => {
    const { entry } = read('council-tax-initials.png');
    expect(entry('legal_name')?.normalised).toBe('A. M. RIVERS');
    expect(entry('legal_name')?.ambiguities).toContain('initials_only');
  });
});

describe('other documents', () => {
  it('reads a certificate without turning its award date into a date of birth', () => {
    const { classification, value } = read('certificate.png');
    expect(classification.document_class).toBe('certificate');
    expect(sameName(read('certificate.png').entry('legal_name'))).toBe(SUBJECT.name);
    expect(value('issue_date')).toBe('2018-07-06');
    expect(value('date_of_birth')).toBeNull();
  });

  it('keeps both contract parties separate and proposes no address from a company one', () => {
    const { classification, all, value } = read('contract.pdf');
    expect(classification.document_class).toBe('contract');
    const subjects = all('other_subject').map(candidate => candidate.normalised);
    expect(subjects).toContain('Northbank Studios Ltd');
    expect(subjects).toContain('Alex Morgan Rivers');
    for (const candidate of all('other_subject')) expect(candidate.ambiguities).toContain('multiple_subjects');
    expect(value('address')).toBeNull();
    expect(value('legal_name')).toBeNull();
  });

  it('returns nothing at all from an unreadable image', () => {
    const { classification, candidates, record } = read('unreadable.png');
    expect(record.ok).toBe(true);
    expect(classification.document_class).toBe('unknown');
    expect(candidates).toHaveLength(0);
  });
});

describe('files that cannot be analysed', () => {
  it('reports a truncated PDF instead of reporting success', () => {
    expect(recorded['corrupt.pdf'].ok).toBe(false);
    expect(recorded['corrupt.pdf'].error).toMatch(/PDF/i);
  });

  it('reports HEIC as undecodable rather than silently skipping it', () => {
    expect(recorded['passport-clean.heic'].ok).toBe(false);
    expect(recorded['passport-clean.heic'].error).toMatch(/decoded/i);
  });

  it('rejects a decompression bomb on decoded pixels, not on file size', () => {
    expect(recorded['pixel-bomb.png'].ok).toBe(false);
    expect(recorded['pixel-bomb.png'].error).toMatch(/megapixel/i);
  });
});
