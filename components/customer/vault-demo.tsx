"use client";

import { useEffect, useRef, useState } from "react";
import { VaultConsent } from "./vault-consent";
import { VaultSearch } from "./vault-search";
import { Button } from "./ui";
import styles from "./vault-entry.module.css";

const proofs = [
  { title: "Proof of address", detail: "A statement or household bill", sample: "Example utility bill · 1 Example Street" },
  { title: "DBS certificate", detail: "Your background-check document", sample: "Example certificate · No check performed" },
  { title: "National Insurance Number", detail: "A letter or document showing your NI number", sample: "Example NI document · SAMPLE ONLY" },
  { title: "Photo ID", detail: "Passport or driving licence", sample: "Example passport · Alex Example" }
];

/** Disposable UI fixtures only. Never accepts real documents or asserts verification. */
export function VaultDemo({ onLock }: { onLock: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [profile, setProfile] = useState({ name: "", dob: "", address: "" });
  const [searchOpen, setSearchOpen] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (accepted) heading.current?.focus(); }, [accepted]);
  if (!accepted) return <VaultConsent onAccept={() => setAccepted(true)} onDecline={onLock} />;
  return <section className={`${styles.page} ${styles.demoVault}`} aria-labelledby="demo-vault-title">
    <div className={styles.demoHeader}>
      <div><p className={styles.eyebrow} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-1" : undefined}>{"ZIK IT. LOCK IT. PUT IT IN YOUR POCKET."}</p>
        <h1 ref={heading} tabIndex={-1} id="demo-vault-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-2" : undefined}>{"Zik Vault."}</h1></div>
      <Button variant="secondary" onClick={onLock}>Lock Vault</Button>
    </div>
    <p className={styles.demoNotice} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-3" : undefined}>{"Zik Vault"}</p>
    <div className={styles.vaultWorkspace}>
    <aside className={styles.personaCard} aria-labelledby="persona-title">
      <div className={styles.personaHeader}><h2 id="persona-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-8" : undefined}>Your persona</h2><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-9" : undefined}>UNVERIFIED · DEMO</span></div>
      <div className={styles.personaPhoto}>
        <svg viewBox="0 0 80 80" width="72" height="72" fill="currentColor" aria-hidden="true"><circle cx="40" cy="26" r="15" /><path d="M12 73v-8a28 28 0 0 1 56 0v8Z" /></svg>
        <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-10" : undefined}>Portrait placeholder</span>
      </div>
      <p className={styles.personaNote} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-11" : undefined}>No facial recognition. A photo would be checked by a person.</p>
      <div className={styles.personaFields}>
        <label>Name<input autoComplete="off" maxLength={120} placeholder="e.g. Alex Example" value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))} /></label>
        <label>Date of birth<input type="date" autoComplete="off" value={profile.dob} onChange={event => setProfile(current => ({ ...current, dob: event.target.value }))} /></label>
        <label>Address<textarea autoComplete="off" rows={2} maxLength={300} placeholder="e.g. 1 Example Street" value={profile.address} onChange={event => setProfile(current => ({ ...current, address: event.target.value }))} /></label>
      </div>
      <p className={styles.personaNote} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-12" : undefined}>Try fictional details. These fields are editable examples, not extracted or verified data, and clear when you lock or refresh.</p>
    </aside>
    <div className={styles.documentColumn}>
    <div className={styles.emptyVault}>
      <button type="button" className={styles.addDocumentButton} aria-label="Add demo document" onClick={() => setAdded(current => [...current, `Demo document ${current.length + 1}`])} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-13" : undefined}><span aria-hidden="true">＋</span></button>
      <h2>{added.length === 0 ? "Add *any type of document." : "Your collection is taking shape."}</h2>
      <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-4" : undefined}>{"*txt, docx, pdf, jpg, jpeg, png. Webp can 0121"}</p>
      <p role="status" aria-live="polite">{added.length} sample {added.length === 1 ? "document" : "documents"} · 0 verified proofs</p>
      <p>or <button type="button" className={styles.searchLink} aria-haspopup="dialog" onClick={() => setSearchOpen(true)} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-7" : undefined}>search</button> for specific matches</p>
    </div>
    <section className={styles.personaExplainer} aria-labelledby="persona-explainer-title">
      <h2 id="persona-explainer-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-14" : undefined}>What is a persona?</h2>
      <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-15" : undefined}>Your unique digital declaration of personhood. Yours alone, built to resist tampering and impersonation.</p>
      <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-16" : undefined}>Each verified proof adds a layer of confidence. One document per proof type, updated when you replace it.</p>
      <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-17" : undefined}>Together, these layers could support your Zik ID online and in person. A confidence rating would reflect the strength of your identity evidence.</p>
      <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-18" : undefined}>An optional avatar represents you. A human checks likeness, without facial recognition.</p>
      <span className={styles.personaConcept} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-19" : undefined}>The vision for Zik ID. Ratings are not yet calculated.</span>
    </section>
    </div>
    </div>
    <h2 className={styles.proofsHeading} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-5" : undefined}>Helpful persona proofs</h2>
    <div className={styles.proofGrid}>{proofs.map(proof => {
      const present = added.includes(proof.title);
      return <article key={proof.title} className={styles.proofCard}>
        <span className={styles.proofLabel}>{present ? "SAMPLE · UNVERIFIED" : "NOT ADDED"}</span>
        <h3>{proof.title}</h3><p>{present ? proof.sample : proof.detail}</p>
        <Button variant="secondary" onClick={() => setAdded(current => present ? current.filter(item => item !== proof.title) : [...current, proof.title])}>
          {present ? `Remove ${proof.title} sample` : `Add ${proof.title} sample`}
        </Button>
      </article>;
    })}</div>
    <p className={styles.demoNotice} data-local-edit={process.env.NODE_ENV === "development" ? "ve-24dad8668fe5-6" : undefined}>Locking or refreshing clears this demo. Real document import and in-person verification will come later.</p>
    {searchOpen && <VaultSearch onClose={() => setSearchOpen(false)} />}
  </section>;
}
