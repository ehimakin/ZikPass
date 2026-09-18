"use client";

import { useState } from "react";
import { Button } from "@/components/customer/ui";
import { claimFieldFor, proposalStatus, type ProposalStatus } from "@/lib/shared/vault/claims";
import type { Claim, ClaimField, ClaimSource, Observation, VaultDocument } from "@/lib/shared/vault/model";
import styles from "./vault-documents.module.css";

/**
 * Reviewing what Zik found.
 *
 * A proposal never overwrites anything on its own. The user accepts it, corrects
 * it, keeps their own value or leaves it for later, and the label says where each
 * value came from: their own typing, or text read from a document. Accepting text
 * is not a check that the document is genuine, and the wording never implies it is.
 */
const FIELD_LABELS: Record<ClaimField, string> = { legal_name: "Name", date_of_birth: "Date of birth", address: "Address", email: "Email" };

const STATUS_LABELS: Record<ProposalStatus, string> = {
  matches: "Matches your details", different: "Different from your details", missing: "You have not added this yet", uncertain: "Needs review",
};

const AMBIGUITY_NOTES: Record<string, string> = {
  date_order: "This date could be read two ways (day/month or month/day), so Zik has not chosen one.",
  century: "The year is written with two digits, so the century is not certain.",
  multiple_subjects: "This document names more than one person or organisation.",
  initials_only: "The document gives initials rather than full names.",
  low_recognition: "The text was hard to read, so treat this carefully.",
  not_the_subject: "This value may belong to someone else named in the document.",
};

export function ReviewPanel({ observations, claims, documents, onReview, onSetClaim }: {
  observations: Observation[];
  claims: Claim[];
  documents: VaultDocument[];
  onReview: (id: string, decision: "accepted" | "rejected") => Promise<void>;
  onSetClaim: (field: ClaimField, value: string, source: ClaimSource) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = observations.filter(observation => observation.review === "pending" && claimFieldFor(observation.field));
  const documentName = (id: string) => {
    const document = documents.find(entry => entry.id === id);
    return document ? document.label ?? document.filename : "a document";
  };

  if (!pending.length) return null;

  return <section className={styles.review} aria-labelledby="vault-review-title">
    <div className={styles.libraryHeader}>
      <h2 id="vault-review-title">Found in your documents</h2>
      <span className={styles.reviewCount}>{pending.length} to review</span>
    </div>
    <p className={styles.reviewIntro}>
      These are suggestions read from your documents on this device. Nothing changes until you choose.
      Confirming one means the text was read correctly — it is not a check that the document is genuine.
    </p>

    <ul className={styles.proposals}>
      {pending.map(observation => {
        const field = claimFieldFor(observation.field);
        if (!field) return null;
        const claim = claims.find(entry => entry.field === field);
        const status = proposalStatus(field, claim?.value ?? null, observation);
        const usable = observation.normalised !== null;
        return <li key={observation.id} data-status={status}>
          <div className={styles.proposalHead}>
            <div>
              <p className={styles.proposalField}>{FIELD_LABELS[field]}</p>
              <p className={styles.proposalValue}>{observation.normalised ?? <em>Zik could not read this clearly</em>}</p>
            </div>
            <span className={styles.statusPill} data-status={status}>{STATUS_LABELS[status]}</span>
          </div>

          <dl className={styles.proposalDetail}>
            <div><dt>Found in</dt><dd>{documentName(observation.document_id)}{observation.page > 1 ? `, page ${observation.page}` : ""} · {observation.method === "mrz" ? "machine-readable zone" : observation.method === "pdf_text_layer" ? "PDF text" : observation.method === "labelled_field" ? "a labelled field" : "the document text"}</dd></div>
            <div><dt>Your details say</dt><dd>{claim?.value ?? "Nothing yet"}</dd></div>
            <div><dt>Exactly as written</dt><dd className={styles.rawText}>{observation.raw_text}</dd></div>
          </dl>

          {observation.excerpt ? <p className={styles.excerpt}>“{observation.excerpt}”</p> : null}
          {observation.ambiguities.map(ambiguity => <p key={ambiguity} className={styles.ambiguity}>{AMBIGUITY_NOTES[ambiguity] ?? ambiguity}</p>)}

          {editing === observation.id ? <form className={styles.correct} onSubmit={async event => {
            event.preventDefault();
            if (!draft.trim() || busy) return;
            setBusy(true);
            try { await onSetClaim(field, draft.trim(), "user_corrected"); await onReview(observation.id, "rejected"); setEditing(null); }
            finally { setBusy(false); }
          }}>
            <label htmlFor={`correct-${observation.id}`}>Type the correct {FIELD_LABELS[field].toLowerCase()}</label>
            <div>
              <input id={`correct-${observation.id}`} value={draft} maxLength={512} autoFocus onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setEditing(null); }} />
              <Button type="submit" loading={busy}>Save mine</Button>
            </div>
          </form> : <div className={styles.proposalActions}>
            {usable ? <Button type="button" disabled={busy} onClick={async () => {
              setBusy(true);
              // Using a proposal makes it the value and records the user's acceptance of the reading.
              try { if (observation.normalised) await onSetClaim(field, observation.normalised, "accepted_extraction"); await onReview(observation.id, "accepted"); }
              finally { setBusy(false); }
            }}>Use this</Button> : null}
            <Button type="button" variant="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await onReview(observation.id, "rejected"); } finally { setBusy(false); } }}>
              {claim?.value ? "Keep mine" : "Not this"}
            </Button>
            <button type="button" className={styles.linkAction} onClick={() => { setEditing(observation.id); setDraft(observation.normalised ?? claim?.value ?? ""); }}>Correct it</button>
            <button type="button" className={styles.linkAction} onClick={() => setEditing(null)} hidden>Later</button>
          </div>}
        </li>;
      })}
    </ul>
  </section>;
}
