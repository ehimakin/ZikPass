"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/customer/ui";
import { ANALYSIS_LIMITS } from "@/lib/client/vault/analysis-protocol";
import { captureDocument, pickFiles, pickFolder, supportsDirectoryPicker, type Selection } from "@/lib/client/vault/import-sources";
import type { JobState } from "./use-vault-workspace";
import styles from "./vault-documents.module.css";

/**
 * Choosing documents, and consenting to what happens to them.
 *
 * Storing and analysing are consented to separately, and changing the selection
 * clears both: a permission given for one set of files is not a permission for a
 * different one. Nothing is read before the analysis box is ticked.
 */
export function DocumentImport({ open, busy, jobs, onClose, onImport, onCancelJob }: {
  open: boolean;
  busy: boolean;
  jobs: JobState[];
  onClose: () => void;
  onImport: (selection: Selection, options: { analyse: boolean }) => Promise<void>;
  onCancelJob: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [consentStore, setConsentStore] = useState(false);
  const [consentAnalyse, setConsentAnalyse] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState("");
  const scan = useRef<AbortController | null>(null);
  const folders = supportsDirectoryPicker();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal?.showModal();
    return () => { modal?.close(); scan.current?.abort(); previous?.focus(); };
  }, [open]);

  if (!open) return null;

  /** Any change of scope invalidates the consent already given. */
  function choose(next: Selection) {
    setSelection(next);
    setConsentStore(false);
    setConsentAnalyse(false);
    setNotice(next.files.length ? "" : "Nothing was selected, so nothing has been added.");
  }

  async function pick(kind: "files" | "camera" | "folder") {
    setNotice("");
    try {
      if (kind === "files") return choose(await pickFiles());
      if (kind === "camera") return choose(await captureDocument());
      setScanning(true);
      scan.current = new AbortController();
      choose(await pickFolder({ signal: scan.current.signal, onProgress: (found, seen) => setNotice(`Looking through the folder you chose — ${seen} file${seen === 1 ? "" : "s"} seen, ${found} usable so far.`) }));
    } catch {
      setNotice("That folder could not be opened. You can still choose files instead.");
    } finally {
      setScanning(false);
      scan.current = null;
    }
  }

  const running = jobs.some(job => job.stage !== "done");
  const finished = jobs.length > 0 && !running;

  return <dialog ref={dialog} className={styles.importModal} aria-labelledby="vault-import-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.importHeader}>
      <div>
        <p className={styles.eyebrow}>ZIK VAULT · ADD DOCUMENTS</p>
        <h2 id="vault-import-title">Add what you choose.</h2>
      </div>
      <button type="button" className={styles.close} aria-label="Close" onClick={onClose} disabled={busy}>×</button>
    </div>

    <p className={styles.importIntro}>
      Zik can only see the files you pick here. A website cannot look through your phone on its own, so nothing is
      searched in the background and nothing is uploaded — reading happens on this device.
    </p>

    {!jobs.length ? <>
      <div className={styles.sources}>
        <button type="button" className={styles.source} onClick={() => void pick("files")} disabled={busy || scanning}>
          <strong>Add files</strong><small>Pick photos or PDFs from this device</small>
        </button>
        <button type="button" className={styles.source} onClick={() => void pick("camera")} disabled={busy || scanning}>
          <strong>Take a document photo</strong><small>Use the camera, or pick a photo if the camera is unavailable</small>
        </button>
        <button type="button" className={styles.source} onClick={() => void pick("folder")} disabled={busy || scanning || !folders}>
          <strong>Search a folder you choose</strong>
          <small>{folders ? "Only the folder you select, and the files inside it" : "Not available in this browser — use “Add files” instead"}</small>
        </button>
      </div>

      {scanning ? <p className={styles.scanning} role="status">
        {notice || "Looking through the folder you chose…"}
        <Button type="button" variant="secondary" onClick={() => scan.current?.abort()}>Stop</Button>
      </p> : null}

      {notice && !scanning ? <p className={styles.notice} role="status">{notice}</p> : null}

      {selection?.files.length ? <section className={styles.scope} aria-labelledby="vault-scope-title">
        <h3 id="vault-scope-title">What you have chosen</h3>
        <p className={styles.scopeSummary}>{selection.descriptor} · {selection.files.length} file{selection.files.length === 1 ? "" : "s"} Zik can read</p>
        <ul className={styles.fileList}>
          {selection.files.map(entry => <li key={entry.path}><span>{entry.path}</span><small>{(entry.file.size / 1024).toFixed(0)} KB</small></li>)}
        </ul>
        {selection.skipped.length ? <div className={styles.skipped}>
          <h4>{selection.skipped.length} file{selection.skipped.length === 1 ? " was" : "s were"} left out</h4>
          <ul>{selection.skipped.map(entry => <li key={entry.path}><span>{entry.path}</span><small>{entry.reason}</small></li>)}</ul>
        </div> : null}
        {selection.truncated ? <p className={styles.notice}>Only the first {ANALYSIS_LIMITS.max_files_per_batch} files are handled at a time. Add the rest afterwards.</p> : null}

        <p className={styles.formats}>Zik reads JPEG, PNG and WebP images, and PDFs — including scanned ones. Up to {ANALYSIS_LIMITS.max_bytes / 1048576} MB and {ANALYSIS_LIMITS.max_pdf_pages} PDF pages per file.</p>

        <label className={styles.consent}>
          <input type="checkbox" checked={consentStore} onChange={event => { setConsentStore(event.target.checked); if (!event.target.checked) setConsentAnalyse(false); }} />
          <span><strong>Keep these in my Vault</strong><small>Stored encrypted on this device. You can delete any of them at any time.</small></span>
        </label>
        <label className={styles.consent}>
          <input type="checkbox" checked={consentAnalyse} disabled={!consentStore} onChange={event => setConsentAnalyse(event.target.checked)} />
          <span><strong>Also read them on this device to suggest details</strong><small>Optional. Zik proposes what it finds, and you decide what to keep. Nothing is shared with anyone by ticking this.</small></span>
        </label>

        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => choose({ ...selection, files: [], skipped: [] })}>Change selection</Button>
          <Button type="button" disabled={!consentStore || busy} loading={busy} onClick={() => void onImport(selection, { analyse: consentAnalyse })}>
            {consentAnalyse ? "Add and read" : "Add without reading"}
          </Button>
        </div>
      </section> : null}
    </> : <section className={styles.progress} aria-labelledby="vault-progress-title">
      <h3 id="vault-progress-title">{running ? "Working on this device" : "Finished"}</h3>
      <ul className={styles.jobs}>
        {jobs.map(job => <li key={job.id} data-state={job.error ? "error" : job.stage === "done" ? "done" : "running"}>
          <span>{job.name}</span>
          <small role={job.stage === "done" ? undefined : "status"}>
            {job.error ? job.error : job.stage === "done" ? "Added" : stageLabel(job)}
          </small>
          {job.stage !== "done" && !job.error ? <button type="button" onClick={() => onCancelJob(job.id)}>Stop</button> : null}
        </li>)}
      </ul>
      {finished ? <div className={styles.actions}><Button type="button" onClick={onClose}>Done</Button></div> : null}
    </section>}
  </dialog>;
}

function stageLabel(job: JobState): string {
  const page = job.pages && job.pages > 1 ? ` (page ${job.page ?? 1} of ${job.pages})` : "";
  switch (job.stage) {
    case "queued": return "Waiting";
    case "validating": return "Checking the file";
    case "decoding": return "Opening the image";
    case "reading-text": return `Reading the text${page}`;
    case "recognising": return `Recognising the text${page}`;
    case "extracting": return "Looking for details";
    default: return "Working";
  }
}
