import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, lstatSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'all';
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('Could not inspect the Git index.');
  return result.stdout;
}
function scan(args) {
  const result = spawnSync('gitleaks', [...args, '--config', join(root, '.gitleaks.toml'), '--redact=100', '--no-banner', '--ignore-gitleaks-allow'], { cwd: root, stdio: 'inherit' });
  if (result.error) throw new Error('Gitleaks is required. On macOS run: brew install gitleaks');
  if (result.status !== 0) throw new Error('Secret scan failed. Review the redacted findings; do not bypass the check.');
}
function guardPaths(files) {
  const forbidden = files.filter(file => {
    const name = file.split('/').at(-1);
    return (/^\.env(?:\.|$)/.test(name) && !/\.example$/.test(name))
      || /\.(p8|p12|pfx|pem|key)$/i.test(name)
      || /(^|\/)(\.secrets|DELETE_BEFORE_PRODUCTION_CREDENTIALS)\//.test(file)
      || /^mobile\/\.expo\//.test(file);
  });
  if (forbidden.length) throw new Error(`Sensitive/generated paths must not be committed:\n${forbidden.join('\n')}`);
}
try {
  if (!['all', 'history', 'staged'].includes(mode)) throw new Error('Use all, history or staged.');
  guardPaths(git(['ls-files', '-z']).split('\0').filter(Boolean));
  if (mode === 'staged') scan(['git', '--pre-commit', '--staged', root]);
  else {
    scan(['git', '--log-opts=--all --full-history HEAD', root]);
    if (mode === 'all') {
      const snapshot = mkdtempSync(join(tmpdir(), 'zik-scan-'));
      try {
        const files = new Set(git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean));
        for (const file of files) {
          const source = join(root, file);
          let stat; try { stat = lstatSync(source); } catch { continue; }
          if (!stat.isFile()) continue; // Do not follow symlinks outside the repo.
          const target = join(snapshot, file); mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target);
        }
        scan(['dir', snapshot]);
      } finally { rmSync(snapshot, { recursive: true, force: true }); }
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
