"use client";

import { useEffect, useId, useState, type FormEvent, type RefObject } from "react";
import type { VaultV2 } from "@/lib/client/vault/session";
import type { ClaimField, VaultProfileV2 } from "@/lib/shared/vault/model";
import { Button, StatusBadge } from "@/components/customer/ui";
import { DocumentImport } from "./vault/document-import";
import { DocumentLibrary } from "./vault/document-library";
import { ReadinessBanner } from "./vault/readiness-banner";
import { ReviewPanel } from "./vault/review-panel";
import { useVaultWorkspace } from "./vault/use-vault-workspace";
import styles from "./vault-entry.module.css";

function EditableDetail({ label, value, type = "text", onSave, provenance }: { label: string; value: string; type?: "text" | "email" | "date"; onSave: (value: string) => Promise<void>; provenance: string }) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = draft.trim() !== value;

  useEffect(() => { setDraft(value); }, [value]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !changed || !draft.trim()) return;
    setBusy(true); setError("");
    try { await onSave(draft.trim()); setEditing(false); }
    catch { setError("Could not save. Your Vault may have locked; unlock it and try again."); }
    finally { setBusy(false); }
  }

  return <div>
    <dt id={`${id}-label`}>{label}</dt>
    <dd>
      <div className={styles.detailRow}>
        {!editing ? <span>{value || <em>Not added yet</em>}</span> : <form id={`${id}-form`} className={styles.detailForm} onSubmit={save}>
          <input aria-labelledby={`${id}-label`} type={type} value={draft} onChange={event => setDraft(event.target.value)} maxLength={512} required autoFocus disabled={busy} onKeyDown={event => { if (event.key === "Escape" && !busy) setEditing(false); }} />
          {changed ? <Button type="submit" loading={busy} aria-label={`Save ${label}`}>Save</Button> : null}
          {error ? <p role="alert">{error}</p> : null}
        </form>}
        <button type="button" className={styles.detailEdit} aria-label={`${editing ? "Cancel editing" : "Edit"} ${label}`} aria-pressed={editing} disabled={busy} onClick={() => { setDraft(value); setError(""); setEditing(current => !current); }}>
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4.5-1L20 7.5a2.8 2.8 0 0 0-4-4L4.5 15Z" /></svg>
        </button>
      </div>
      <small className={styles.provenance}>{provenance}</small>
    </dd>
  </div>;
}

/**
 * The unlocked Vault.
 *
 * Everything here is real: the documents are stored encrypted on the device, the
 * proposals come from reading them locally, and locking stops any analysis still
 * running. Labels distinguish what the user typed from what was read out of a
 * document, and nothing claims a document has been verified.
 */
export function VaultWorkspace({ vault, profile, onLock, headingRef }: { vault: VaultV2; profile: VaultProfileV2; onLock: () => void; headingRef?: RefObject<HTMLHeadingElement | null> }) {
  const workspace = useVaultWorkspace(vault, onLock);
  const { state } = workspace;
  const current = state.profile ?? profile;
  const [importOpen, setImportOpen] = useState(false);
  const [showDesignation, setShowDesignation] = useState(false);
  const [designation, setDesignation] = useState("");
  const [dismissedSignature, setDismissedSignature] = useState<string | undefined>();

  useEffect(() => { void vault.readDismissal().then(setDismissedSignature).catch(() => undefined); }, [vault]);

  const readiness = state.readiness;
  const signature = readiness ? `${readiness.status}:${readiness.evidence.primary_document_id}:${readiness.evidence.supporting_document_id}:${readiness.reasons.join(",")}` : "";

  async function addDesignation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = designation.trim();
    if (!value) return;
    await vault.saveDesignations([...current.designations.map(entry => entry.value), value]);
    await workspace.refresh();
    setDesignation("");
    setShowDesignation(false);
  }

  const provenanceFor = (field: ClaimField) => {
    const claim = state.claims.find(entry => entry.field === field);
    if (!claim?.value) return "Not added yet";
    const supported = claim.supporting_observation_ids.length;
    const conflicting = claim.conflicting_observation_ids.length;
    const base = claim.source === "self_entered" ? "Self-entered" : claim.source === "user_corrected" ? "Self-entered (you corrected a suggestion)" : "From a document you confirmed";
    if (conflicting) return `${base} · ${conflicting} document${conflicting === 1 ? "" : "s"} disagree${conflicting === 1 ? "s" : ""}`;
    if (supported) return `${base} · matches ${supported} document${supported === 1 ? "" : "s"} you confirmed`;
    return base;
  };

  return <section className={styles.unlockedWorkspace} aria-labelledby="vault-workspace-title">
    <div className={styles.demoHeader}>
      <div>
        <p className={styles.eyebrow}>ZIK IT. LOCK IT. PUT IT IN YOUR POCKET.</p>
        <h2 ref={headingRef} tabIndex={-1} id="vault-workspace-title">{"Vault."}</h2>
      </div>
      <Button variant="secondary" onClick={workspace.lock}>Lock Vault</Button>
    </div>

    <p className={styles.demoNotice}>Your Vault is unlocked on this device. Everything you add is encrypted here and is not uploaded.</p>

    {state.error ? <p role="alert" className={styles.workspaceError}>{state.error}</p> : null}

    <div className={styles.workspaceActions}>
      <button type="button" className={styles.workspaceAction} onClick={() => setShowDesignation(value => !value)}>
        <span className={styles.workspaceActionIcon} aria-hidden="true">Aa</span>
        <span><strong>Add name or designation</strong><small>Add another name, role or professional title</small></span>
      </button>
      <button type="button" className={styles.workspaceAction} onClick={() => setImportOpen(true)} aria-haspopup="dialog">
        <span className={styles.workspaceActionIcon} aria-hidden="true">＋</span>
        <span><strong>Add document</strong><small>Choose files from this device, with or without reading them</small></span>
      </button>
    </div>

    {showDesignation ? <form className={styles.designationForm} onSubmit={addDesignation}>
      <label htmlFor="vault-designation">Name or designation</label>
      <div><input id="vault-designation" value={designation} onChange={event => setDesignation(event.target.value)} maxLength={120} autoFocus placeholder="e.g. Dr, Director, preferred name" /><Button type="submit">Add</Button></div>
    </form> : null}

    <div className={styles.workspaceGrid}>
      <section className={styles.workspacePanel} aria-labelledby="vault-identity-title">
        <div className={styles.workspacePanelHeader}><h2 id="vault-identity-title">Names &amp; details</h2><StatusBadge>Device-only</StatusBadge></div>
        <dl>
          <EditableDetail label="Legal name" value={current.legal_name.value} provenance={provenanceFor("legal_name")} onSave={value => workspace.setClaim("legal_name", value, "user_corrected")} />
          <EditableDetail label="Date of birth" type="date" value={current.date_of_birth?.value ?? ""} provenance={provenanceFor("date_of_birth")} onSave={value => workspace.setClaim("date_of_birth", value, "user_corrected")} />
          <EditableDetail label="Delivery address" value={current.delivery_address.value} provenance={provenanceFor("address")} onSave={value => workspace.setClaim("address", value, "user_corrected")} />
          {current.email ? <EditableDetail label="Email" type="email" value={current.email.value} provenance={provenanceFor("email")} onSave={value => workspace.setClaim("email", value, "user_corrected")} /> : null}
          {current.designations.map((entry, index) => <EditableDetail
            key={`${entry.value}-${index}`}
            label="Designation"
            value={entry.value}
            provenance="Self-entered"
            onSave={async value => {
              const next = current.designations.map(item => item.value);
              next[index] = value;
              await vault.saveDesignations(next);
              await workspace.refresh();
            }}
          />)}
        </dl>
      </section>

      <DocumentLibrary
        documents={state.documents}
        vault={vault}
        busy={state.busy}
        onDelete={workspace.removeDocument}
        onRename={workspace.renameDocument}
        onReanalyse={workspace.reanalyse}
      />
    </div>

    <ReviewPanel
      observations={state.observations}
      claims={state.claims}
      documents={state.documents}
      onReview={workspace.review}
      onSetClaim={(field, value, source) => workspace.setClaim(field, value, source)}
    />

    {readiness ? <ReadinessBanner
      readiness={readiness}
      dismissed={dismissedSignature === signature}
      onDismiss={() => { setDismissedSignature(signature); void vault.saveDismissal(signature).catch(() => undefined); }}
    /> : null}

    {state.storage?.quota ? <p className={styles.storageNote}>
      Using {Math.round((state.storage.usage ?? 0) / 1048576)} MB of about {Math.round(state.storage.quota / 1048576)} MB this browser allows.
      {state.storage.persisted ? " This browser has agreed to keep it." : " A browser can clear this storage, so it is not a backup."}
    </p> : null}

    <DocumentImport
      open={importOpen}
      busy={state.busy}
      jobs={state.jobs}
      onCancelJob={workspace.cancelJob}
      onClose={() => { setImportOpen(false); void workspace.refresh(); }}
      onImport={async (selection, options) => { await workspace.importSelection(selection, options); }}
    />
  </section>;
}
