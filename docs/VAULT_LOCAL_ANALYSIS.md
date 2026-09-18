# Zik Vault — on-device document analysis

What the Vault actually does today, what it measured, and what it cannot do. Written
18 September 2026 against the implementation in this repository.

## The distinction everything else rests on

| Fact | What it means | Where it comes from |
| --- | --- | --- |
| **User assertion** | A value the person typed or corrected | The Vault profile |
| **Extraction** | Text read from a document, with its method and location | An `Observation` |
| **User review** | The person accepted or rejected that reading | `Observation.review` |
| **Corroboration** | Reviewed evidence agrees with the claim's current value | `Claim.supporting_observation_ids` |
| **Authenticity / holder verification** | An authorised checker confirmed the document is genuine and belongs to this person | **Does not exist in this build** |

OCR confidence measures how legible the text was. It is not a measure of whether a
document is real. An MRZ check digit catches a misread character; a forged passport
with a consistent MRZ passes every check in this codebase. Two documents agreeing
shows they agree — not that they are genuine, independent, or the uploader's.

User-facing labels are limited to "Self-entered", "Found in document", "Matches your
details", "Different from your details", "Needs review". Nothing is labelled verified,
because nothing here has been verified.

## How a document is read

1. **Choose** — OS file picker, camera capture, or a folder the user grants through
   `showDirectoryPicker`. A website cannot search a phone; it receives only what the
   person picks. The interface says "Search a folder you choose", never "search my phone".
2. **Consent** — storing and analysing are separate checkboxes. Changing the selection
   clears both, because permission for one set of files is not permission for another.
   Storing without analysing is a supported, complete path.
3. **Validate** — media type, byte size, and decoded pixel count.
4. **Decode** — EXIF orientation applied, downsampled to a 2200px longest edge.
5. **Read** — a PDF text layer where one exists; OCR through Tesseract WASM otherwise.
6. **Classify** — keyword and MRZ signals, or `unknown`.
7. **Propose** — deterministic parsers produce candidates, each with its raw text,
   method, legibility and any ambiguity.
8. **Review** — the person accepts, corrects, keeps their own value, or defers.
9. **Store** — the document, its proposals and the recomputed claims are sealed in one
   transaction.

Everything from step 3 onwards runs in a Web Worker on the device. There is no cloud
fallback: if a local asset is missing, the job fails with that reason.

## Engine and assets

| Package | Version | Licence | Role |
| --- | --- | --- | --- |
| `tesseract.js` | 7.0.0 | Apache-2.0 | OCR worker |
| `tesseract.js-core` | 7.0.0 | Apache-2.0 | WASM cores (LSTM, SIMD, relaxed-SIMD) |
| `@tesseract.js-data/eng` | 1.0.0 | MIT (Apache-2.0 upstream tessdata) | English LSTM model, `4.0.0_best_int` |
| `pdfjs-dist` | 6.3.289 | Apache-2.0 | PDF text layer and page rendering |
| `fake-indexeddb` | 6.2.2 (dev only) | Apache-2.0 | Storage tests in Node |

`npm run prepare` copies these out of `node_modules` into `public/ocr` and
`public/pdf` at install time, so every runtime request is same-origin. Nothing is
fetched from a CDN. The generated directories are gitignored; the script pins the
expected versions and refuses to run if a dependency moves underneath it.

Cold cost on first analysis: roughly 6.8 MB — the worker (109 KB), one WASM core
(~3.8 MB) and the language model (2.9 MB). Cached afterwards. `npm audit` reports no
advisories against any of these four packages; the 15 existing advisories are all in
the pre-existing Next.js, Vite, Vitest, PostCSS and sharp toolchain.

## Measured results

Real OCR, in headless Chromium, over the 18 committed fixtures, with every non-origin
request blocked. Reproduce with `npm run measure:ocr`; field-level expectations are
asserted offline by `tests/extraction-fixtures.test.ts` (19 tests).

Desktop, Apple Silicon, 18 September 2026. Engine warm-up **333 ms**.

| Fixture | Adverse condition | Method | Time | Legibility | Outcome |
| --- | --- | --- | --- | --- | --- |
| `passport-clean.png` | — | OCR | 1090 ms | 92% | Name, DOB, expiry, number, all from the MRZ ✓ |
| `passport-expired.png` | Expired | OCR | 1106 ms | 92% | Expiry read as 2020-04-15 ✓ |
| `passport-rotated.jpg` | Rotated 90° | OCR | 4961 ms | 92% | Recovered at 270°, same values ✓ |
| `passport-degraded.jpg` | Blur + JPEG loss | OCR | 1048 ms | 92% | Same values ✓ |
| `passport-rescan.jpg` | Second scan, MRZ unreadable | OCR | 867 ms | 80% | **No name proposed**; both dates null, all flagged for review ✓ |
| `driving-licence-clean.png` | — | OCR | 691 ms | 86% | Name, DOB, address, licence number ✓ |
| `driving-licence-dob-conflict.png` | Conflicting DOB | OCR | 693 ms | 86% | Read as 1974-03-12, surfaces as a conflict ✓ |
| `utility-bill-recent.pdf` | — | Text layer | 92 ms | n/a | Name, address, issue date, issuer ✓ |
| `utility-bill-stale.pdf` | 16 months old | Text layer | 91 ms | n/a | Date read; fails the 90-day relevance rule ✓ |
| `utility-bill-ambiguous-date.pdf` | `03/04/26` | Text layer | 95 ms | n/a | **No date proposed**, flagged `date_order` ✓ |
| `bank-statement-scanned.pdf` | No text layer | OCR | 892 ms | 94% | Name, address, statement date ✓ |
| `council-tax-initials.png` | Initials only | OCR | 692 ms | 92% | `A. M. RIVERS`, flagged `initials_only` ✓ |
| `certificate.png` | Contains a non-DOB date | OCR | 694 ms | 94% | Award date as issue date; **no DOB proposed** ✓ |
| `contract.pdf` | Two parties, company address | Text layer | 97 ms | n/a | Both parties as separate subjects; **no address, no name claim** ✓ |
| `unreadable.png` | Illegible | OCR | 113 ms | 0% | Nothing proposed; still storable ✓ |
| `corrupt.pdf` | Truncated | — | 72 ms | — | "Invalid PDF structure" ✓ |
| `passport-clean.heic` | HEIC | — | 6 ms | — | Reported undecodable with an export path ✓ |
| `pixel-bomb.png` | 144 MP from 435 KB | — | 521 ms | — | Rejected on decoded pixels before allocation ✓ |

**Off-origin requests during the run: 0.**

Field-level accuracy on the clean fixtures is 100% of expected values, with no wrong
value silently accepted anywhere in the adverse set. That is a statement about 18
synthetic fixtures of layouts we built the parsers against — not a general accuracy
claim about real documents, which has not been measured.

## Browser capability matrix

| Capability | Chromium desktop | Safari / iOS | Firefox | Fallback when absent |
| --- | --- | --- | --- | --- |
| File picker, multi-select | Verified | Expected | Expected | None needed; this is the baseline path |
| Camera capture (`capture`) | Verified as picker | Expected | Expected | Falls back to the ordinary picker |
| Folder picker (`showDirectoryPicker`) | Verified | **Not available** | **Not available** | Button explains it and points to "Add files" |
| OCR (WASM + worker) | **Verified end to end** | Not tested on device | Not tested | Job fails with a stated reason |
| PDF text layer / render | Verified | Expected | Expected | Falls back to OCR of the rendered page |
| HEIC / HEIF decode | Not available | Partially available | Not available | Reported as unsupported with an export path |
| IndexedDB binary storage | Verified | Expected | Expected | Vault reports storage unavailable |
| Storage persistence request | Verified (may be declined) | Declined by default | Prompts | Says storage is not a backup |

"Verified" means exercised by an automated test against the running application.
"Expected" means standard, widely supported, and not yet exercised here.

**Real device testing has not happened.** Playwright in headless Chromium is not an
iPhone. CPU throttling through the Chrome DevTools Protocol does not reach the OCR
worker's thread — it applies to the renderer's main thread only — so desktop
emulation gives no usable signal about phone OCR time or memory. Treat every mobile
row above as unverified until someone runs it on hardware.

## Limits

Conservative and configurable from `lib/client/vault/analysis-protocol.ts`:

| Limit | Value | Why |
| --- | --- | --- |
| Bytes per file | 20 MB | Memory headroom on a phone |
| PDF pages per file | 20 | Bounded work per job |
| Files per batch | 25 | Bounded work per consent |
| Decoded megapixels | 50 | A small file can decode to a huge image |
| OCR longest edge | 2200 px | Beyond this, recognition slows without improving |
| Concurrent OCR jobs | 1 | Parallel OCR on a phone just runs out of memory more slowly |

## Known limitations

- **No encrypted export or import.** The Vault cannot yet be backed up or moved to
  another device. If the browser clears its storage or the passphrase is lost, the
  Vault is gone. This is an unmet completion item.
- **Real devices untested.** See the matrix above.
- **English only.** One language model is shipped. Documents in other languages will
  read poorly, and that will show as low legibility rather than a clear error.
- **UK layouts only.** The driving licence parser targets the UK photocard layout.
  Other layouts classify but propose little.
- **Duplicate detection is exact-bytes plus explicit grouping.** A genuinely
  different photograph of the same document is not detected automatically. Uncertain
  independence goes to the user; perfect duplicate detection is not claimed.
- **A readable forgery passes.** Nothing here checks authenticity or that the holder
  is the subject. That is the later onboarding stage's job.
- **The dev-only demo Vault still shows the old simulated search.** Reachable only
  in development, behind a development key, on `/vault-preview`. It is a design
  review tool and is not part of the real Vault.
