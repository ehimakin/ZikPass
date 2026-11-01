import { spawnSync } from 'node:child_process';
import { existsSync, chmodSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const existing = git('config', '--get', 'core.hooksPath').stdout.trim();
if (existing && existing !== '.githooks') throw new Error(`Existing hooksPath (${existing}) must be integrated manually; it was not changed.`);
for (const hook of ['pre-commit', 'pre-push']) {
  const previous = git('rev-parse', '--git-path', `hooks/${hook}`).stdout.trim();
  if (!existing && existsSync(resolve(root, previous))) throw new Error(`Existing ${hook} hook must be integrated manually; it was not changed.`);
  chmodSync(join(root, '.githooks', hook), 0o755);
}
const result = git('config', '--local', 'core.hooksPath', '.githooks');
if (result.status !== 0) throw new Error('Unable to configure hooks.');
console.log('Secret-scanning pre-commit and pre-push hooks installed for this checkout.');
