"use client";

import type { AnalysisMessage, AnalysisProgress, AnalysisSuccess } from './analysis-protocol';

/**
 * Owns the analysis worker. One worker, one job at a time — a phone running several
 * OCR passes at once just runs out of memory more slowly. Locking the Vault raises
 * the generation and terminates the worker, so nothing started before a lock can
 * write afterwards.
 */
export type AnalysisOutcome =
  | { status: 'analysed'; result: AnalysisSuccess }
  | { status: 'failed'; reason: string; unsupported: boolean }
  | { status: 'cancelled' };

export class AnalysisClient {
  private worker: Worker | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private generationValue = 1;

  get generation(): number { return this.generationValue; }

  private ensure(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module', name: 'zik-vault-analysis' });
    }
    return this.worker;
  }

  /** Jobs run one after another; the returned promise settles for this job only. */
  analyse(input: { job_id: string; filename: string; media_type: string; bytes: ArrayBuffer; rotation?: 0 | 90 | 180 | 270; onProgress?: (progress: AnalysisProgress) => void }): Promise<AnalysisOutcome> {
    const generation = this.generationValue;
    const run = this.queue.then(() => new Promise<AnalysisOutcome>(resolve => {
      const worker = this.ensure();
      const settle = (outcome: AnalysisOutcome) => { worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError); resolve(outcome); };
      const onMessage = (event: MessageEvent<AnalysisMessage>) => {
        const message = event.data;
        if (message.job_id !== input.job_id) return;
        if (message.generation !== generation || generation !== this.generationValue) return settle({ status: 'cancelled' });
        if (message.type === 'progress') return input.onProgress?.(message);
        if (message.type === 'result') return settle({ status: 'analysed', result: message });
        if (message.type === 'cancelled') return settle({ status: 'cancelled' });
        settle({ status: 'failed', reason: message.reason, unsupported: Boolean(message.unsupported) });
      };
      const onError = () => settle({ status: 'failed', reason: 'Document analysis could not start on this device.', unsupported: false });
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage({ type: 'analyse', job_id: input.job_id, generation, filename: input.filename, media_type: input.media_type, bytes: input.bytes, rotation: input.rotation ?? 0, now: new Date().toISOString() }, [input.bytes]);
    }));
    this.queue = run.catch(() => undefined);
    return run;
  }

  cancel(jobId: string): void { this.worker?.postMessage({ type: 'cancel', job_id: jobId }); }

  /** Called on lock, reset and Vault deletion. */
  stopAll(): void {
    this.generationValue += 1;
    this.worker?.terminate();
    this.worker = undefined;
    this.queue = Promise.resolve();
  }
}
