"use client";

import { useId, useState, type FormEvent, type RefObject } from "react";
import type { ProfileField, VaultProfileV1 } from "@/lib/shared/vault";
import { Button, StatusBadge } from "@/components/customer/ui";
import { VaultSearch } from "./vault-search";
import styles from "./vault-entry.module.css";

function EditableDetail({ label, value, type = "text", onSave, encrypted = false }: { label: string; value: string; type?: "text" | "email"; onSave: (value: string, secret: string) => Promise<void>; encrypted?: boolean }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = draft.trim() !== value;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !changed || !draft.trim()) return;
    setBusy(true); setError("");
    try { await onSave(draft.trim(), secret); setEditing(false); setSecret(""); }
    catch { setError("Could not save. Check your Vault passphrase and try again."); }
    finally { setBusy(false); }
  }
  return <div>
    <dt id={`${id}-label`}>{label}</dt>
    <dd>
      <div className={styles.detailRow}>
        {!editing ? <span>{value}</span> : <form id={`${id}-form`} className={styles.detailForm} onSubmit={save}>
          <input aria-labelledby={`${id}-label`} type={type} value={draft} onChange={event => setDraft(event.target.value)} maxLength={512} required autoFocus disabled={busy} onKeyDown={event => { if (event.key === "Escape" && !busy) { setEditing(false); setSecret(""); } }} />
          {changed ? <>
            {encrypted ? <label className={styles.detailSecret}>Vault passphrase<input type="password" value={secret} onChange={event => setSecret(event.target.value)} autoComplete="current-password" required disabled={busy} /></label> : null}
            <Button type="submit" loading={busy} aria-label={`Save ${label}`}>Save</Button>
          </> : null}
          {error ? <p role="alert">{error}</p> : null}
        </form>}
        <button type="button" className={styles.detailEdit} aria-label={`${editing ? "Cancel editing" : "Edit"} ${label}`} aria-pressed={editing} disabled={busy} onClick={() => { setDraft(value); setSecret(""); setError(""); setEditing(current => !current); }}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4.5-1L20 7.5a2.8 2.8 0 0 0-4-4L4.5 15Z" /></svg>
        </button>
      </div>
    </dd>
  </div>;
}

export function VaultWorkspace({ profile, onSaveField, onLock, headingRef }: { profile: VaultProfileV1; onSaveField: (field: ProfileField, value: string, secret: string) => Promise<void>; onLock: () => void; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  const [documents, setDocuments] = useState<string[]>([]);
  const [showDesignation, setShowDesignation] = useState(false);
  const [designation, setDesignation] = useState("");
  const [designations, setDesignations] = useState<string[]>([]);
  const [documentFlowOpen, setDocumentFlowOpen] = useState(false);

  function addDesignation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = designation.trim();
    if (!value) return;
    setDesignations(current => [...current, value]);
    setDesignation("");
    setShowDesignation(false);
  }

  return <section className={styles.unlockedWorkspace} aria-labelledby="vault-workspace-title">
    <div className={styles.demoHeader}>
      <div>
        <p className={styles.eyebrow} data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-1" : undefined}>ZIK IT. LOCK IT. PUT IT IN YOUR POCKET.</p>
        <h2 ref={headingRef} tabIndex={-1} id="vault-workspace-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-2" : undefined}>{"Vault."}</h2>
      </div>
      <Button variant="secondary" onClick={onLock}>Lock Vault</Button>
    </div>

    <p className={styles.demoNotice} data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-3" : undefined}>Your Vault is unlocked on this device. Choose what you want to add.</p>
    <div className={styles.workspaceActions}>
      <button type="button" className={styles.workspaceAction} onClick={() => setShowDesignation(value => !value)} data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-6" : undefined}>
        <span className={styles.workspaceActionIcon} aria-hidden="true">Aa</span>
        <span><strong>Add name or designation</strong><small>Add another name, role or professional title</small></span>
      </button>
      <button type="button" className={styles.workspaceAction} onClick={() => setDocumentFlowOpen(true)} aria-haspopup="dialog" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-16" : undefined}>
        <span className={styles.workspaceActionIcon} aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-4" : undefined}>＋</span>
        <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-5" : undefined}><strong>Add document</strong><small>Choose a file or discover possible proofs with consent</small></span>
      </button>
    </div>

    {showDesignation ? <form className={styles.designationForm} onSubmit={addDesignation}>
      <label htmlFor="vault-designation" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-7" : undefined}>Name or designation</label>
      <div><input id="vault-designation" value={designation} onChange={event => setDesignation(event.target.value)} maxLength={120} autoFocus placeholder="e.g. Dr, Director, preferred name" /><Button type="submit">Add</Button></div>
    </form> : null}

    <div className={styles.workspaceGrid}>
      <section className={styles.workspacePanel} aria-labelledby="vault-identity-title">
        <div className={styles.workspacePanelHeader}><h2 id="vault-identity-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-8" : undefined}>Names &amp; details</h2><StatusBadge>Device-only</StatusBadge></div>
        <dl>
          <EditableDetail label="Legal name" value={profile.legal_name.value} encrypted onSave={(value, secret) => onSaveField("legal_name", value, secret)} />
          <EditableDetail label="Delivery address" value={profile.delivery_address.value} encrypted onSave={(value, secret) => onSaveField("delivery_address", value, secret)} />
          {profile.email ? <EditableDetail label="Email" type="email" value={profile.email.value} encrypted onSave={(value, secret) => onSaveField("email", value, secret)} /> : null}
          {designations.map((value, index) => <EditableDetail key={index} label="Designation" value={value} onSave={async next => { setDesignations(current => current.map((item, i) => i === index ? next : item)); }} />)}
        </dl>
      </section>
      <section className={styles.workspacePanel} aria-labelledby="vault-documents-title">
        <div className={styles.workspacePanelHeader}><h2 id="vault-documents-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-13" : undefined}>Documents</h2><StatusBadge>{documents.length} added</StatusBadge></div>
        {documents.length ? <ul className={styles.workspaceList}>{documents.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul> : <p className={styles.workspaceEmpty} data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-14" : undefined}>No documents yet. Use “Add document” to begin.</p>}
      </section>
    </div>
    <p className={styles.demoNotice} data-local-edit={process.env.NODE_ENV === "development" ? "ve-b78d8dc630c6-15" : undefined}>Document files and added designations are a workspace preview and clear when you lock or refresh. The encrypted profile created during onboarding remains in your device Vault.</p>
    {documentFlowOpen ? <VaultSearch onClose={() => setDocumentFlowOpen(false)} onChooseFile={file => { setDocuments(current => [...current, file.name]); setDocumentFlowOpen(false); }} /> : null}
  </section>;
}
