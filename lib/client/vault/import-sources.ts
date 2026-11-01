"use client";

import { ANALYSIS_LIMITS, KNOWN_UNSUPPORTED, SUPPORTED_TYPES } from './analysis-protocol';

/**
 * Where documents come from.
 *
 * A website cannot search a phone. It can only receive what the person picks
 * through their own operating system, so these are the three real entry points:
 * pick files, take a photo, or grant access to one folder. The wording in the UI
 * has to match that, which is why nothing here is called "search my phone".
 */
export type SelectedFile = { file: File; path: string };

export type Selection = {
  files: SelectedFile[];
  source: 'files' | 'camera' | 'folder';
  descriptor: string;
  /** Changes whenever the chosen set changes, which is what invalidates a consent. */
  fingerprint: string;
  skipped: { path: string; reason: string }[];
  truncated: boolean;
};

const ACCEPT = [...SUPPORTED_TYPES, 'image/heic', 'image/heif'].join(',');

function element(attributes: Record<string, string>): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  for (const [name, value] of Object.entries(attributes)) input.setAttribute(name, value);
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  return input;
}

/** Resolves with an empty list when the picker is dismissed. */
function choose(input: HTMLInputElement): Promise<File[]> {
  return new Promise(resolve => {
    const settle = (files: File[]) => { input.remove(); resolve(files); };
    input.addEventListener('change', () => settle([...(input.files ?? [])]), { once: true });
    input.addEventListener('cancel', () => settle([]), { once: true });
    document.body.append(input);
    input.click();
  });
}

export async function pickFiles(): Promise<Selection> {
  const files = await choose(element({ multiple: 'true', accept: ACCEPT }));
  return describe(files.map(file => ({ file, path: file.name })), 'files');
}

export async function captureDocument(): Promise<Selection> {
  // Browsers without camera capture fall back to the ordinary picker on their own.
  const files = await choose(element({ accept: 'image/*', capture: 'environment' }));
  return describe(files.map(file => ({ file, path: file.name })), 'camera');
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

type DirectoryHandle = { name: string; values: () => AsyncIterableIterator<FileSystemHandleLike> };
type FileSystemHandleLike = { kind: 'file' | 'directory'; name: string; getFile?: () => Promise<File>; values?: () => AsyncIterableIterator<FileSystemHandleLike> };

export type FolderScanOptions = { signal?: AbortSignal; maxFiles?: number; onProgress?: (found: number, scanned: number) => void };

/**
 * Scans only the folder the user picked, and only as far as the limits allow. The
 * scan is abortable and never leaves the chosen subtree.
 */
export async function pickFolder({ signal, maxFiles = ANALYSIS_LIMITS.max_files_per_batch, onProgress }: FolderScanOptions = {}): Promise<Selection> {
  if (!supportsDirectoryPicker()) throw new Error('directory_picker_unsupported');
  const picker = (window as unknown as { showDirectoryPicker: (options?: { mode?: string }) => Promise<DirectoryHandle> }).showDirectoryPicker;
  let root: DirectoryHandle;
  try { root = await picker({ mode: 'read' }); }
  catch { return describe([], 'folder'); }

  const found: SelectedFile[] = [];
  const skipped: { path: string; reason: string }[] = [];
  let scanned = 0;
  let truncated = false;

  const walk = async (handle: DirectoryHandle, prefix: string, depth: number): Promise<void> => {
    if (signal?.aborted || found.length >= maxFiles || depth > 6) { if (found.length >= maxFiles) truncated = true; return; }
    for await (const entry of handle.values()) {
      if (signal?.aborted) return;
      if (found.length >= maxFiles) { truncated = true; return; }
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory' && entry.values) { await walk(entry as DirectoryHandle, path, depth + 1); continue; }
      if (entry.kind !== 'file' || !entry.getFile) continue;
      scanned += 1;
      onProgress?.(found.length, scanned);
      const file = await entry.getFile();
      const verdict = check(file);
      if (verdict) skipped.push({ path, reason: verdict });
      else found.push({ file, path });
    }
  };

  await walk(root, '', 0);
  return { ...describe(found, 'folder', root.name), skipped: [...skipped], truncated };
}

/** Says plainly why a file will not be analysed, rather than dropping it quietly. */
export function check(file: File): string | null {
  const type = file.type || guessType(file.name);
  if (KNOWN_UNSUPPORTED[type]) return KNOWN_UNSUPPORTED[type];
  if (!SUPPORTED_TYPES.includes(type as typeof SUPPORTED_TYPES[number])) return `${type || 'This file type'} is not one Zik can read.`;
  if (file.size > ANALYSIS_LIMITS.max_bytes) return `This file is ${(file.size / 1048576).toFixed(1)} MB, above the ${ANALYSIS_LIMITS.max_bytes / 1048576} MB limit.`;
  if (file.size === 0) return 'This file is empty.';
  return null;
}

const EXTENSIONS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', heic: 'image/heic', heif: 'image/heif' };
export function guessType(name: string): string {
  return EXTENSIONS[name.split('.').pop()?.toLowerCase() ?? ''] ?? '';
}

export function describe(files: SelectedFile[], source: Selection['source'], folderName?: string): Selection {
  const usable: SelectedFile[] = [];
  const skipped: { path: string; reason: string }[] = [];
  for (const entry of files.slice(0, ANALYSIS_LIMITS.max_files_per_batch)) {
    const verdict = check(entry.file);
    if (verdict) skipped.push({ path: entry.path, reason: verdict });
    else usable.push(entry);
  }
  const descriptor = source === 'camera' ? 'One photo you just took'
    : source === 'folder' ? `The folder “${folderName ?? 'you chose'}” and the files inside it`
    : `${files.length} file${files.length === 1 ? '' : 's'} you chose`;
  return {
    files: usable,
    source,
    descriptor,
    fingerprint: fingerprint(files),
    skipped,
    truncated: files.length > ANALYSIS_LIMITS.max_files_per_batch,
  };
}

/** Identifies the selection, not its contents; no file bytes are read to build it. */
export function fingerprint(files: SelectedFile[]): string {
  return files.map(entry => `${entry.path}:${entry.file.size}:${entry.file.lastModified}`).sort().join('|').slice(0, 512) || 'empty';
}
