import { PARSER_VERSION, type Ambiguity, type DocumentClass, type ExtractionMethod, type ObservationField } from '@/lib/shared/vault/model';
import { parseMrz } from './mrz';
import { collapse, normaliseAddress, normaliseDate, normaliseName, type DateOrder, type DateRole } from './text';

/**
 * Classification and field proposals from document text.
 *
 * Everything produced here is a proposal for a person to review. The parsers are
 * deliberately narrow: they read the labelled fields of layouts we have tested and
 * say "unknown" otherwise, rather than pattern-matching anything that looks like a
 * date into a date of birth.
 */
export type Candidate = {
  field: ObservationField;
  raw_text: string;
  normalised: string | null;
  ambiguities: Ambiguity[];
  method: ExtractionMethod;
  excerpt: string;
  parser_version: string;
};

export type Classification = { document_class: DocumentClass; matched: string[] };

const SIGNALS: { document_class: Exclude<DocumentClass, 'unknown'>; terms: RegExp[]; weight?: number }[] = [
  { document_class: 'passport', terms: [/\bpassport\b/i, /\bpasseport\b/i, /\bpassport no\b/i, /\bhm passport office\b/i] },
  { document_class: 'driving_licence', terms: [/\bdriving licence\b/i, /\bdriver'?s licence\b/i, /\bdvla\b/i, /\bdriving license\b/i] },
  { document_class: 'address_evidence', terms: [/\bcouncil tax\b/i, /\bstatement\b/i, /\bbill\b/i, /\baccount holder\b/i, /\bsupply address\b/i, /\bliable person\b/i, /\bcorrespondence address\b/i, /\bamount due\b/i, /\bclosing balance\b/i] },
  { document_class: 'certificate', terms: [/\bcertificate\b/i, /\bis to certify\b/i, /\bawarded\b/i, /\bdiploma\b/i, /\bdegree of\b/i] },
  { document_class: 'contract', terms: [/\bagreement\b/i, /\bthis agreement is made\b/i, /\bthe parties\b/i, /\bcontractor\b/i, /\bregistered in england\b/i] },
];

export function classify(text: string): Classification {
  const scores = SIGNALS.map(signal => ({ document_class: signal.document_class, matched: signal.terms.filter(term => term.test(text)).map(term => term.source) }));
  if (parseMrz(text)) scores.find(score => score.document_class === 'passport')?.matched.push('mrz');
  const best = scores.filter(score => score.matched.length).sort((a, b) => b.matched.length - a.matched.length)[0];
  return best && best.matched.length >= 2 ? { document_class: best.document_class, matched: best.matched }
    : best && best.document_class === 'passport' && best.matched.includes('mrz') ? { document_class: 'passport', matched: best.matched }
    : { document_class: 'unknown', matched: best?.matched ?? [] };
}

const excerptAround = (text: string, index: number, length: number) => collapse(text.slice(Math.max(0, index - 60), Math.min(text.length, index + length + 60)));

/**
 * A PDF text layer often arrives as one unbroken line, and OCR of a two-column
 * card interleaves the columns. So a captured value is cut at the next field label
 * rather than trusted to end at a line break.
 */
const STOP_LABELS = /\b(?:Reference|Account holder|Account name|Liable person|Customer name|Supply address|Correspondence address|Billing address|Property|Amount due|Annual charge|Closing balance|Issue date|Statement date|Date of issue|Bill date|Date of birth|Date of expiry|Date de naissance|Date d expiration|Passport No|Given names|Surname|Nationality|Nationalite|Authority|Autorite|Prenoms|Sex|Sexe|Code|Type|SPECIMEN|SYNTHETIC|This is a)\b/i;

const DATE_TOKEN = /\d{1,2}\s+[A-Za-z]{3,9}\.?(?:\s*\/\s*[A-Za-z]{3,9}\.?)?\s+\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/;

const NAME_SHAPE = /^[\p{L}][\p{L}\p{M}'’.\- ]{1,60}$/u;

function captureAfter(text: string, label: RegExp, max = 90): { raw: string; excerpt: string } | null {
  const match = label.exec(text);
  if (!match) return null;
  const from = match.index + match[0].length;
  let after = text.slice(from, from + max);
  const lineBreak = after.indexOf('\n');
  if (lineBreak >= 0) after = after.slice(0, lineBreak);
  const stop = STOP_LABELS.exec(after);
  if (stop && stop.index > 0) after = after.slice(0, stop.index);
  const raw = collapse(after.split(/\s{3,}/)[0] ?? '');
  return raw ? { raw, excerpt: excerptAround(text, match.index, match[0].length + raw.length) } : null;
}

/** Field values are the date inside the capture, not the words that trail it. */
function captureDate(text: string, label: RegExp, max = 60): { raw: string; excerpt: string } | null {
  const found = captureAfter(text, label, max);
  if (!found) return null;
  const token = DATE_TOKEN.exec(found.raw);
  return token ? { raw: token[0], excerpt: found.excerpt } : null;
}

/** A capture that still carries field labels or digits is column bleed, not a name. */
function captureName(text: string, label: RegExp, max = 60): { raw: string; excerpt: string } | null {
  const found = captureAfter(text, label, max);
  if (!found) return null;
  const raw = collapse(found.raw.replace(/[0-9]+/g, ' '));
  return NAME_SHAPE.test(raw) && !STOP_LABELS.test(raw) ? { raw, excerpt: found.excerpt } : null;
}

function firstLine(text: string, max = 60): string {
  const line = collapse(text.split('\n').find(entry => collapse(entry).length > 3) ?? '');
  const stop = STOP_LABELS.exec(line);
  return collapse((stop && stop.index > 3 ? line.slice(0, stop.index) : line).slice(0, max));
}

const labelled = captureAfter;

const dateCandidate = (field: ObservationField, role: DateRole, found: { raw: string; excerpt: string }, method: ExtractionMethod, now: Date, order: DateOrder = 'unknown'): Candidate => {
  const proposal = normaliseDate(found.raw, role, { now, order });
  return { field, raw_text: found.raw, normalised: proposal.value, ambiguities: proposal.ambiguities, method, excerpt: found.excerpt, parser_version: PARSER_VERSION };
};

function passportCandidates(text: string, now: Date): Candidate[] {
  const candidates: Candidate[] = [];
  const mrz = parseMrz(text, now);
  if (mrz) {
    const name = collapse(`${mrz.given_names} ${mrz.surname}`);
    const quality: Ambiguity[] = mrz.composite_check_passed ? [] : ['low_recognition'];
    if (name) candidates.push({ field: 'legal_name', raw_text: `${mrz.surname}<<${mrz.given_names}`, normalised: normaliseName(name), ambiguities: quality, method: 'mrz', excerpt: mrz.lines.join('\n'), parser_version: PARSER_VERSION });
    candidates.push({ field: 'date_of_birth', raw_text: mrz.date_of_birth.raw, normalised: mrz.date_of_birth.check_passed ? mrz.date_of_birth.value.value : null, ambiguities: [...mrz.date_of_birth.value.ambiguities, ...(mrz.date_of_birth.check_passed ? [] : ['low_recognition' as const])], method: 'mrz', excerpt: mrz.lines[1], parser_version: PARSER_VERSION });
    candidates.push({ field: 'expiry_date', raw_text: mrz.expiry_date.raw, normalised: mrz.expiry_date.check_passed ? mrz.expiry_date.value.value : null, ambiguities: [...mrz.expiry_date.value.ambiguities, ...(mrz.expiry_date.check_passed ? [] : ['low_recognition' as const])], method: 'mrz', excerpt: mrz.lines[1], parser_version: PARSER_VERSION });
    if (mrz.document_number.value) candidates.push({ field: 'document_number', raw_text: mrz.document_number.raw, normalised: mrz.document_number.check_passed ? mrz.document_number.value : null, ambiguities: mrz.document_number.check_passed ? [] : ['low_recognition'], method: 'mrz', excerpt: mrz.lines[1], parser_version: PARSER_VERSION });
    if (mrz.issuer) candidates.push({ field: 'issuer', raw_text: mrz.issuer, normalised: mrz.issuer, ambiguities: [], method: 'mrz', excerpt: mrz.lines[0], parser_version: PARSER_VERSION });
  }

  // The printed fields are read as well, so an unreadable MRZ still leaves something to review.
  if (!mrz) {
    // Without a readable MRZ the printed fields are all we have, and on a two-column
    // scan they are easy to misread, so everything from this path goes to review.
    const surname = captureName(text, /Surname\s*\/?\s*(?:Nom)?\s*/i);
    const given = captureName(text, /Given names?\s*\/?\s*(?:Prenoms?)?\s*/i);
    if (surname && given) candidates.push({ field: 'legal_name', raw_text: `${given.raw} ${surname.raw}`, normalised: normaliseName(`${given.raw} ${surname.raw}`), ambiguities: ['low_recognition'], method: 'labelled_field', excerpt: given.excerpt, parser_version: PARSER_VERSION });
    const printedDob = captureDate(text, /Date of birth[^\n]{0,24}?/i, 48);
    if (printedDob) candidates.push({ ...dateCandidate('date_of_birth', 'birth', printedDob, 'labelled_field', now), ambiguities: ['low_recognition'] });
    const printedExpiry = captureDate(text, /Date of expiry[^\n]{0,24}?/i, 48);
    if (printedExpiry) candidates.push({ ...dateCandidate('expiry_date', 'expiry', printedExpiry, 'labelled_field', now), ambiguities: ['low_recognition'] });
  }
  return candidates;
}

/** Field numbers 1, 2, 3, 4b and 8 of the UK photocard layout; other layouts stay unknown. */
function drivingLicenceCandidates(text: string, now: Date): Candidate[] {
  const candidates: Candidate[] = [];
  const surname = /(?:^|\n)\s*1[.)]\s*([^\n]{1,60})/.exec(text);
  const given = /(?:^|\n)\s*2[.)]\s*([^\n]{1,60})/.exec(text);
  if (surname && given) {
    const raw = `${collapse(given[1])} ${collapse(surname[1])}`;
    candidates.push({ field: 'legal_name', raw_text: raw, normalised: normaliseName(raw), ambiguities: [], method: 'labelled_field', excerpt: excerptAround(text, surname.index, surname[0].length), parser_version: PARSER_VERSION });
  }
  const born = /(?:^|\n)\s*3[.)]\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/.exec(text);
  if (born) candidates.push(dateCandidate('date_of_birth', 'birth', { raw: born[1], excerpt: excerptAround(text, born.index, born[0].length) }, 'labelled_field', now, 'dmy'));
  const expiry = /(?:^|\n)\s*4b[.)]\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i.exec(text);
  if (expiry) candidates.push(dateCandidate('expiry_date', 'expiry', { raw: expiry[1], excerpt: excerptAround(text, expiry.index, expiry[0].length) }, 'labelled_field', now, 'dmy'));
  const issued = /(?:^|\n)\s*4a[.)]\s*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i.exec(text);
  if (issued) candidates.push(dateCandidate('issue_date', 'issue', { raw: issued[1], excerpt: excerptAround(text, issued.index, issued[0].length) }, 'labelled_field', now, 'dmy'));
  const address = /(?:^|\n)\s*8[.)]\s*([^\n]{6,140})/.exec(text);
  if (address) candidates.push({ field: 'address', raw_text: collapse(address[1]), normalised: normaliseAddress(address[1]), ambiguities: [], method: 'labelled_field', excerpt: excerptAround(text, address.index, address[0].length), parser_version: PARSER_VERSION });
  const number = /(?:^|\n)\s*5[.)]\s*([A-Z0-9]{8,20})/.exec(text);
  if (number) candidates.push({ field: 'document_number', raw_text: number[1], normalised: number[1], ambiguities: [], method: 'labelled_field', excerpt: excerptAround(text, number.index, number[0].length), parser_version: PARSER_VERSION });
  return candidates;
}

const ADDRESS_LABELS = [/Supply address\s*[:\s]/i, /Correspondence address\s*[:\s]/i, /Billing address\s*[:\s]/i, /Property\s*[:\s]/i, /Address\s*[:\s]/i];
const HOLDER_LABELS = [/Account holder\s*[:\s]/i, /Account name\s*[:\s]/i, /Liable person\s*[:\s]/i, /Customer name\s*[:\s]/i];
const ISSUE_LABELS: [RegExp, DateRole][] = [[/Issue date\s*[:\s]/i, 'issue'], [/Statement date\s*[:\s]/i, 'issue'], [/Date of issue\s*[:\s]/i, 'issue'], [/Bill date\s*[:\s]/i, 'issue']];

function addressEvidenceCandidates(text: string, now: Date): Candidate[] {
  const candidates: Candidate[] = [];
  for (const label of HOLDER_LABELS) {
    const found = captureName(text, label, 70);
    if (!found) continue;
    const normalised = normaliseName(found.raw);
    const initials = /^(?:[A-Z]\.?\s+){1,3}[A-Z][A-Za-z'’-]+$/.test(collapse(found.raw));
    candidates.push({ field: 'legal_name', raw_text: found.raw, normalised, ambiguities: initials ? ['initials_only'] : [], method: 'labelled_field', excerpt: found.excerpt, parser_version: PARSER_VERSION });
    break;
  }
  for (const label of ADDRESS_LABELS) {
    const found = labelled(text, label, 140);
    if (!found) continue;
    candidates.push({ field: 'address', raw_text: found.raw, normalised: normaliseAddress(found.raw), ambiguities: [], method: 'labelled_field', excerpt: found.excerpt, parser_version: PARSER_VERSION });
    break;
  }
  for (const [label, role] of ISSUE_LABELS) {
    const found = captureDate(text, label, 48);
    if (!found) continue;
    candidates.push(dateCandidate('issue_date', role, found, 'labelled_field', now));
    break;
  }
  const issuer = firstLine(text);
  if (issuer) candidates.push({ field: 'issuer', raw_text: issuer, normalised: issuer, ambiguities: [], method: 'pattern', excerpt: excerptAround(text, 0, issuer.length), parser_version: PARSER_VERSION });
  return candidates;
}

function certificateCandidates(text: string, now: Date): Candidate[] {
  const candidates: Candidate[] = [];
  const subject = /(?:is to certify that|has been awarded to|awarded to|this certifies that)\s+([^\n]{2,80})/i.exec(text);
  if (subject) candidates.push({ field: 'legal_name', raw_text: collapse(subject[1]), normalised: normaliseName(subject[1]), ambiguities: [], method: 'pattern', excerpt: excerptAround(text, subject.index, subject[0].length), parser_version: PARSER_VERSION });
  const award = /(?:has been awarded the|awarded the|in recognition of)\s+([^\n]{2,90})/i.exec(text);
  if (award) candidates.push({ field: 'document_title', raw_text: collapse(award[1]), normalised: collapse(award[1]), ambiguities: [], method: 'pattern', excerpt: excerptAround(text, award.index, award[0].length), parser_version: PARSER_VERSION });
  const awarded = /(?:^|\s)Awarded\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i.exec(text);
  // A certificate's date is when it was issued. It is never proposed as a date of birth.
  if (awarded) candidates.push(dateCandidate('issue_date', 'issue', { raw: awarded[1], excerpt: excerptAround(text, awarded.index, awarded[0].length) }, 'pattern', now));
  const issuer = firstLine(text);
  if (issuer) candidates.push({ field: 'issuer', raw_text: issuer, normalised: issuer, ambiguities: [], method: 'pattern', excerpt: excerptAround(text, 0, issuer.length), parser_version: PARSER_VERSION });
  return candidates;
}

/**
 * A contract names several parties and a company address. Neither is evidence about
 * the Vault's owner, so every name is recorded as `other_subject` and no address is
 * proposed at all.
 */
function contractCandidates(text: string, now: Date): Candidate[] {
  const candidates: Candidate[] = [];
  const parties = [...text.matchAll(/(?:^|\n)\s*\d[.)]\s*([A-Z][^\n,(]{2,70}?)(?:\s*,|\s*\(")/g)].slice(0, 6);
  for (const party of parties) {
    const raw = collapse(party[1]);
    if (!raw || raw.length < 3) continue;
    candidates.push({ field: 'other_subject', raw_text: raw, normalised: normaliseName(raw), ambiguities: ['multiple_subjects'], method: 'pattern', excerpt: excerptAround(text, party.index ?? 0, party[0].length), parser_version: PARSER_VERSION });
  }
  const made = /this agreement is made on\s+([^\n]{4,40}?)\s+between/i.exec(text);
  if (made) candidates.push(dateCandidate('issue_date', 'issue', { raw: made[1], excerpt: excerptAround(text, made.index, made[0].length) }, 'pattern', now));
  const title = firstLine(text, 48);
  if (title) candidates.push({ field: 'document_title', raw_text: title, normalised: title, ambiguities: [], method: 'pattern', excerpt: excerptAround(text, 0, title.length), parser_version: PARSER_VERSION });
  return candidates;
}

export type ExtractionInput = { text: string; document_class: DocumentClass; method: ExtractionMethod; now?: Date };

export function extractCandidates({ text, document_class, method, now = new Date() }: ExtractionInput): Candidate[] {
  const byClass = document_class === 'passport' ? passportCandidates(text, now)
    : document_class === 'driving_licence' ? drivingLicenceCandidates(text, now)
    : document_class === 'address_evidence' ? addressEvidenceCandidates(text, now)
    : document_class === 'certificate' ? certificateCandidates(text, now)
    : document_class === 'contract' ? contractCandidates(text, now)
    : [];
  // A PDF text layer is read, not recognised; record that rather than implying OCR.
  return byClass.map(candidate => (method === 'pdf_text_layer' && candidate.method !== 'mrz' ? { ...candidate, method } : candidate));
}
