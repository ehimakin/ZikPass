"use client";

import { useEffect, useRef, useState } from "react";
import { Button, StatusBadge } from "@/components/customer/ui";
import type { VaultV2 } from "@/lib/client/vault/session";
import type { Rotation, VaultDocument } from "@/lib/shared/vault/model";
import styles from "./vault-documents.module.css";

const CLASS_LABELS: Record<string, string> = {
  passport: "Passport", driving_licence: "Driving licence", address_evidence: "Address evidence",
  certificate: "Certificate", contract: "Contract", unknown: "Not recognised",
};

const STATE_LABELS: Record<VaultDocument["processing"], string> = {
  stored: "Stored, not read", queued: "Waiting", analysing: "Being read", analysed: "Read",
  failed: "Could not be read", unsupported: "Not supported", cancelled: "Stopped",
};

/** The real document list: what is stored, what was read, and what can be done with each. */
export function DocumentLibrary({ documents, vault, onDelete, onRename, onReanalyse, busy }: {
  documents: VaultDocument[];
  vault: VaultV2;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, label: string) => Promise<void>;
  onReanalyse: (document: VaultDocument, rotation: Rotation) => Promise<void>;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [preview, setPreview] = useState<{ id: string; url: string; type: string } | null>(null);
  const [error, setError] = useState("");
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => { for (const url of objectUrls.current) URL.revokeObjectURL(url); objectUrls.current = []; }, []);

  const term = query.trim().toLowerCase();
  const visible = term ? documents.filter(document =>
    (document.label ?? document.filename).toLowerCase().includes(term)
    || (document.classification ? CLASS_LABELS[document.classification].toLowerCase().includes(term) : false)) : documents;

  async function open(document: VaultDocument) {
    setError("");
    try {
      const bytes = await vault.readDocumentBytes(document.id);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: document.media_type }));
      objectUrls.current.push(url);
      setPreview({ id: document.id, url, type: document.media_type });
    } catch { setError("That document could not be opened."); }
  }

  async function download(document: VaultDocument) {
    setError("");
    try {
      const bytes = await vault.readDocumentBytes(document.id);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: document.media_type }));
      const link = window.document.createElement("a");
      link.href = url;
      link.download = document.label ?? document.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { setError("That document could not be saved."); }
  }

  return <section className={styles.library} aria-labelledby="vault-documents-title">
    <div className={styles.libraryHeader}>
      <h2 id="vault-documents-title">Documents</h2>
      <StatusBadge>{documents.length} stored</StatusBadge>
    </div>

    {documents.length > 1 ? <label className={styles.search}>
      <span className="sr-only">Search your documents</span>
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or document type" />
    </label> : null}

    {error ? <p role="alert" className={styles.error}>{error}</p> : null}

    {!documents.length ? <p className={styles.empty}>No documents yet. Use “Add document” to choose files from this device.</p>
      : !visible.length ? <p className={styles.empty}>Nothing matches “{query}”.</p>
      : <ul className={styles.documents}>
        {visible.map(document => <li key={document.id}>
          <div className={styles.documentMain}>
            <div>
              {renaming === document.id ? <form className={styles.rename} onSubmit={async event => {
                event.preventDefault();
                if (draft.trim()) await onRename(document.id, draft.trim());
                setRenaming(null);
              }}>
                <label htmlFor={`rename-${document.id}`} className="sr-only">New name</label>
                <input id={`rename-${document.id}`} value={draft} maxLength={120} autoFocus onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setRenaming(null); }} />
                <Button type="submit">Save</Button>
              </form> : <strong>{document.label ?? document.filename}</strong>}
              <small>
                {document.classification ? CLASS_LABELS[document.classification] : "Not read"} · {STATE_LABELS[document.processing]}
                {document.analysis?.recognition_quality !== null && document.analysis?.recognition_quality !== undefined ? ` · text legibility ${document.analysis.recognition_quality}%` : ""}
                {document.page_count && document.page_count > 1 ? ` · ${document.page_count} pages` : ""}
                {document.group_id ? " · grouped with another copy" : ""}
              </small>
              {document.failure_reason ? <small className={styles.failure}>{document.failure_reason}</small> : null}
            </div>
          </div>
          <div className={styles.documentActions}>
            <button type="button" onClick={() => void open(document)}>Preview</button>
            <button type="button" onClick={() => void download(document)}>Save a copy</button>
            <button type="button" onClick={() => { setRenaming(document.id); setDraft(document.label ?? document.filename); }}>Rename</button>
            {document.media_type !== "application/pdf" ? <button type="button" disabled={busy} onClick={() => void onReanalyse(document, (((document.rotation + 90) % 360) as Rotation))}>Rotate &amp; read again</button> : null}
            {document.processing !== "analysed" && document.processing !== "unsupported" ? <button type="button" disabled={busy} onClick={() => void onReanalyse(document, document.rotation)}>Read again</button> : null}
            <button type="button" className={styles.danger} onClick={() => setConfirming(document.id)}>Delete</button>
          </div>
          {confirming === document.id ? <div className={styles.confirm} role="alertdialog" aria-label={`Delete ${document.label ?? document.filename}`}>
            <p>Delete this document and everything Zik read from it? Details you confirmed yourself are kept, but they will lose this document&rsquo;s support.</p>
            <div>
              <Button type="button" variant="secondary" onClick={() => setConfirming(null)}>Keep it</Button>
              <Button type="button" onClick={async () => { setConfirming(null); await onDelete(document.id); }}>Delete</Button>
            </div>
          </div> : null}
        </li>)}
      </ul>}

    {preview ? <dialog className={styles.previewModal} ref={node => node?.showModal()} aria-label="Document preview" onClick={event => { if (event.target === event.currentTarget) setPreview(null); }} onCancel={event => { event.preventDefault(); setPreview(null); }}>
      <div className={styles.previewHeader}>
        <p>Preview · this file stays on your device</p>
        <button type="button" aria-label="Close preview" onClick={() => setPreview(null)}>×</button>
      </div>
      {preview.type === "application/pdf"
        // Rendered in a sandboxed frame: a document must never be able to run anything.
        ? <iframe title="Document preview" src={preview.url} sandbox="" className={styles.previewFrame} />
        // A blob: URL for the user's own file. next/image would route it through an optimiser, which is exactly what must not happen here.
        // eslint-disable-next-line @next/next/no-img-element
        : <img alt="Document preview" src={preview.url} className={styles.previewImage} />}
    </dialog> : null}
  </section>;
}
