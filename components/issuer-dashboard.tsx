"use client";

import { useEffect, useState, useTransition } from "react";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";
import {
  formatAdminDateTime,
  formatCurrencyGbp,
  formatFingerprint,
  getNotificationRecords,
  getRemainingSeconds,
  isCoolingComplete,
  stringifyForAdmin,
  type IssuerSessionRecord
} from "@/lib/shared/issuer-dashboard";

interface IssuerResponse {
  sessions: IssuerSessionRecord[];
  issuer_public_key: JsonWebKey;
}

interface ApiError {
  error: string;
}

export function IssuerDashboard() {
  const [sessions, setSessions] = useState<IssuerSessionRecord[]>([]);
  const [issuerPublicKey, setIssuerPublicKey] = useState<JsonWebKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refresh();

    const interval = window.setInterval(() => {
      void refresh();
    }, 2500);

    return () => window.clearInterval(interval);
  }, []);

  async function refresh() {
    try {
      const response = await fetch("/api/issuer/sessions");
      const data = (await response.json()) as IssuerResponse | ApiError;

      if (!response.ok) {
        setError((data as ApiError).error);
        return;
      }

      setSessions((data as IssuerResponse).sessions);
      setIssuerPublicKey((data as IssuerResponse).issuer_public_key);
      setError(null);
    } catch {
      setError("Issuer sessions are temporarily unavailable.");
    }
  }

  async function mutate(endpoint: string, enrollmentId: string) {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enrollmentId })
          });

          if (!response.ok) {
            const data = (await response.json()) as ApiError;
            setError(data.error);
            return;
          }

          await refresh();
        } catch {
          setError("The issuer action could not be completed right now.");
        }
      })();
    });
  }

  return (
    <div className="grid gap-6">
      <SurfaceCard
        title="Issuer trust root"
        subtitle="The private signing key stays server-side; only the public key is shared with verifiers."
      >
        {issuerPublicKey ? (
          <pre className="rounded-2xl bg-ink p-4 text-xs text-mist">
            {JSON.stringify(issuerPublicKey, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-ink/65">Loading public key material.</p>
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Enrollment queue"
        subtitle="This dashboard shows provider execution state, risk outcomes, cooling-off, operational flags, and issuance state."
      >
        {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
        {sessions.length === 0 ? (
          <p className="text-sm text-ink/65">No sessions yet. Start one from the wallet flow.</p>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session, index) => {
              const remainingSeconds = getRemainingSeconds(session.cooling_off, Date.now());
              const coolingComplete = isCoolingComplete(session.cooling_off, Date.now());
              const notifications = getNotificationRecords(session.notifications);
              const transactionStatus = session.bank_verification?.transaction_status ?? "pending";
              const financialStatus =
                session.providers?.financial_check?.normalized_response?.outcome ?? "pending";
              const copStatus = session.providers?.cop?.normalized_response?.outcome ?? "pending";
              const riskStatus = session.risk_decision?.state ?? "pending";
              const sessionId = session.id ?? `session-${index + 1}`;
              const sessionStatusLabel = session.status ?? "status unavailable";
              const duplicateFlag = session.duplicate_state?.blocked ? "Duplicate blocked" : "No duplicate";

              return (
                <article
                  key={session.id ?? `session-${index}`}
                  className="rounded-[24px] border border-ink/8 bg-ink/5 p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-heading text-lg font-medium">{sessionId}</p>
                      <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/50">
                        {formatAdminDateTime(session.created_at, "Time unavailable")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={financialStatus.includes("match") ? "good" : "neutral"}>
                        Financial: {financialStatus}
                      </StatusPill>
                      <StatusPill tone={copStatus === "full_match" ? "good" : "neutral"}>
                        CoP: {copStatus}
                      </StatusPill>
                      <StatusPill tone={transactionStatus === "confirmed" ? "good" : "neutral"}>
                        Bank: {transactionStatus}
                      </StatusPill>
                      <StatusPill
                        tone={
                          session.status === "issued"
                            ? "good"
                            : session.status === "approved_with_cooling_off" ||
                                session.status === "credential_pending_issuance"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {sessionStatusLabel}
                      </StatusPill>
                      <StatusPill tone={duplicateFlag === "Duplicate blocked" ? "warn" : "neutral"}>
                        {duplicateFlag}
                      </StatusPill>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Provider outcomes</p>
                      <p className="mt-2">Financial check: {financialStatus}</p>
                      <p className="mt-2">CoP: {copStatus}</p>
                      <p className="mt-2">Bank verification: {transactionStatus}</p>
                      <p className="mt-2">Risk decision: {riskStatus}</p>
                      <p className="mt-2">Stage: {session.orchestration?.stage ?? "Unavailable"}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Bank verification</p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                        Bank
                      </p>
                      <p className="mt-1">
                        {session.bank_verification?.bank_name ?? "Bank unavailable"}
                      </p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                        Amount
                      </p>
                      <p className="mt-1">{formatCurrencyGbp(session.bank_verification?.amount_gbp)}</p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                        Reference
                      </p>
                      <p className="mt-1">
                        {session.bank_verification?.reference ?? "Reference unavailable"}
                      </p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                        Code
                      </p>
                      <p className="mt-1">{session.bank_verification?.code ?? "Code unavailable"}</p>
                      <p className="mt-2">Attempts: {session.bank_verification?.attempts ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Lifecycle</p>
                      <p className="mt-2">
                        Holder key registered: {formatAdminDateTime(session.holder_key_registered_at)}
                      </p>
                      <p className="mt-2">
                        Financial complete: {formatAdminDateTime(session.financial_check_completed_at)}
                      </p>
                      <p className="mt-2">
                        CoP complete: {formatAdminDateTime(session.cop_completed_at)}
                      </p>
                      <p className="mt-2">
                        Bank verified: {formatAdminDateTime(session.bank_verification_completed_at)}
                      </p>
                      <p className="mt-2">
                        Pending issuance: {formatAdminDateTime(session.credential_pending_at)}
                      </p>
                      <p className="mt-2">
                        Issuer signature: {formatAdminDateTime(session.issuer_signature_created_at)}
                      </p>
                      <p className="mt-2 font-mono text-xs text-ink/50">{formatFingerprint(session.application_fingerprint)}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Cooling-off</p>
                      <p className="mt-2">
                        Configured delay:{" "}
                        {typeof session.cooling_off?.duration_seconds === "number"
                          ? `${session.cooling_off.duration_seconds}s`
                          : "Not set"}
                      </p>
                      <p className="mt-2">
                        Remaining: {remainingSeconds === null ? "Unavailable" : `${remainingSeconds}s`}
                      </p>
                      <p className="mt-2">Complete: {coolingComplete ? "Yes" : "No"}</p>
                      <p className="mt-2">
                        Manual advance: {session.cooling_off?.manually_advanced ? "Yes" : "No"}
                      </p>
                      <p className="mt-2">
                        Issuance status: {session.orchestration?.issuance_status ?? "Unavailable"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Decision detail</p>
                      <p className="mt-2">Risk state: {riskStatus}</p>
                      <p className="mt-2">
                        Manual review: {session.risk_decision?.requires_manual_review ? "Yes" : "No"}
                      </p>
                      <p className="mt-2">
                        Retryable: {session.risk_decision?.retryable ? "Yes" : "No"}
                      </p>
                      <p className="mt-2">
                        Duplicate reason: {session.duplicate_state?.reason ?? "None"}
                      </p>
                      <p className="mt-2">
                        User message: {session.last_user_message ?? "Unavailable"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Raw provider detail</p>
                      <pre className="mt-2 text-xs">
                        {stringifyForAdmin(
                          {
                            financial_check: session.providers?.financial_check,
                            cop: session.providers?.cop,
                            bank_start: session.bank_verification?.provider_execution?.start,
                            bank_confirm: session.bank_verification?.provider_execution?.confirm
                          },
                          "Provider detail unavailable."
                        )}
                      </pre>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="rounded-full bg-ink/8 px-4 py-2 text-sm text-ink disabled:opacity-50"
                      disabled={isPending || session.status !== "approved_with_cooling_off" || !session.id}
                      onClick={() => session.id && mutate("/api/enrollment/advance-cooling-off", session.id)}
                    >
                      Advance cooling-off
                    </button>
                    <button
                      className="rounded-full bg-ink/8 px-4 py-2 text-sm text-ink disabled:opacity-50"
                      disabled={isPending || session.status !== "retry_provider_failure" || !session.id}
                      onClick={() => session.id && mutate("/api/enrollment/retry", session.id)}
                    >
                      Retry providers
                    </button>
                    <button
                      className="rounded-full bg-ink px-4 py-2 text-sm text-mist disabled:opacity-50"
                      disabled={
                        isPending ||
                        transactionStatus !== "confirmed" ||
                        !coolingComplete ||
                        Boolean(session.issued_credential) ||
                        !session.id
                      }
                      onClick={() => session.id && mutate("/api/enrollment/issue", session.id)}
                    >
                      Sign credential manually
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Notification log</p>
                      {notifications.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {notifications.map((notification, notificationIndex) => (
                            <div
                              key={notification.id ?? `${sessionId}-notification-${notificationIndex}`}
                              className="rounded-2xl bg-ink/5 p-3"
                            >
                              <p>{notification.message ?? "Notification content unavailable."}</p>
                              <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                                {formatAdminDateTime(notification.created_at, "Time unavailable")}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2">No notifications recorded.</p>
                      )}
                    </div>

                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Issued credential</p>
                      {session.issued_credential ? (
                        <pre className="mt-2 text-xs">
                          {stringifyForAdmin(session.issued_credential, "Credential unavailable.")}
                        </pre>
                      ) : (
                        <p className="mt-2">No credential issued yet.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
