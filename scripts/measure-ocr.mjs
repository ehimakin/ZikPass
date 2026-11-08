/**
 * Runs the real local pipeline over every fixture in a real browser and records
 * what it read: transcripts for the offline extraction tests, and timings for the
 * handover. All assets are served from one origin and every other origin is
 * blocked, so a passing run is also evidence that nothing left the device.
 *
 * Usage: npm run measure:ocr [-- --throttle 4]
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = join(root, "tests/fixtures/documents");
const throttle = Number(process.argv.find((argument, index) => process.argv[index - 1] === "--throttle") ?? 1);

const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm", ".gz": "application/gzip", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".pdf": "application/pdf", ".heic": "image/heic" };

const manifest = JSON.parse(await readFile(join(fixturesDir, "MANIFEST.json"), "utf8"));
const files = (await readdir(fixturesDir)).filter(name => name !== "MANIFEST.json").sort();

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const offOrigin = [];
await page.route("**/*", async route => {
  const url = new URL(route.request().url());
  if (url.origin !== "https://vault.test") { offOrigin.push(url.href); return route.abort("blockedbyclient"); }
  if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>measure</title>" });
  const local = url.pathname.startsWith("/fixtures/") ? join(fixturesDir, url.pathname.slice("/fixtures/".length)) : join(root, url.pathname);
  try { return route.fulfill({ status: 200, contentType: TYPES[extname(local)] ?? "application/octet-stream", body: await readFile(local) }); }
  catch { return route.fulfill({ status: 404, body: "not found" }); }
});

await page.goto("https://vault.test/");
if (throttle > 1) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: throttle });

const measured = await page.evaluate(async ({ names }) => {
  const { createWorker } = (await import("/node_modules/tesseract.js/dist/tesseract.esm.min.js")).default;
  const pdfjs = await import("/node_modules/pdfjs-dist/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/public/pdf/pdf.worker.min.mjs";

  const warmStarted = performance.now();
  const worker = await createWorker("eng", 1, { workerPath: "/public/ocr/worker.min.js", corePath: "/public/ocr", langPath: "/public/ocr/lang", workerBlobURL: false, gzip: true });
  const warmup_ms = Math.round(performance.now() - warmStarted);

  const rotate = (canvas, degrees) => {
    if (!degrees) return canvas;
    const swap = degrees % 180 !== 0;
    const target = new OffscreenCanvas(swap ? canvas.height : canvas.width, swap ? canvas.width : canvas.height);
    const context = target.getContext("2d");
    context.translate(target.width / 2, target.height / 2);
    context.rotate((degrees * Math.PI) / 180);
    context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return target;
  };
  const recognise = async canvas => {
    const { data } = await worker.recognize(await canvas.convertToBlob({ type: "image/png" }));
    return { text: data.text, confidence: data.confidence };
  };

  const results = [];
  for (const name of names) {
    const started = performance.now();
    const entry = { name, ok: false, text: "", rotation: 0 };
    try {
      const blob = await (await fetch(`/fixtures/${name}`)).blob();
      const bytes = await blob.arrayBuffer();
      entry.bytes = bytes.byteLength;
      if (name.endsWith(".pdf")) {
        const task = pdfjs.getDocument({ data: new Uint8Array(bytes), disableAutoFetch: true });
        const doc = await task.promise;
        const parts = [];
        const confidences = [];
        let layerUsed = false;
        let ocrUsed = false;
        entry.pages = doc.numPages;
        for (let number = 1; number <= Math.min(doc.numPages, 20); number += 1) {
          const pdfPage = await doc.getPage(number);
          const layer = (await pdfPage.getTextContent()).items.map(item => (item.str ?? "") + (item.hasEOL ? "\n" : " ")).join("").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
          if (layer.length > 40) { parts.push(layer); layerUsed = true; pdfPage.cleanup(); continue; }
          const viewport = pdfPage.getViewport({ scale: 2 });
          const canvas = new OffscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
          await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport, canvas }).promise;
          const recognised = await recognise(canvas);
          parts.push(recognised.text);
          confidences.push(recognised.confidence);
          ocrUsed = true;
          pdfPage.cleanup();
        }
        entry.method = ocrUsed && layerUsed ? "mixed" : ocrUsed ? "ocr" : "pdf_text_layer";
        entry.text = parts.join("\n");
        entry.recognition_quality = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null;
        await task.destroy();
      } else {
        const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
        entry.source_pixels = `${bitmap.width}x${bitmap.height}`;
        entry.megapixels = Number(((bitmap.width * bitmap.height) / 1e6).toFixed(1));
        if (entry.megapixels > 50) { bitmap.close(); throw new Error(`rejected: ${entry.megapixels} megapixels exceeds the 50 megapixel limit`); }
        const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
        const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        let best = await recognise(canvas);
        if (best.confidence < 70 && best.text.trim().length >= 30) {
          for (const degrees of [90, 180, 270]) {
            const attempt = await recognise(rotate(canvas, degrees));
            if (attempt.confidence > best.confidence) { best = attempt; entry.rotation = degrees; }
          }
        }
        entry.method = "ocr";
        entry.text = best.text;
        entry.recognition_quality = Math.round(best.confidence);
        entry.pages = 1;
      }
      entry.ok = true;
    } catch (error) { entry.error = String(error?.message ?? error); }
    entry.ms = Math.round(performance.now() - started);
    results.push(entry);
  }
  await worker.terminate();
  return { warmup_ms, results };
}, { names: files });

await browser.close();

const transcripts = Object.fromEntries(measured.results.map(result => [result.name, {
  ok: result.ok, method: result.method ?? null, pages: result.pages ?? null, rotation_applied: result.rotation ?? 0,
  recognition_quality: result.recognition_quality ?? null, error: result.error ?? null, text: result.text ?? "",
}]));

await mkdir(join(root, "tests/fixtures"), { recursive: true });
await writeFile(join(root, "tests/fixtures/ocr-transcripts.json"), `${JSON.stringify({
  note: "Recorded by npm run measure:ocr from real in-browser OCR of the synthetic fixtures. Regenerate after any engine or pipeline change.",
  engine: "tesseract.js 7.0.0 (LSTM, eng 4.0.0_best_int) + pdfjs-dist 6.3.289",
  recorded_at: new Date().toISOString(),
  transcripts,
}, null, 2)}\n`);

const rows = measured.results.map(result => {
  const expected = manifest.fixtures.find(fixture => fixture.file === result.name);
  return { file: result.name, adverse: expected?.adverse ?? null, ok: result.ok, method: result.method ?? null, ms: result.ms, quality: result.recognition_quality ?? null, rotation: result.rotation ?? 0, error: result.error ?? null };
});

console.log(`\nEngine warm-up: ${measured.warmup_ms} ms${throttle > 1 ? ` (main thread throttled ${throttle}x)` : ""}`);
console.table(rows);
console.log(`Off-origin requests attempted during the run: ${offOrigin.length}`);
if (offOrigin.length) console.log(offOrigin.slice(0, 10));
