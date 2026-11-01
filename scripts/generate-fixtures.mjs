/**
 * Regenerates the synthetic document fixtures in tests/fixtures/documents.
 * Everything here is invented: no real person, document or issuer. Run with
 * `npm run fixtures`. Dates are fixed so tests can pin a clock rather than
 * depending on the day they run.
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as t from "./fixture-templates/documents.mjs";

const out = join(dirname(fileURLToPath(import.meta.url)), "../tests/fixtures/documents");
const SUBJECT = t.SUBJECT;

/** Minimal solid-colour PNG encoder: a few KB on disk, 144M pixels when decoded. */
function solidPng(width, height, [r, g, b]) {
  const row = Buffer.alloc(width * 3 + 1);
  for (let x = 0; x < width; x += 1) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit truecolour
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
const context1x = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
const page = await context.newPage();

async function shot(name, html, { type = "png", quality, selector = ".doc" } = {}) {
  await page.setContent(html, { waitUntil: "load" });
  const buffer = await page.locator(selector).screenshot({ type, ...(quality === undefined ? {} : { quality }) });
  await writeFile(join(out, name), buffer);
  return buffer;
}

async function pdf(name, html) {
  await page.setContent(html, { waitUntil: "load" });
  const buffer = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
  await writeFile(join(out, name), buffer);
}

/** A scanned PDF: the page is a bitmap, so there is no text layer to read. */
async function scannedPdf(name, html) {
  await page.setContent(html, { waitUntil: "load" });
  const image = await page.locator(".doc").screenshot({ type: "jpeg", quality: 82 });
  await page.setContent(`<!doctype html><style>@page{size:A4;margin:0}html,body{margin:0}img{width:100%;display:block}</style><img src="data:image/jpeg;base64,${image.toString("base64")}">`, { waitUntil: "load" });
  await writeFile(join(out, name), await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } }));
}

/** Reads width/height straight out of the PNG IHDR chunk. */
function pngSize(buffer) { return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }; }

/** Re-photographs an existing fixture: rotation and JPEG loss, as a phone camera would. */
async function rephotograph(name, source, { rotate = 0, quality = 70, scale = 1, blur = 0 } = {}) {
  const file = await readFile(join(out, source));
  const { width, height } = pngSize(file);
  const swap = rotate % 180 !== 0;
  const flat = await context1x.newPage();
  await flat.setContent(`<!doctype html><style>html,body{margin:0;background:#2b2b2b}
    .frame{position:relative;overflow:hidden;width:${swap ? height : width}px;height:${swap ? width : height}px}
    img{position:absolute;left:${((swap ? height : width) - width) / 2}px;top:${((swap ? width : height) - height) / 2}px;
      width:${width}px;height:${height}px;transform:rotate(${rotate}deg) scale(${scale});filter:blur(${blur}px)}
    </style><div class="frame" id="f"><img src="data:image/png;base64,${file.toString("base64")}"></div>`, { waitUntil: "load" });
  await writeFile(join(out, name), await flat.locator("#f").screenshot({ type: "jpeg", quality }));
  await flat.close();
}

const manifest = [];
const record = (file, entry) => manifest.push({ file, ...entry });

// --- Primary photo ID -------------------------------------------------------
await shot("passport-clean.png", t.passport());
record("passport-clean.png", { document_class: "passport", adverse: null, expect: { legal_name: "ALEX MORGAN RIVERS", date_of_birth: "1994-03-12", expiry_date: "2030-04-15", document_number: SUBJECT.passportNumber, mrz_checks: "pass" } });

await shot("passport-expired.png", t.passport({ expiry: "200415", expiryText: "15 APR / AVR 20" }));
record("passport-expired.png", { document_class: "passport", adverse: "expired primary evidence", expect: { legal_name: "ALEX MORGAN RIVERS", date_of_birth: "1994-03-12", expiry_date: "2020-04-15", mrz_checks: "pass" } });

await rephotograph("passport-rotated.jpg", "passport-clean.png", { rotate: 90, quality: 78 });
record("passport-rotated.jpg", { document_class: "passport", adverse: "rotated 90 degrees", expect: { legal_name: "ALEX MORGAN RIVERS", date_of_birth: "1994-03-12", expiry_date: "2030-04-15" } });

await rephotograph("passport-degraded.jpg", "passport-clean.png", { quality: 38, blur: 1.4 });
record("passport-degraded.jpg", { document_class: "passport", adverse: "blurred, heavy JPEG loss", expect: { note: "recognition quality low; proposals must reach review, not silent acceptance" } });

await rephotograph("passport-rescan.jpg", "passport-clean.png", { rotate: 2, quality: 72, scale: 0.97 });
record("passport-rescan.jpg", { document_class: "passport", adverse: "second scan of the same passport", expect: { independence: "must not count as separate evidence from passport-clean.png" } });

// --- Secondary photo ID -----------------------------------------------------
await shot("driving-licence-clean.png", t.drivingLicence());
record("driving-licence-clean.png", { document_class: "driving_licence", adverse: null, expect: { legal_name: "ALEX MORGAN RIVERS", date_of_birth: "1994-03-12", expiry_date: "2031-06-15", address: SUBJECT.address } });

await shot("driving-licence-dob-conflict.png", t.drivingLicence({ dob: "12.03.1974" }));
record("driving-licence-dob-conflict.png", { document_class: "driving_licence", adverse: "DOB conflicts with the passport", expect: { date_of_birth: "1974-03-12", outcome: "material conflict -> needs_review" } });

// --- Address evidence -------------------------------------------------------
const bill = (date, reference) => t.statement({ issuer: "Severn Light & Power", title: "Energy statement", dateLabel: "Issue date", date, reference, lines: [["Account holder", SUBJECT.display], ["Supply address", SUBJECT.address], ["Amount due", "GBP 74.20"]], note: "This is a synthetic specimen created for software testing. Severn Light & Power is not a real company." });
await pdf("utility-bill-recent.pdf", bill("30 August 2026", "SLP-4471-9920"));
record("utility-bill-recent.pdf", { document_class: "address_evidence", adverse: null, text_layer: true, expect: { legal_name: SUBJECT.display, address: SUBJECT.address, issue_date: "2026-08-30", issuer: "Severn Light & Power" } });

await pdf("utility-bill-stale.pdf", bill("2 May 2025", "SLP-4471-7714"));
record("utility-bill-stale.pdf", { document_class: "address_evidence", adverse: "older than the 90-day relevance window", text_layer: true, expect: { issue_date: "2025-05-02", outcome: "does not satisfy recent address evidence" } });

await pdf("utility-bill-ambiguous-date.pdf", bill("03/04/26", "SLP-4471-8102"));
record("utility-bill-ambiguous-date.pdf", { document_class: "address_evidence", adverse: "ambiguous day/month/year date", text_layer: true, expect: { issue_date: null, outcome: "ambiguous date -> review, never a silent guess" } });

await scannedPdf("bank-statement-scanned.pdf", t.statement({ issuer: "Harbour Mutual Bank", title: "Current account statement", dateLabel: "Statement date", date: "14 August 2026", reference: "40-11-92 / 87654321", lines: [["Account name", SUBJECT.display], ["Correspondence address", SUBJECT.address], ["Closing balance", "GBP 1,284.06"]], note: "This is a synthetic specimen created for software testing. Harbour Mutual Bank is not a real bank." }));
record("bank-statement-scanned.pdf", { document_class: "address_evidence", adverse: "scanned PDF with no text layer; requires OCR", text_layer: false, expect: { legal_name: SUBJECT.display, address: SUBJECT.address, issue_date: "2026-08-14" } });

await shot("council-tax-initials.png", t.statement({ issuer: "Bristol City Council", title: "Council tax bill", dateLabel: "Issue date", date: "11 August 2026", reference: "CT-9920-3311", lines: [["Liable person", "A. M. RIVERS"], ["Property", SUBJECT.address], ["Annual charge", "GBP 1,612.00"]], note: "This is a synthetic specimen created for software testing." }));
record("council-tax-initials.png", { document_class: "address_evidence", adverse: "name given as initials only", expect: { legal_name: "A. M. RIVERS", outcome: "uncertain name match -> review, never an automatic merge" } });

// --- Other documents --------------------------------------------------------
await shot("certificate.png", t.certificate());
record("certificate.png", { document_class: "certificate", adverse: "contains a date that is not a date of birth", expect: { legal_name: SUBJECT.display, issuer: "Bristol Institute of Technology", document_date: "2018-07-06", date_of_birth: null } });

await pdf("contract.pdf", t.contract());
record("contract.pdf", { document_class: "contract", adverse: "two parties and a company address", text_layer: true, expect: { subjects: [SUBJECT.display, "Northbank Studios Ltd"], outcome: "company address must not become the user's address; subjects must not merge" } });

await shot("unreadable.png", t.unreadable());
record("unreadable.png", { document_class: "unknown", adverse: "no legible text", expect: { proposals: 0, outcome: "honest 'nothing readable' result, still storable as a file" } });

// --- Malformed and oversized ------------------------------------------------
const truncated = (await readFile(join(out, "contract.pdf"))).subarray(0, 2048);
await writeFile(join(out, "corrupt.pdf"), truncated);
record("corrupt.pdf", { document_class: null, adverse: "truncated PDF", expect: { outcome: "readable error, other files in the batch still complete" } });

await writeFile(join(out, "pixel-bomb.png"), solidPng(12000, 12000, [200, 30, 30]));
record("pixel-bomb.png", { document_class: null, adverse: "144 megapixels from a few KB on disk", expect: { outcome: "rejected by the decoded-pixel bound before allocation" } });

// HEIC needs a platform encoder. macOS has one; elsewhere the fixture is skipped
// and the unsupported-format path is covered by the committed copy of this file.
try {
  execFileSync("sips", ["-s", "format", "heic", join(out, "passport-clean.png"), "--out", join(out, "passport-clean.heic")], { stdio: "ignore" });
  record("passport-clean.heic", { document_class: "passport", adverse: "HEIC: no browser decoder", expect: { outcome: "reported as unsupported with an export path, never silently skipped" } });
} catch {
  console.warn("Skipped passport-clean.heic (sips unavailable); the committed fixture is unchanged.");
}

await context1x.close();
await context.close();
await browser.close();

await writeFile(join(out, "MANIFEST.json"), `${JSON.stringify({
  note: "Synthetic fixtures generated by scripts/generate-fixtures.mjs. No real person, document or organisation is represented. Regenerate with `npm run fixtures`.",
  subject: SUBJECT,
  fixtures: manifest,
}, null, 2)}\n`);

console.log(`Generated ${manifest.length} fixtures in tests/fixtures/documents`);
