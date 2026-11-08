import { describe, it, expect } from 'vitest';
import { compareAddresses, compareDates, compareNames, normaliseDate, normaliseMrzDate, nameFromMrz } from '@/lib/shared/analysis/text';

const now = new Date('2026-09-18T00:00:00Z');

describe('date normalisation', () => {
  it('reads the unambiguous forms our documents use', () => {
    expect(normaliseDate('12.03.1994', 'birth', { now, order: 'dmy' })).toEqual({ value: '1994-03-12', ambiguities: [] });
    expect(normaliseDate('30 August 2026', 'issue', { now })).toEqual({ value: '2026-08-30', ambiguities: [] });
    expect(normaliseDate('12 MAR / MAR 94', 'birth', { now })).toEqual({ value: '1994-03-12', ambiguities: [] });
    expect(normaliseDate('6 July 2018', 'issue', { now })).toEqual({ value: '2018-07-06', ambiguities: [] });
    expect(normaliseDate('2026-08-30', 'issue', { now })).toEqual({ value: '2026-08-30', ambiguities: [] });
    expect(normaliseDate('15.06.2031', 'expiry', { now, order: 'dmy' })).toEqual({ value: '2031-06-15', ambiguities: [] });
  });

  it('uses a document layout convention when the caller knows one', () => {
    expect(normaliseDate('03/04/2026', 'issue', { now, order: 'dmy' })).toEqual({ value: '2026-04-03', ambiguities: [] });
    expect(normaliseDate('03/04/2026', 'issue', { now, order: 'mdy' })).toEqual({ value: '2026-03-04', ambiguities: [] });
  });

  it('refuses to guess a day/month order it cannot tell apart', () => {
    expect(normaliseDate('03/04/2026', 'issue', { now })).toEqual({ value: null, ambiguities: ['date_order'] });
    expect(normaliseDate('03/04/26', 'issue', { now })).toEqual({ value: null, ambiguities: ['date_order'] });
  });

  it('resolves the order when one number cannot be a month', () => {
    expect(normaliseDate('30/04/2026', 'issue', { now })).toEqual({ value: '2026-04-30', ambiguities: [] });
    expect(normaliseDate('04/30/2026', 'issue', { now })).toEqual({ value: '2026-04-30', ambiguities: [] });
  });

  it('rejects impossible dates instead of rolling them over', () => {
    expect(normaliseDate('31.02.1994', 'birth', { now }).value).toBeNull();
    expect(normaliseDate('1994-13-01', 'birth', { now }).value).toBeNull();
  });

  it('uses the field role to settle a two-digit century, and says so when it cannot', () => {
    expect(normaliseMrzDate('940312', 'birth', now)).toEqual({ value: '1994-03-12', ambiguities: [] });
    expect(normaliseMrzDate('300415', 'expiry', now)).toEqual({ value: '2030-04-15', ambiguities: [] });
    expect(normaliseMrzDate('120101', 'unknown', now)).toEqual({ value: null, ambiguities: ['century'] });
    expect(normaliseMrzDate('9403', 'birth', now).value).toBeNull();
  });
});

describe('name comparison', () => {
  it('matches the same names in any order', () => {
    expect(compareNames('ALEX MORGAN RIVERS', 'Alex Morgan Rivers')).toBe('match');
    expect(compareNames('RIVERS, Alex Morgan', 'Alex Morgan Rivers')).toBe('match');
    expect(compareNames('Dr Alex Morgan Rivers', 'Alex Morgan Rivers')).toBe('match');
  });

  it('sends initials and dropped names to review rather than merging them', () => {
    expect(compareNames('A. M. RIVERS', 'Alex Morgan Rivers')).toBe('uncertain');
    expect(compareNames('Alex Rivers', 'Alex Morgan Rivers')).toBe('uncertain');
  });

  it('keeps different people apart', () => {
    expect(compareNames('Dana Whitcombe', 'Alex Morgan Rivers')).toBe('different');
    expect(compareNames('Northbank Studios Ltd', 'Alex Morgan Rivers')).toBe('different');
    expect(compareNames('Alex Morgan Rivera', 'Alex Morgan Rivers')).toBe('different');
  });

  it('treats a missing side as unknown, never as agreement', () => {
    expect(compareNames(null, 'Alex Morgan Rivers')).toBe('uncertain');
  });
});

describe('address comparison', () => {
  const home = 'Flat 3, 14 Harbour Lane, Bristol, BS1 4TR';
  it('matches the same address written differently', () => {
    expect(compareAddresses(home, 'Flat 3 14 Harbour Lane Bristol BS1 4TR')).toBe('match');
    expect(compareAddresses(home, 'flat 3, 14 harbour lane, bristol, bs14tr')).toBe('match');
  });
  it('separates a different postcode and reviews a shared one', () => {
    expect(compareAddresses(home, '200 Quay Street, Manchester, M3 4JB')).toBe('different');
    expect(compareAddresses(home, 'Flat 9, 22 Harbour Lane, Bristol, BS1 4TR')).toBe('uncertain');
  });
});

describe('MRZ name field', () => {
  it('splits the filler characters back into names', () => {
    expect(nameFromMrz('RIVERS<<ALEX<MORGAN<<<<<<<<<<<<<<<<<<<<')).toEqual({ surname: 'RIVERS', given: 'ALEX MORGAN' });
  });
});

describe('date agreement', () => {
  it('never calls an unknown value a match', () => {
    expect(compareDates('1994-03-12', '1994-03-12')).toBe('match');
    expect(compareDates('1994-03-12', '1974-03-12')).toBe('different');
    expect(compareDates(null, '1994-03-12')).toBe('uncertain');
  });
});
