import type { Ambiguity } from '@/lib/shared/vault/model';

/**
 * Deterministic normalisation and comparison.
 *
 * Two rules run through everything here. We never guess past an ambiguity: an
 * unresolvable date returns null with a reason, so the user decides. And we never
 * merge materially different values: comparison returns `uncertain` rather than
 * stretching a match, because a wrong merge silently rewrites someone's identity.
 */
export type Proposal = { value: string | null; ambiguities: Ambiguity[] };
export type Agreement = 'match' | 'different' | 'uncertain';

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

export function collapse(value: string): string { return value.replace(/\s+/g, ' ').trim(); }

/** Case, accent and punctuation folding for comparison only; stored values keep their original spelling. */
export function fold(value: string): string {
  return collapse(value).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,'’`-]/g, ' ').replace(/\s+/g, ' ').trim();
}

const pad = (value: number) => String(value).padStart(2, '0');
const iso = (year: number, month: number, day: number) => `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;

function valid(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export type DateRole = 'birth' | 'expiry' | 'issue' | 'unknown';

/**
 * Where a document's layout fixes the field order, the caller says so: field 3 of a
 * UK driving licence is DD.MM.YYYY by specification. `unknown` is the default and
 * keeps free text ambiguous.
 */
export type DateOrder = 'dmy' | 'mdy' | 'unknown';
export type DateOptions = { now?: Date; order?: DateOrder };

/** Two-digit years are only resolved when the role leaves exactly one plausible century. */
function centuries(twoDigit: number, role: DateRole, now: Date): { years: number[]; assumed: boolean } {
  const current = now.getUTCFullYear();
  const candidates = [1900 + twoDigit, 2000 + twoDigit, 2100 + twoDigit].filter(year => year >= 1900 && year <= current + 100);
  if (role === 'birth') {
    const plausible = candidates.filter(year => year <= current && current - year <= 120);
    return { years: plausible, assumed: plausible.length === 1 };
  }
  if (role === 'expiry') {
    const plausible = candidates.filter(year => year >= current - 20 && year <= current + 20);
    return { years: plausible, assumed: plausible.length === 1 };
  }
  if (role === 'issue') {
    const plausible = candidates.filter(year => year <= current && current - year <= 60);
    return { years: plausible, assumed: plausible.length === 1 };
  }
  return { years: candidates, assumed: false };
}

/**
 * Parses a date written in any of the forms our supported documents use.
 * Returns null plus a reason whenever the text supports more than one reading:
 * `03/04/26` is not silently taken as 3 April 2026.
 */
export function normaliseDate(raw: string, role: DateRole = 'unknown', { now = new Date(), order = 'unknown' }: DateOptions = {}): Proposal {
  const text = collapse(raw).replace(/^[^0-9A-Za-z]+|[^0-9A-Za-z]+$/g, '');
  if (!text) return { value: null, ambiguities: [] };

  const isoMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(Number);
    return valid(y, m, d) ? { value: iso(y, m, d), ambiguities: [] } : { value: null, ambiguities: [] };
  }

  // 12 MAR 1994 / 12 MAR / MAR 94 / 6 July 2018
  const named = /^(\d{1,2})\s*([A-Za-z]{3,9})\.?(?:\s*\/\s*[A-Za-z]{3,9}\.?)?\s*(\d{2,4})$/.exec(text);
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2].toLowerCase().slice(0, named[2].toLowerCase() === 'sept' ? 4 : 3)];
    if (!month) return { value: null, ambiguities: [] };
    const yearText = named[3];
    if (yearText.length === 4) {
      const year = Number(yearText);
      return valid(year, month, day) ? { value: iso(year, month, day), ambiguities: [] } : { value: null, ambiguities: [] };
    }
    const { years, assumed } = centuries(Number(yearText), role, now);
    const usable = years.filter(year => valid(year, month, day));
    if (assumed && usable.length === 1) return { value: iso(usable[0], month, day), ambiguities: [] };
    return { value: null, ambiguities: ['century'] };
  }

  const numeric = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(text);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const yearText = numeric[3];
    const ambiguities: Ambiguity[] = [];
    let day = first;
    let month = second;
    if (first > 12 && second <= 12) { day = first; month = second; }
    else if (second > 12 && first <= 12) { day = second; month = first; }
    else if (order === 'mdy') { day = second; month = first; }
    else if (order === 'dmy') { day = first; month = second; }
    else if (first <= 12 && second <= 12 && first !== second) ambiguities.push('date_order');
    let year: number | null = null;
    if (yearText.length === 4) year = Number(yearText);
    else {
      const { years, assumed } = centuries(Number(yearText), role, now);
      if (assumed && years.length === 1) year = years[0]; else ambiguities.push('century');
    }
    if (ambiguities.length || year === null || !valid(year, month, day)) return { value: null, ambiguities };
    return { value: iso(year, month, day), ambiguities: [] };
  }

  return { value: null, ambiguities: [] };
}

/** MRZ dates are YYMMDD with no separators; the century comes from the field's role. */
export function normaliseMrzDate(digits: string, role: DateRole, now = new Date()): Proposal {
  if (!/^\d{6}$/.test(digits)) return { value: null, ambiguities: [] };
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const { years, assumed } = centuries(Number(digits.slice(0, 2)), role, now);
  const usable = years.filter(year => valid(year, month, day));
  if (assumed && usable.length === 1) return { value: iso(usable[0], month, day), ambiguities: [] };
  return { value: null, ambiguities: ['century'] };
}

export function compareDates(a: string | null, b: string | null): Agreement {
  if (!a || !b) return 'uncertain';
  return a === b ? 'match' : 'different';
}

/** MRZ fills unused positions with '<' and separates names with '<<'. */
export function nameFromMrz(field: string): { surname: string; given: string } {
  const [surnamePart = '', givenPart = ''] = field.split('<<');
  const clean = (part: string) => collapse(part.replace(/</g, ' '));
  return { surname: clean(surnamePart), given: clean(givenPart) };
}

const NAME_NOISE = /\b(mr|mrs|ms|miss|dr|prof|sir|dame|rev)\b/g;

export function normaliseName(raw: string): string {
  return collapse(raw.replace(/[^\p{L}\p{M}'’.\- ]/gu, ' '));
}

function tokens(value: string): string[] {
  return fold(value).replace(NAME_NOISE, ' ').split(' ').filter(Boolean);
}

/**
 * Word-set comparison, so surname-first and given-first orders agree. Anything
 * short of a full match is `uncertain`: initials, a dropped middle name or an
 * extra name all need a person to decide, not a similarity threshold.
 */
export function compareNames(a: string | null, b: string | null): Agreement {
  if (!a || !b) return 'uncertain';
  const left = tokens(a);
  const right = tokens(b);
  if (!left.length || !right.length) return 'uncertain';
  const sorted = (parts: string[]) => [...parts].sort().join(' ');
  if (sorted(left) === sorted(right)) return 'match';

  const initialsOnly = (parts: string[]) => parts.slice(0, -1).every(part => part.length === 1);
  const expands = (short: string[], long: string[]) =>
    short.length <= long.length
    && short[short.length - 1] === long[long.length - 1]
    && short.slice(0, -1).every((part, index) => long[index]?.startsWith(part));
  if ((initialsOnly(left) && expands(left, right)) || (initialsOnly(right) && expands(right, left))) return 'uncertain';

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const shared = left.filter(part => rightSet.has(part));
  const surnameShared = left[left.length - 1] === right[right.length - 1];
  if (surnameShared && shared.length >= 2 && (leftSet.size === shared.length || rightSet.size === shared.length)) return 'uncertain';
  return 'different';
}

const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

export function normaliseAddress(raw: string): string {
  return collapse(raw.replace(/\s*\n\s*/g, ', ').replace(/,\s*,/g, ','));
}

function addressParts(value: string): { postcode: string | null; identifiers: string[] } {
  const postcode = POSTCODE.exec(value);
  const identifiers = fold(value).split(/[,\s]+/).filter(part => /\d/.test(part) && part.length <= 6);
  return { postcode: postcode ? `${postcode[1]}${postcode[2]}`.toUpperCase() : null, identifiers };
}

/**
 * Postcode plus building identifiers. A shared postcode with different building
 * numbers is `uncertain` (a neighbour, a previous flat, a typo), never a match.
 */
export function compareAddresses(a: string | null, b: string | null): Agreement {
  if (!a || !b) return 'uncertain';
  if (fold(a) === fold(b)) return 'match';
  const left = addressParts(a);
  const right = addressParts(b);
  if (!left.postcode || !right.postcode) return 'uncertain';
  if (left.postcode !== right.postcode) return 'different';
  const leftIds = left.identifiers.filter(part => part.toUpperCase() !== left.postcode);
  const rightIds = right.identifiers.filter(part => part.toUpperCase() !== right.postcode);
  if (!leftIds.length || !rightIds.length) return 'uncertain';
  return leftIds.every(part => rightIds.includes(part)) || rightIds.every(part => leftIds.includes(part)) ? 'match' : 'uncertain';
}
