import { promises as fs } from 'node:fs';
import path from 'node:path';

export type EditorConfig = { files: readonly string[] } | { directories: readonly string[] };
export type EditorScope = EditorConfig | readonly string[];
const roots = new Set(['components', 'app', 'src/components', 'src/app']);
export function validFile(file: string): boolean {
  return /^(src\/)?(components|app)\/.+\.tsx$/.test(file)
    && !file.includes('\\') && !file.includes('\0')
    && !file.split('/').some(part => part === '..' || part === '.' || !part);
}
export function normalizeScope(scope: EditorScope): EditorConfig {
  const config = Array.isArray(scope) ? { files: scope } : scope as EditorConfig;
  if (!config || typeof config !== 'object' || Object.keys(config).length !== 1) throw Error('Invalid editor scope.');
  if ('files' in config) {
    if (!Array.isArray(config.files) || !config.files.length || new Set(config.files).size !== config.files.length || config.files.some(file => typeof file !== 'string' || !validFile(file))) throw Error('Invalid editable file allowlist.');
    return { files: [...config.files] };
  }
  if (!('directories' in config) || !Array.isArray(config.directories) || !config.directories.length || new Set(config.directories).size !== config.directories.length || config.directories.some(dir => !roots.has(dir))) throw Error('Invalid editable directories.');
  return { directories: [...config.directories] };
}
/** Discover on every snapshot/save, so files added after server startup work too. */
export async function resolveFiles(root: string, scope: EditorScope): Promise<string[]> {
  const config = normalizeScope(scope);
  if ('files' in config) return [...config.files];
  const files: string[] = [];
  async function walk(dir: string) {
    const full = path.join(root, dir);
    try {
      if (await fs.realpath(full) !== full) return;
      for (const entry of await fs.readdir(full, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || entry.name.startsWith('.') || ['node_modules', 'devtools', '__tests__'].includes(entry.name)) continue;
        const relative = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await walk(relative);
        else if (entry.isFile() && validFile(relative) && !/\.(test|spec)\.tsx$/.test(entry.name)) files.push(relative);
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  for (const dir of config.directories) await walk(dir);
  return files.sort();
}
