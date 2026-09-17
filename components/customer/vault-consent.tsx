"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import styles from "./vault-entry.module.css";

export function VaultConsent({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className={`${styles.page} ${styles.consentPage}`} aria-labelledby="vault-permission-title">
    <div className={styles.consentContent}>
      <p className={styles.eyebrow}>ZIK VAULT · YOUR PERMISSION</p>
      <h1 ref={heading} tabIndex={-1} id="vault-permission-title">Your documents.<br />Your boundaries.</h1>
      <p className={styles.consentLead}>Before you enter, choose whether Zik may work with the documents you add to your Vault.</p>
      <div className={styles.permissionDetails}>
        <h2>Read useful details, locally.</h2>
        <p>The proposed permission lets Zik process the contents of documents you choose to add, on your device, to suggest details such as your name, date of birth and address. You would review those suggestions before using them.</p>
        <h2>Your face is not for the machines.</h2>
        <p>This permission excludes facial recognition, face matching, facial age estimation and biometric face templates. A nominated portrait would be for display and optional human comparison, not automated face analysis.</p>
        <h2>A person checks the person.</h2>
        <p>Where identity verification is needed, the planned flow uses a trained human to compare you with your original ID. Extracting a detail does not make it verified.</p>
        <h2>You choose what is shared.</h2>
        <p>This does not grant access to your whole photo library or other files. Searching additional sources or sharing information would require separate permission. Any future external document check would explain what information must leave the device.</p>
      </div>
      <p className={styles.searchPreview}>Prototype permission screen, not a final legal agreement. This demo uses fictional samples only: no document processing, AI, uploads or persistent storage takes place. Your choice resets when you lock or refresh.</p>
      <form onSubmit={event => { event.preventDefault(); if (accepted) onAccept(); }}>
        <label className={styles.searchConsent}><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />I agree to the local-processing scope above and want to enter the demo Vault.</label>
        <div className={styles.searchActions}><Button type="button" variant="secondary" onClick={onDecline}>Not now</Button><Button type="submit" disabled={!accepted}>Accept and enter Vault</Button></div>
      </form>
    </div>
  </section>;
}
