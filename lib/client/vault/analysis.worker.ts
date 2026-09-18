/// <reference lib="webworker" />
import { classify, extractCandidates, type Candidate } from '@/lib/shared/analysis/extract';
import { ANALYSIS_LIMITS, KNOWN_UNSUPPORTED, SUPPORTED_TYPES, type AnalysisCommand, type AnalysisMessage, type AnalysisRequest } from './analysis-protocol';

/**
 * Local document analysis. Everything in this file runs on the device: the engine,
 * the language data and the document bytes. There is no network call here and no
 * cloud fallback — if an asset is missing the job fails with that reason.
 */
declare const self: DedicatedWorkerGlobalScope;

type TesseractWorker = {
  recognize: (image: Blob) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
};

const cancelled = new Set<string>();
let generation = 0;
let ocr: Promise<TesseractWorker> | null = null;

const post = (message: AnalysisMessage, transfer: Transferable[] = []) => self.postMessage(message, transfer);

/** One engine instance, reused across files and torn down on lock. */
async function ocrWorker(): Promise<TesseractWorker> {
  if (!ocr) {
    ocr = import('tesseract.js').then(async loaded => {
      const createWorker = (loaded as unknown as { createWorker?: typeof loaded.createWorker; default?: { createWorker: typeof loaded.createWorker } }).createWorker ?? (loaded as unknown as { default: { createWorker: typeof loaded.createWorker } }).default.createWorker;
      return await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr',
        langPath: '/ocr/lang',
        workerBlobURL: false,
        gzip: true,
      }) as unknown as TesseractWorker;
    });
    ocr.catch(() => { ocr = null; });
  }
  return ocr;
}

async function pdfjs() {
  const loaded = await import('pdfjs-dist');
  loaded.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
  return loaded;
}

function stop(jobId: string, jobGeneration: number): boolean {
  return cancelled.has(jobId) || jobGeneration !== generation;
}

function rotateCanvas(source: OffscreenCanvas, degrees: 0 | 90 | 180 | 270): OffscreenCanvas {
  if (degrees === 0) return source;
  const swap = degrees % 180 !== 0;
  const target = new OffscreenCanvas(swap ? source.height : source.width, swap ? source.width : source.height);
  const context = target.getContext('2d');
  if (!context) throw new Error('canvas_unavailable');
  context.translate(target.width / 2, target.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return target;
}

async function decodeImage(bytes: ArrayBuffer, mediaType: string, rotation: 0 | 90 | 180 | 270): Promise<OffscreenCanvas> {
  const blob = new Blob([bytes], { type: mediaType });
  let bitmap: ImageBitmap;
  try {
    // EXIF orientation is applied here, so a phone photo arrives upright.
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch { throw Object.assign(new Error('This file could not be opened as an image on this device.'), { unsupported: true }); }
  const megapixels = (bitmap.width * bitmap.height) / 1e6;
  if (megapixels > ANALYSIS_LIMITS.max_megapixels) {
    bitmap.close();
    throw new Error(`This image is ${megapixels.toFixed(0)} megapixels, above the ${ANALYSIS_LIMITS.max_megapixels} megapixel limit for analysis on this device.`);
  }
  const scale = Math.min(1, ANALYSIS_LIMITS.ocr_max_edge / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const context = canvas.getContext('2d');
  if (!context) { bitmap.close(); throw new Error('canvas_unavailable'); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return rotateCanvas(canvas, rotation);
}

async function recognise(canvas: OffscreenCanvas): Promise<{ text: string; confidence: number }> {
  const worker = await ocrWorker();
  const { data } = await worker.recognize(await canvas.convertToBlob({ type: 'image/png' }));
  return { text: data.text, confidence: data.confidence };
}

/**
 * A sideways scan reads as noise, so a low-confidence pass with text on it is retried
 * at the other three rotations. A pass with no text at all is simply unreadable, and
 * retrying it would only waste a phone's battery.
 */
async function recogniseUpright(canvas: OffscreenCanvas, job: AnalysisRequest): Promise<{ text: string; confidence: number; rotation: 0 | 90 | 180 | 270 }> {
  const first = await recognise(canvas);
  let best = { ...first, rotation: job.rotation };
  if (first.confidence >= 70 || first.text.trim().length < 30) return best;
  for (const degrees of [90, 180, 270] as const) {
    if (stop(job.job_id, job.generation)) return best;
    const attempt = await recognise(rotateCanvas(canvas, degrees));
    if (attempt.confidence > best.confidence) best = { ...attempt, rotation: ((job.rotation + degrees) % 360) as 0 | 90 | 180 | 270 };
  }
  return best;
}

async function thumbnail(canvas: OffscreenCanvas): Promise<ArrayBuffer | undefined> {
  try {
    const scale = Math.min(1, 480 / Math.max(canvas.width, canvas.height));
    const small = new OffscreenCanvas(Math.max(1, Math.round(canvas.width * scale)), Math.max(1, Math.round(canvas.height * scale)));
    small.getContext('2d')?.drawImage(canvas, 0, 0, small.width, small.height);
    return await (await small.convertToBlob({ type: 'image/jpeg', quality: 0.7 })).arrayBuffer();
  } catch { return undefined; }
}

async function analysePdf(job: AnalysisRequest): Promise<{ text: string; pages: number; method: 'pdf_text_layer' | 'ocr' | 'mixed'; quality: number | null; thumb?: ArrayBuffer }> {
  const engine = await pdfjs();
  const task = engine.getDocument({ data: new Uint8Array(job.bytes), disableAutoFetch: true, isOffscreenCanvasSupported: true });
  let document_;
  try { document_ = await task.promise; }
  catch (error) {
    await task.destroy().catch(() => {});
    const name = (error as { name?: string })?.name;
    if (name === 'PasswordException') throw new Error('This PDF is password protected. Unlock it on your device, then add it again.');
    throw new Error('This PDF could not be read. It may be damaged or incomplete.');
  }
  try {
    const pages = Math.min(document_.numPages, ANALYSIS_LIMITS.max_pdf_pages);
    const parts: string[] = [];
    const confidences: number[] = [];
    let ocrUsed = false;
    let layerUsed = false;
    let thumb: ArrayBuffer | undefined;
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      if (stop(job.job_id, job.generation)) break;
      post({ type: 'progress', job_id: job.job_id, generation: job.generation, stage: 'reading-text', page: pageNumber, pages });
      const page = await document_.getPage(pageNumber);
      const content = await page.getTextContent();
      // pdf.js marks the end of each visual line; keeping those breaks is what stops a
      // captured field from running into the next one.
      const layer = content.items.map(item => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '')).join('').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
      if (layer.length > 40) { parts.push(layer); layerUsed = true; page.cleanup(); continue; }

      post({ type: 'progress', job_id: job.job_id, generation: job.generation, stage: 'recognising', page: pageNumber, pages });
      const viewport = page.getViewport({ scale: 2 });
      const canvas = new OffscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas_unavailable');
      await page.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport, canvas: canvas as unknown as HTMLCanvasElement }).promise;
      const recognised = await recognise(canvas);
      parts.push(recognised.text);
      confidences.push(recognised.confidence);
      ocrUsed = true;
      if (!thumb) thumb = await thumbnail(canvas);
      page.cleanup();
    }
    return {
      text: parts.join('\n'),
      pages: document_.numPages,
      method: ocrUsed && layerUsed ? 'mixed' : ocrUsed ? 'ocr' : 'pdf_text_layer',
      quality: confidences.length ? Math.round(confidences.reduce((total, value) => total + value, 0) / confidences.length) : null,
      thumb,
    };
  } finally { await task.destroy().catch(() => {}); }
}

async function analyse(job: AnalysisRequest): Promise<void> {
  post({ type: 'progress', job_id: job.job_id, generation: job.generation, stage: 'validating' });
  const unsupported = KNOWN_UNSUPPORTED[job.media_type];
  if (unsupported) return post({ type: 'error', job_id: job.job_id, generation: job.generation, reason: unsupported, unsupported: true });
  if (!SUPPORTED_TYPES.includes(job.media_type as typeof SUPPORTED_TYPES[number])) {
    return post({ type: 'error', job_id: job.job_id, generation: job.generation, reason: `${job.media_type || 'This file type'} is not analysed. It is still stored in your Vault.`, unsupported: true });
  }
  if (job.bytes.byteLength > ANALYSIS_LIMITS.max_bytes) {
    return post({ type: 'error', job_id: job.job_id, generation: job.generation, reason: `This file is ${(job.bytes.byteLength / 1048576).toFixed(1)} MB, above the ${ANALYSIS_LIMITS.max_bytes / 1048576} MB limit for analysis.` });
  }

  let text = '';
  let pages = 1;
  let method: 'pdf_text_layer' | 'ocr' | 'mixed' = 'ocr';
  let quality: number | null = null;
  let rotation = job.rotation;
  let thumb: ArrayBuffer | undefined;

  if (job.media_type === 'application/pdf') {
    const result = await analysePdf(job);
    ({ text, method, thumb } = result);
    pages = result.pages;
    quality = result.quality;
  } else {
    post({ type: 'progress', job_id: job.job_id, generation: job.generation, stage: 'decoding' });
    const canvas = await decodeImage(job.bytes, job.media_type, job.rotation);
    if (stop(job.job_id, job.generation)) return post({ type: 'cancelled', job_id: job.job_id, generation: job.generation });
    post({ type: 'progress', job_id: job.job_id, generation: job.generation, stage: 'recognising' });
    const recognised = await recogniseUpright(canvas, job);
    text = recognised.text;
    quality = Math.round(recognised.confidence);
    rotation = recognised.rotation;
    thumb = await thumbnail(canvas);
  }

  if (stop(job.job_id, job.generation)) return post({ type: 'cancelled', job_id: job.job_id, generation: job.generation });

  post({ type: 'progress', job_id: job.job_id, generation: job.generation, stage: 'extracting' });
  const classification = classify(text);
  const candidates: Candidate[] = extractCandidates({ text, document_class: classification.document_class, method: method === 'pdf_text_layer' ? 'pdf_text_layer' : 'labelled_field', now: new Date(job.now) });
  const lowQuality = quality !== null && quality < 70;

  post({
    type: 'result',
    job_id: job.job_id,
    generation: job.generation,
    document_class: classification.document_class,
    classification_matched: classification.matched,
    method,
    page_count: pages,
    recognition_quality: quality,
    applied_rotation: rotation,
    text_length: text.length,
    // Poor legibility is attached to every proposal, so nothing from a bad scan slips through as clean.
    candidates: lowQuality ? candidates.map(candidate => ({ ...candidate, ambiguities: [...new Set([...candidate.ambiguities, 'low_recognition' as const])] })) : candidates,
    text,
    ...(thumb ? { thumbnail: thumb } : {}),
  }, thumb ? [thumb] : []);
}

self.onmessage = async (event: MessageEvent<AnalysisCommand>) => {
  const command = event.data;
  if (command.type === 'cancel') { cancelled.add(command.job_id); return; }
  if (command.type === 'cancel-all') {
    generation = command.generation;
    cancelled.clear();
    const worker = ocr;
    ocr = null;
    if (worker) await worker.then(instance => instance.terminate()).catch(() => {});
    return;
  }
  if (command.generation > generation) generation = command.generation;
  try {
    await analyse(command);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'This file could not be analysed.';
    post({ type: 'error', job_id: command.job_id, generation: command.generation, reason, ...((error as { unsupported?: boolean })?.unsupported ? { unsupported: true } : {}) });
  } finally {
    cancelled.delete(command.job_id);
  }
};
