import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = mkdtempSync(join(tmpdir(), 'zik-scanner-test-'));
const run = (command, args) => spawnSync(command, args, { cwd: fixture, encoding: 'utf8' });
function git(...args) { assert.equal(run('git', args).status, 0, 'Fixture Git operation failed'); }
function check(expected, label) {
  const result = run(process.execPath, ['scripts/scan-secrets.mjs', 'staged']);
  assert.equal(result.status, expected, `${label}: unexpected scan result`);
  console.log(`Passed: ${label}`);
}
try {
  mkdirSync(join(fixture, 'scripts'));
  copyFileSync(join(root, 'scripts/scan-secrets.mjs'), join(fixture, 'scripts/scan-secrets.mjs'));
  copyFileSync(join(root, '.gitleaks.toml'), join(fixture, '.gitleaks.toml'));
  git('init', '-q');
  git('config', 'user.email', 'scanner-test@example.invalid');
  git('config', 'user.name', 'Scanner test');
  writeFileSync(join(fixture, 'README'), 'Scanner fixture\n');
  git('add', 'README'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Clean baseline');
  const clear = () => git('reset', '--mixed', 'HEAD');
  writeFileSync(join(fixture, '.env.production'), 'PUBLIC_LABEL=example\n');
  git('add', '.env.production'); check(1, 'production environment files are blocked'); clear();
  mkdirSync(join(fixture, 'lib/client'), { recursive: true });
  const path = 'lib/client/finance-check.ts';
  writeFileSync(join(fixture, path), 'const ' + 'KEY' + ' = ' + JSON.stringify('zik-finance-application-v1') + ';\n');
  git('add', path); check(0, 'reviewed storage identifier is allowed'); clear();
  const token = 'ghp_' + randomBytes(20).toString('hex');
  writeFileSync(join(fixture, path), `const KEY = "${token}";\n`);
  git('add', path); check(1, 'credential in an allowlisted file is blocked'); clear();
  writeFileSync(join(fixture, 'private-jwk.json'), JSON.stringify({ kty: 'EC', d: randomBytes(32).toString('base64url') }));
  git('add', 'private-jwk.json'); check(1, 'private JWK scalar is blocked'); clear();
  writeFileSync(join(fixture, 'AuthKey_test.p8'), 'fixture only\n');
  git('add', 'AuthKey_test.p8'); check(1, 'Apple private key path is blocked');
} finally { rmSync(fixture, { recursive: true, force: true }); }
