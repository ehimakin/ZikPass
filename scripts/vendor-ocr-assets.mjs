/**
 * Copies pinned OCR/PDF engine assets out of node_modules into public/ so the
 * analysis workers load them same-origin. No CDN is used at runtime: a browser
 * that has fetched these files can extract documents with the network off.
 *
 * Generated output (public/ocr, public/pdf) is gitignored; `npm run prepare`
 * regenerates it after install, including on CI and Vercel.
 */
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

/** Pinned so a dependency bump cannot silently swap the engine under the pipeline. */
const EXPECTED = { "tesseract.js": "7.0.0", "tesseract.js-core": "7.0.0", "pdfjs-dist": "6.3.289", "@tesseract.js-data/eng": "1.0.0" };

function resolvePackage(name) {
  const manifest = require.resolve(`${name}/package.json`, { paths: [root] });
  const version = JSON.parse(require("node:fs").readFileSync(manifest, "utf8")).version;
  if (EXPECTED[name] && version !== EXPECTED[name]) {
    throw new Error(`${name} is ${version}, expected ${EXPECTED[name]}. Update EXPECTED in scripts/vendor-ocr-assets.mjs and re-test OCR accuracy.`);
  }
  return { dir: dirname(manifest), version };
}

const tesseract = resolvePackage("tesseract.js");
const core = resolvePackage("tesseract.js-core");
const pdfjs = resolvePackage("pdfjs-dist");
const engData = resolvePackage("@tesseract.js-data/eng");

/**
 * LSTM-only core + the int-converted "best" English model: ~5.8 MB total rather
 * than the ~14 MB legacy pair, which matters on a phone.
 */
const files = [
  [join(tesseract.dir, "dist/worker.min.js"), "ocr/worker.min.js"],
  // Three LSTM cores: the worker picks relaxed-SIMD, SIMD or plain at runtime by
  // capability, so a browser without relaxed SIMD (Safari) still has a core to load.
  ...["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"].flatMap((name) => [
    [join(core.dir, `${name}.wasm`), `ocr/${name}.wasm`],
    [join(core.dir, `${name}.wasm.js`), `ocr/${name}.wasm.js`],
  ]),
  [join(engData.dir, "4.0.0_best_int/eng.traineddata.gz"), "ocr/lang/eng.traineddata.gz"],
  [join(pdfjs.dir, "build/pdf.worker.min.mjs"), "pdf/pdf.worker.min.mjs"],
];

await rm(join(publicDir, "ocr"), { recursive: true, force: true });
await rm(join(publicDir, "pdf"), { recursive: true, force: true });

for (const [from, to] of files) {
  const target = join(publicDir, to);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(from, target);
}

await writeFile(join(publicDir, "ocr/ASSETS.json"), `${JSON.stringify({
  generated_by: "scripts/vendor-ocr-assets.mjs",
  note: "Generated at install time. Do not edit or commit; regenerate with npm run prepare.",
  sources: {
    "tesseract.js": { version: tesseract.version, license: "Apache-2.0" },
    "tesseract.js-core": { version: core.version, license: "Apache-2.0" },
    "@tesseract.js-data/eng": { version: engData.version, license: "MIT (naptha/tessdata, Apache-2.0 upstream tessdata)" },
    "pdfjs-dist": { version: pdfjs.version, license: "Apache-2.0" },
  },
}, null, 2)}\n`);

const listed = await Promise.all(files.map(async ([, to]) => `${to} (${((await readFile(join(publicDir, to))).byteLength / 1024).toFixed(0)} KB)`));
console.log(`Vendored local OCR assets:\n  ${listed.join("\n  ")}`);
