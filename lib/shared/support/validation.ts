import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
const words = new Set(wordlist);
/** Best-effort guard, used before sending and again before storing any free text. */
export function containsSupportSecret(text: string): boolean {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\"(?:privateKeyJwk|private_key|secret_key)\"\s*:|\b(?:password|passphrase|seed phrase|recovery phrase|pin)\s*[:=]\s*\S+/i.test(text)) return true;
  const tokens = text.toLowerCase().normalize('NFKD').match(/[a-z]+/g) ?? [];
  let run: string[] = [];
  for (const token of tokens) {
    if (!words.has(token)) { run = []; continue; }
    run.push(token); if (run.length > 24) run.shift();
    for (const length of [12, 15, 18, 21, 24]) if (run.length >= length && validateMnemonic(run.slice(-length).join(' '), wordlist)) return true;
  }
  return false;
}
export function safeDiagnostic(value: unknown, max = 500): string {
  if (typeof value !== 'string') return '';
  const limited = value.slice(0, max);
  if (containsSupportSecret(limited)) return '[Sensitive diagnostic omitted]';
  return limited.replace(/(?:Bearer\s+)[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/[A-Za-z0-9_=-]{32,}/g, '[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]');
}
export function diagnosticPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '';
  return safeDiagnostic(value.split(/[?#]/)[0], 200);
}
