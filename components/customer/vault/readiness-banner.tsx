"use client";

import Link from "next/link";
import { Button } from "@/components/customer/ui";
import type { ReadinessResult, RequirementId } from "@/lib/shared/policy/zik-id-readiness";
import { nextAction } from "@/lib/shared/policy/zik-id-readiness";
import styles from "./vault-documents.module.css";

/**
 * Explains, in the user's terms, what the application still needs.
 *
 * This says the evidence is prepared. It does not say anyone has been verified: a
 * document that reads cleanly satisfies this check whether or not it is genuine,
 * and that is decided later, by a checker authorised to decide it.
 */
const REQUIREMENT_LABELS: Record<RequirementId, string> = {
  active_pass: "An active Zik Pass on this device",
  primary_photo_id: "A passport or driving licence you have confirmed",
  independent_support: "A second, different document that agrees",
  proposals_reviewed: "Everything Zik found has been reviewed",
  no_material_conflicts: "No unresolved differences in your details",
};

const HEADLINES: Record<ReadinessResult["status"], string> = {
  ready_to_apply: "You have enough supporting information to start a Zik ID application",
  needs_review: "Nearly there — a few things need your decision",
  not_ready: "What a Zik ID application would need",
};

export function ReadinessBanner({ readiness, dismissed, onDismiss, applicationState }: {
  readiness: ReadinessResult;
  dismissed: boolean;
  onDismiss: () => void;
  applicationState?: string;
}) {
  if (readiness.status === "ready_to_apply" && dismissed && !applicationState) return null;

  return <section className={styles.readiness} data-status={readiness.status} aria-labelledby="vault-readiness-title">
    <div className={styles.readinessHead}>
      <div>
        <p className={styles.eyebrow}>ZIK ID · APPLICATION READINESS</p>
        <h2 id="vault-readiness-title">{applicationState === "pending_onboarding" ? "Your Zik ID application is with us" : HEADLINES[readiness.status]}</h2>
      </div>
      {readiness.status === "ready_to_apply" && !applicationState
        ? <button type="button" className={styles.dismiss} onClick={onDismiss}>Not now</button> : null}
    </div>

    {applicationState === "pending_onboarding" ? <p className={styles.readinessIntro}>
      We have your application and the details you confirmed. The identity checks themselves are not available yet,
      so nothing has been approved or issued.
    </p> : <p className={styles.readinessIntro}>
      This checks that your evidence is <strong>prepared</strong>. It is not an identity check: confirming text in a
      document does not show the document is genuine or that it belongs to you. That happens later, with a checker
      authorised to do it.
    </p>}

    <ul className={styles.requirements}>
      {readiness.requirements.map(requirement => <li key={requirement.id} data-met={requirement.satisfied}>
        <span aria-hidden="true">{requirement.satisfied ? "✓" : "○"}</span>
        <div>
          <strong>{REQUIREMENT_LABELS[requirement.id]}</strong>
          <span className="sr-only">{requirement.satisfied ? " — done" : " — still needed"}</span>
          {requirement.reasons.map(reason => <small key={reason}>{nextAction(reason)}</small>)}
        </div>
      </li>)}
    </ul>

    {readiness.status === "ready_to_apply" && !applicationState ? <div className={styles.actions}>
      <Link href="/id/apply" className={styles.applyLink}>Apply for Zik ID</Link>
    </div> : null}
    {applicationState === "pending_onboarding" ? <div className={styles.actions}>
      <Link href="/id/apply" className={styles.applyLink}>View your application</Link>
    </div> : null}
    {applicationState === "stale" ? <div className={styles.actions}>
      <p className={styles.notice}>Your evidence changed after you applied, so the application needs checking again.</p>
      <Link href="/id/apply" className={styles.applyLink}>Review your application</Link>
    </div> : null}
    {readiness.status !== "ready_to_apply" && !applicationState ? <p className={styles.readinessFoot}>
      <Button type="button" variant="secondary" onClick={onDismiss}>Hide this for now</Button>
    </p> : null}
  </section>;
}
