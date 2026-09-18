"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, StatusBadge } from "@/components/customer/ui";
import { VaultV2 } from "@/lib/client/vault/session";
import { loadWalletState } from "@/lib/client/wallet-client";
import { claimSetDigest, evidenceDigest, isStale, pendingOnboardingAdapter } from "@/lib/shared/onboarding/adapter";
import { evaluateReadiness, nextAction, READINESS_POLICY_VERSION, type ReadinessResult } from "@/lib/shared/policy/zik-id-readiness";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";
import { randomId } from "@/lib/shared/vault/crypto";
import type { Application, Claim, Observation, VaultDocument } from "@/lib/shared/vault/model";
import styles from "./vault-documents.module.css";

/**
 * The Zik ID application.
 *
 * The furthest this can go is a saved application waiting for onboarding. There is
 * no path from here to an issued ID, because no issuer is authorised yet and a
 * local flag must never stand in for one.
 */
type Loaded = { documents: VaultDocument[]; observations: Observation[]; claims: Claim[]; readiness: ReadinessResult; application: Application | undefined };

export function ApplicationScreen() {
  const vault = useRef(new VaultV2());
  const [secret, setSecret] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [data, setData] = useState<Loaded | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"evidence" | "confirm" | "done">("evidence");

  const load = useCallback(async () => {
    const [documents, observations, claims, application, wallet] = await Promise.all([
      vault.current.listDocuments(), vault.current.listObservations(), vault.current.listClaims(), vault.current.readApplication(), loadWalletState(),
    ]);
    const readiness = evaluateReadiness({ documents, observations, claims, pass: { active: getWalletStatusSnapshot(wallet).credential_active }, now: new Date() });
    const snapshot = buildSnapshot(claims, documents, observations, readiness);
    let current = application;
    // Evidence can change after an application is saved; say so rather than presenting stale facts.
    if (application && application.state === "pending_onboarding" && isStale(application, { ...snapshot, policy_version: READINESS_POLICY_VERSION })) {
      current = await vault.current.saveApplication({ ...application, state: "stale", stale_reason: "The documents or details behind this application changed after it was submitted.", updated_at: new Date().toISOString() });
    }
    setData({ documents, observations, claims, readiness, application: current });
    setStep(current?.state === "pending_onboarding" || current?.state === "stale" ? "done" : "evidence");
  }, []);

  useEffect(() => () => vault.current.lock(), []);

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (unlocking) return;
    setUnlocking(true);
    setError("");
    try { await vault.current.unlock(secret); setSecret(""); await load(); }
    catch { setError("That key did not unlock this Vault."); }
    finally { setUnlocking(false); }
  }

  if (!data) return <section className={styles.applyPage} aria-labelledby="apply-title">
    <p className={styles.eyebrow}>ZIK ID</p>
    <h1 id="apply-title">Apply for Zik ID</h1>
    <p className={styles.applyIntro}>Unlock your Vault to see what your application would include. Everything stays on this device.</p>
    <form className={styles.unlockForm} onSubmit={unlock}>
      <label htmlFor="apply-key">Vault key</label>
      <div>
        <input id="apply-key" type="password" value={secret} minLength={12} maxLength={1024} autoComplete="current-password" onChange={event => setSecret(event.target.value)} placeholder="Enter your key" />
        <Button type="submit" loading={unlocking}>Unlock</Button>
      </div>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </form>
    <p className={styles.applyFoot}><Link href="/vault">Back to your Vault</Link></p>
  </section>;

  const { readiness, claims, documents, observations, application } = data;
  const snapshot = buildSnapshot(claims, documents, observations, readiness);
  const evidenceDocuments = snapshot.evidence_snapshot.map(entry => documents.find(document => document.id === entry.document_id)).filter((entry): entry is VaultDocument => Boolean(entry));

  return <section className={styles.applyPage} aria-labelledby="apply-title">
    <p className={styles.eyebrow}>ZIK ID</p>
    <h1 id="apply-title">{application ? "Your Zik ID application" : "Apply for Zik ID"}</h1>

    {application?.state === "pending_onboarding" ? <div className={styles.pendingNotice} role="status">
      <StatusBadge>Waiting for identity checks</StatusBadge>
      <p>
        Your application is saved on this device. Zik has not published the identity checks for Zik ID yet, so nothing
        has been sent, approved or issued, and no ID exists. You can withdraw it at any time.
      </p>
      <p className={styles.applyMeta}>Saved {new Date(application.created_at).toLocaleDateString()} · policy {application.policy_version}</p>
    </div> : null}

    {application?.state === "stale" ? <div className={styles.staleNotice} role="status">
      <StatusBadge>Needs checking again</StatusBadge>
      <p>{application.stale_reason}</p>
    </div> : null}

    {error ? <p role="alert" className={styles.error}>{error}</p> : null}

    {readiness.status !== "ready_to_apply" && !application ? <>
      <p className={styles.applyIntro}>Your evidence is not ready yet. Here is what is still needed.</p>
      <ul className={styles.requirements}>
        {readiness.requirements.filter(requirement => !requirement.satisfied).map(requirement =>
          <li key={requirement.id} data-met={false}><span aria-hidden="true">○</span><div><strong>{requirement.id.replace(/_/g, " ")}</strong>{requirement.reasons.map(reason => <small key={reason}>{nextAction(reason)}</small>)}</div></li>)}
      </ul>
      <p className={styles.applyFoot}><Link href="/vault">Back to your Vault</Link></p>
    </> : null}

    {step === "evidence" && readiness.status === "ready_to_apply" ? <>
      <p className={styles.applyIntro}>These are the documents and details your application would be based on. Check them before you continue.</p>
      <h2 className={styles.applySubhead}>Evidence</h2>
      <ul className={styles.documents}>
        {evidenceDocuments.map(document => <li key={document.id}><div className={styles.documentMain}><div>
          <strong>{document.label ?? document.filename}</strong>
          <small>{document.classification?.replace(/_/g, " ")} · confirmed by you · Zik has not checked whether it is genuine</small>
        </div></div></li>)}
      </ul>
      <h2 className={styles.applySubhead}>Details</h2>
      <dl className={styles.claimList}>
        {Object.entries(snapshot.claim_snapshot).map(([field, value]) => <div key={field}><dt>{field.replace(/_/g, " ")}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className={styles.actions}>
        <Link href="/vault" className={styles.secondaryLink}>Back to Vault</Link>
        <Button type="button" onClick={() => setStep("confirm")}>Continue</Button>
      </div>
    </> : null}

    {step === "confirm" ? <>
      <h2 className={styles.applySubhead}>What happens next</h2>
      <ul className={styles.plainList}>
        <li>Your application is saved in your Vault on this device, encrypted like everything else in it.</li>
        <li>Nothing is sent anywhere now. Zik has not published the identity checks for Zik ID yet.</li>
        <li>When those checks exist, you will be asked separately before anything is shared, and you can refuse.</li>
        <li>Your Zik Pass is unaffected. It keeps proving your age on its own, without your name or documents.</li>
        <li>You can withdraw this application at any time, and deleting the evidence withdraws it automatically.</li>
      </ul>
      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={() => setStep("evidence")}>Back</Button>
        <Button type="button" loading={busy} onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const now = new Date();
            const draft: Application = {
              id: randomId(), policy_version: READINESS_POLICY_VERSION, state: "draft", created_at: now.toISOString(), updated_at: now.toISOString(),
              claim_snapshot: snapshot.claim_snapshot, evidence_snapshot: snapshot.evidence_snapshot, readiness_reasons: readiness.reasons,
            };
            const session = await pendingOnboardingAdapter.start({
              application_id: draft.id, policy_version: draft.policy_version, claim_set_digest: claimSetDigest(draft),
              evidence_digest: evidenceDigest(draft), holder_key_thumbprint: "device-local",
            });
            await vault.current.saveApplication({
              ...draft, state: "pending_onboarding", updated_at: new Date().toISOString(),
              onboarding: { adapter: session.adapter, reference: session.reference, status: session.state, updated_at: session.updated_at },
            });
            await load();
          } catch { setError("Your application could not be saved. Nothing was changed."); }
          finally { setBusy(false); }
        }}>Save my application</Button>
      </div>
    </> : null}

    {step === "done" && application ? <div className={styles.actions}>
      <Link href="/wallet" className={styles.secondaryLink}>See it in your Wallet</Link>
      <Button type="button" variant="secondary" loading={busy} onClick={async () => {
        setBusy(true);
        try { await vault.current.deleteApplication(); await load(); }
        finally { setBusy(false); }
      }}>Withdraw application</Button>
    </div> : null}

    <p className={styles.applyFoot}>
      Zik cannot issue a Zik ID from anything on this device. An ID can only exist once an authorised checker has
      verified you and an issuer has signed it.
    </p>
  </section>;
}

/** The claims and evidence an application would be based on, taken from the current Vault. */
function buildSnapshot(claims: Claim[], documents: VaultDocument[], observations: Observation[], readiness: ReadinessResult) {
  const used = [readiness.evidence.primary_document_id, readiness.evidence.supporting_document_id].filter((id): id is string => Boolean(id));
  return {
    claim_snapshot: Object.fromEntries(claims.filter(claim => claim.value && claim.field !== "email").map(claim => [claim.field, claim.value as string])),
    evidence_snapshot: used.map(id => ({
      document_id: id,
      content_hash: documents.find(document => document.id === id)?.content_hash ?? "",
      observation_ids: observations.filter(observation => observation.document_id === id && observation.review === "accepted").map(observation => observation.id),
    })),
  };
}
