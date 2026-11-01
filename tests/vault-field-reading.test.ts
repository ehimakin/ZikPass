import { describe, expect, it } from 'vitest';
import { fieldReading } from '@/lib/shared/vault/field-reading';
import type { Observation } from '@/lib/shared/vault/model';

const observation = (overrides: Partial<Observation> = {}): Observation => ({
  id: 'o1', document_id: 'passport', page: 1, field: 'legal_name', raw_text: 'Jane Smith',
  normalised: 'Jane Smith', ambiguities: [], method: 'mrz', parser_version: 'test',
  recognition_quality: 95, excerpt: 'Jane Smith', review: 'pending', created_at: '2026-09-20T00:00:00Z', ...overrides,
});
describe('Vault field readings', () => {
  it('pre-fills a missing field from a clear reading without accepting it', () => {
    const o = observation();
    expect(fieldReading('legal_name', '', [o]).suggestion).toEqual(o);
    expect(o.review).toBe('pending');
  });
  it('matches existing text without replacing it', () => {
    const result = fieldReading('legal_name', 'Jane Smith', [observation()]);
    expect(result.matches).toHaveLength(1);
    expect(result.suggestion).toBeUndefined();
  });
  it('flags contradictions even when another document matches', () => {
    const result = fieldReading('legal_name', 'Jane Smith', [observation(), observation({ id: 'o2', normalised: 'Alex Jones' })]);
    expect(result.matches).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
  });
  it('does not choose between conflicting documents for an empty field', () => {
    expect(fieldReading('legal_name', '', [observation(), observation({ normalised: 'Alex Jones' })]).suggestion).toBeUndefined();
  });
  it.each([
    { ambiguities: ['initials_only'] }, { recognition_quality: 60 }, { normalised: null }, { review: 'rejected' },
  ] as Partial<Observation>[])('does not prefill uncertain or rejected readings: %o', overrides => {
    expect(fieldReading('legal_name', '', [observation(overrides)]).suggestion).toBeUndefined();
    expect(fieldReading('legal_name', 'Jane Smith', [observation(overrides)]).matches).toHaveLength(0);
  });
  it('removes matching status after edit, deletion or rejection', () => {
    expect(fieldReading('legal_name', 'Alex Jones', [observation()]).matches).toHaveLength(0);
    expect(fieldReading('legal_name', 'Jane Smith', []).matches).toHaveLength(0);
    expect(fieldReading('legal_name', 'Jane Smith', [observation({ review: 'rejected' })]).matches).toHaveLength(0);
  });
  it('never matches a date of issue to a birth date', () => {
    expect(fieldReading('date_of_birth', '', [observation({ field: 'issue_date', normalised: '2000-01-02' })]).suggestion).toBeUndefined();
  });
});
