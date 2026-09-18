import type { Candidate } from '@/lib/shared/analysis/extract';
import type { AnalysisMethod, DocumentClass } from '@/lib/shared/vault/model';

/** Limits are conservative on purpose and configurable from one place. */
export const ANALYSIS_LIMITS = {
  max_bytes: 20 * 1024 * 1024,
  max_pdf_pages: 20,
  max_files_per_batch: 25,
  /** Decoded pixels, not file size: a small file can still be a 144-megapixel image. */
  max_megapixels: 50,
  /** Longest edge fed to OCR. Above this, recognition gets slower without getting better. */
  ocr_max_edge: 2200,
} as const;

export const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/** Formats we can name but cannot decode in a browser, so we say so instead of failing vaguely. */
export const KNOWN_UNSUPPORTED: Record<string, string> = {
  'image/heic': 'HEIC photos cannot be opened by browsers.',
  'image/heif': 'HEIF photos cannot be opened by browsers.',
  'image/avif': 'AVIF is not supported by every browser we target.',
  'application/msword': 'Word documents are not analysed in this release.',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word documents are not analysed in this release.',
};

export type AnalysisRequest = {
  type: 'analyse';
  job_id: string;
  /** Bumped on lock, reset and re-import; a result from an old generation is dropped. */
  generation: number;
  filename: string;
  media_type: string;
  bytes: ArrayBuffer;
  rotation: 0 | 90 | 180 | 270;
  now: string;
};

export type AnalysisProgress = { type: 'progress'; job_id: string; generation: number; stage: 'validating' | 'decoding' | 'reading-text' | 'recognising' | 'extracting'; page?: number; pages?: number; percent?: number };

export type AnalysisSuccess = {
  type: 'result';
  job_id: string;
  generation: number;
  document_class: DocumentClass;
  classification_matched: string[];
  method: AnalysisMethod;
  page_count: number;
  recognition_quality: number | null;
  applied_rotation: 0 | 90 | 180 | 270;
  text_length: number;
  candidates: Candidate[];
  thumbnail?: ArrayBuffer;
  /** Full text stays in the worker's reply only so the caller can seal it; it is never logged. */
  text: string;
};

export type AnalysisFailure = { type: 'error'; job_id: string; generation: number; reason: string; unsupported?: boolean };
export type AnalysisCancelled = { type: 'cancelled'; job_id: string; generation: number };
export type AnalysisMessage = AnalysisProgress | AnalysisSuccess | AnalysisFailure | AnalysisCancelled;
export type AnalysisCommand = AnalysisRequest | { type: 'cancel'; job_id: string } | { type: 'cancel-all'; generation: number };
