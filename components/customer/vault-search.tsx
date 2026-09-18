"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "./ui";
import styles from "./vault-entry.module.css";

const documentTypes = ["Date of birth", "Current or previous addresses", "Occupation / employment (CVs)", "Passport", "Driving licence", "Proof of address", "Qualifications", "Certificates", "DBS certificate", "National Insurance Number", "Contracts", "Receipts"];
const sources = ["Camera roll / photo library", "Documents library", "Files / folders", "Other resources I choose"];

/** Permission-flow prototype. No device access, AI processing, uploads or persistence. */
export function VaultSearch({ onClose, onChooseFile }: { onClose: () => void; onChooseFile?: (file: File) => void }) {
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [consent, setConsent] = useState(false);
  const [results, setResults] = useState<string[] | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    const overflow = document.body.style.overflow;
    modal?.showModal();
    document.body.style.overflow = "hidden";
    return () => { modal?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => { if (results !== null) resultsHeading.current?.focus(); }, [results]);
  function toggle(value: string, values: string[], set: (values: string[]) => void) {
    set(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
    setConsent(false);
  }
  function search(event: FormEvent) {
    event.preventDefault();
    if (!consent || !locations.length || (!types.length && !other.trim())) return;
    setResults([...types, ...(other.trim() ? [other.trim()] : [])]);
  }
  return <dialog ref={dialog} className={styles.searchModal} aria-labelledby="vault-search-title" aria-describedby="vault-search-description" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <div className={styles.searchHeader}>
      <div><p className={styles.eyebrow} data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-1" : undefined}>ZIK VAULT · SEARCH PREVIEW</p><h2 id="vault-search-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-2" : undefined}>Find what matters.</h2></div>
      <button type="button" className={styles.searchClose} aria-label="Close document search" onClick={onClose} data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-3" : undefined}>×</button>
    </div>
    <p id="vault-search-description" className={styles.searchIntro} data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-4" : undefined}>Choose what to look for and where. The planned AI search will help you find possible matches, then let you review what belongs in your Vault.</p>
    <p className={styles.searchPreview} data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-5" : undefined}>Demo only: no photos or files are accessed, no AI runs, and nothing is uploaded. The selections below simulate a permission request.</p>
    {results === null ? <form onSubmit={search}>
      {onChooseFile ? <div className={styles.directDocumentChoice}>
        <div><strong data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-9" : undefined}>Choose a document yourself</strong><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-10" : undefined}>Add one specific file without searching any library.</p></div>
        <label className={styles.directDocumentButton}>Choose file<input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt" onChange={event => { const file = event.target.files?.[0]; if (file) onChooseFile(file); }} /></label>
      </div> : null}
      {onChooseFile ? <div className={styles.searchDivider}><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-11" : undefined}>or use the AI discovery preview</span></div> : null}
      <fieldset className={styles.searchGroup}><legend>What would you like to find?</legend>
        <div className={styles.searchOptions}>{documentTypes.map(type => <label key={type}><input type="checkbox" checked={types.includes(type)} onChange={() => toggle(type, types, setTypes)} />{type}</label>)}</div>
        <label className={styles.customSearch}>Something else<input type="text" maxLength={100} value={other} onChange={event => { setOther(event.target.value); setConsent(false); }} placeholder="e.g. insurance policies or warranties" /></label>
      </fieldset>
      <fieldset className={styles.searchGroup}><legend>Where would you like to search?</legend>
        <div className={styles.searchSources}>{sources.map(source => <label key={source}><input type="checkbox" checked={locations.includes(source)} onChange={() => toggle(source, locations, setLocations)} />{source}</label>)}</div>
        <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-6" : undefined}>You would choose the specific photos, files or supported resources to share through your device’s permission controls. Nothing would be added to your Vault without your review.</p>
      </fieldset>
      <label className={styles.searchConsent}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Allow a demo AI search for these proof details in my selected sources.</label>
      <div className={styles.searchActions}><Button type="button" variant="secondary" onClick={onClose}>Not now</Button><Button type="submit" disabled={!consent || !locations.length || (!types.length && !other.trim())}>Show demo matches</Button></div>
    </form> : <div>
      <div role="status" className={styles.searchResultStatus}><h3 ref={resultsHeading} tabIndex={-1}>{results.length} example {results.length === 1 ? "match" : "matches"}</h3><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-7" : undefined}>Illustrative results only. Your device was not searched.</p></div>
      <ul className={styles.searchResults}>{results.map((result, index) => <li key={`${index}-${result}`}><strong>{result}</strong><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-c70c751f7c7c-8" : undefined}>Fictional example · unverified · not added</span></li>)}</ul>
      <div className={styles.searchActions}><Button type="button" variant="secondary" onClick={() => { setResults(null); setConsent(false); requestAnimationFrame(() => dialog.current?.querySelector<HTMLInputElement>('input')?.focus()); }}>Change search</Button><Button type="button" onClick={onClose}>Done</Button></div>
    </div>}
  </dialog>;
}
