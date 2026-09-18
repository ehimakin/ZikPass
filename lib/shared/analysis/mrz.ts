import { nameFromMrz, normaliseMrzDate, type Proposal } from './text';

/**
 * ICAO 9303 machine-readable zone.
 *
 * Check digits are a transcription check. They catch a misread character; they do
 * not show that a passport is genuine, unexpired or the holder's. A forged booklet
 * with a consistent MRZ passes every test in this file.
 */
export type MrzField<T> = { raw: string; value: T; check_passed: boolean | null };

export type MrzResult = {
  format: 'TD3' | 'TD2';
  lines: [string, string];
  document_type: string;
  issuer: string;
  nationality: string;
  surname: string;
  given_names: string;
  document_number: MrzField<string>;
  date_of_birth: MrzField<Proposal>;
  expiry_date: MrzField<Proposal>;
  sex: string;
  composite_check_passed: boolean;
  repaired: boolean;
};

const WEIGHTS = [7, 3, 1];

export function checkDigit(input: string): string {
  let sum = 0;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const value = character === '<' ? 0 : /[0-9]/.test(character) ? Number(character) : /[A-Z]/.test(character) ? character.charCodeAt(0) - 55 : NaN;
    if (Number.isNaN(value)) return '';
    sum += value * WEIGHTS[index % 3];
  }
  return String(sum % 10);
}

/** Characters OCR confuses between the alphabetic and numeric halves of a line. */
const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G' };

const digitsOnly = (value: string) => value.replace(/./g, character => TO_DIGIT[character] ?? character);
const lettersOnly = (value: string) => value.replace(/./g, character => TO_LETTER[character] ?? character);

/** Normalises the characters a scan reliably confuses, then re-checks. Nothing else is altered. */
function repairLine2(line: string, width: number): { line: string; repaired: boolean } {
  const original = line;
  const chars = line.split('');
  const numericRanges = width === 44 ? [[9, 10], [13, 20], [21, 28], [42, 44]] : [[9, 10], [13, 20], [21, 28], [35, 36]];
  const letterRanges = width === 44 ? [[10, 13]] : [[10, 13]];
  for (const [from, to] of numericRanges) for (let i = from; i < to && i < chars.length; i += 1) if (chars[i] !== '<') chars[i] = digitsOnly(chars[i]);
  for (const [from, to] of letterRanges) for (let i = from; i < to && i < chars.length; i += 1) if (chars[i] !== '<') chars[i] = lettersOnly(chars[i]);
  const repaired = chars.join('');
  return { line: repaired, repaired: repaired !== original };
}

/** Pulls candidate MRZ lines out of whatever else OCR produced around them. */
export function findMrzLines(text: string): { lines: [string, string]; format: 'TD3' | 'TD2' } | null {
  const candidates = text.split(/\r?\n/).map(line => line.replace(/\s+/g, '').toUpperCase()).filter(line => /^[A-Z0-9<]{30,50}$/.test(line) && line.includes('<'));
  for (const width of [44, 36] as const) {
    for (let index = 0; index < candidates.length - 1; index += 1) {
      const first = candidates[index];
      const second = candidates[index + 1];
      if (Math.abs(first.length - width) <= 2 && Math.abs(second.length - width) <= 2 && first.startsWith('P')) {
        return { lines: [first.padEnd(width, '<').slice(0, width), second.padEnd(width, '<').slice(0, width)], format: width === 44 ? 'TD3' : 'TD2' };
      }
    }
  }
  return null;
}

export function parseMrz(text: string, now = new Date()): MrzResult | null {
  const found = findMrzLines(text);
  if (!found) return null;
  const width = found.format === 'TD3' ? 44 : 36;
  const [line1] = found.lines;
  const { line: line2, repaired } = repairLine2(found.lines[1], width);

  const numberRaw = line2.slice(0, 9);
  const numberCheck = line2[9];
  const dobRaw = line2.slice(13, 19);
  const dobCheck = line2[19];
  const expiryRaw = line2.slice(21, 27);
  const expiryCheck = line2[27];
  const personal = width === 44 ? line2.slice(28, 42) : line2.slice(28, 35);
  const personalCheck = width === 44 ? line2[42] : line2[35];
  const compositeCheck = width === 44 ? line2[43] : null;

  const { surname, given } = nameFromMrz(line1.slice(5));
  const composite = `${numberRaw}${numberCheck}${dobRaw}${dobCheck}${expiryRaw}${expiryCheck}${personal}${personalCheck}`;

  return {
    format: found.format,
    lines: [line1, line2],
    document_type: line1.slice(0, 1),
    issuer: line1.slice(2, 5).replace(/</g, ''),
    nationality: line2.slice(10, 13).replace(/</g, ''),
    surname,
    given_names: given,
    document_number: { raw: numberRaw, value: numberRaw.replace(/</g, ''), check_passed: checkDigit(numberRaw) === numberCheck },
    date_of_birth: { raw: dobRaw, value: normaliseMrzDate(dobRaw, 'birth', now), check_passed: checkDigit(dobRaw) === dobCheck },
    expiry_date: { raw: expiryRaw, value: normaliseMrzDate(expiryRaw, 'expiry', now), check_passed: checkDigit(expiryRaw) === expiryCheck },
    sex: line2.slice(20, 21).replace(/</g, ''),
    composite_check_passed: compositeCheck === null ? false : checkDigit(composite) === compositeCheck,
    repaired,
  };
}
