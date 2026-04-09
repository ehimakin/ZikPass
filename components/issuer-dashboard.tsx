"use client";

import { useEffect, useState, useTransition } from "react";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";
import type { EnrollmentRecord } from "@/lib/shared/types";

interface IssuerResponse {
  sessions: EnrollmentRecord[];
  issuer_public_key: JsonWebKey;
}

interface ApiError {
  error: string;
}

export function IssuerDashboard() {
  const [sessions, setSessions] = useState<EnrollmentRecord[]>([]);
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
    const response = await fetch("/api/issuer/sessions");
    const data = (await response.json()) as IssuerResponse | ApiError;

    if (!response.ok) {
      setError((data as ApiError).error);
      return;
    }

    setSessions((data as IssuerResponse).sessions);
    setIssuerPublicKey((data as IssuerResponse).issuer_public_key);
    setError(null);
  }

  async function mutate(endpoint: string, enrollmentId: string) {
    startTransition(() => {
      void (async () => {
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
        subtitle="This dashboard shows proof evaluation, bank verification, cooling-off, notification logging, and issuance state."
      >
        {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
        {sessions.length === 0 ? (
          <p className="text-sm text-ink/65">No sessions yet. Start one from the wallet flow.</p>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => {
              const remainingSeconds = Math.max(
                Math.ceil((new Date(session.cooling_off.ends_at).getTime() - Date.now()) / 1000),
                0
              );

              return (
                <article
                  key={session.id}
                  className="rounded-[24px] border border-ink/8 bg-ink/5 p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-heading text-lg font-medium">{session.id}</p>
                      <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/50">
                        {new Date(session.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={session.proof_evaluation.approved ? "good" : "warn"}>
                        {session.proof_evaluation.approved ? "Proof approved" : "Proof rejected"}
                      </StatusPill>
                      <StatusPill
                        tone={
                          session.bank_verification.transaction_status === "confirmed"
                            ? "good"
                            : "neutral"
                        }
                      >
                        {session.bank_verification.transaction_status}
                      </StatusPill>
                      <StatusPill
                        tone={
                          session.status === "issued"
                            ? "good"
                            : session.status === "issued_cooling_off"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {session.status}
                      </StatusPill>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Proof</p>
                      <pre className="mt-2 text-xs">{JSON.stringify(session.proof, null, 2)}</pre>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Bank verification</p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                        Bank
                      </p>
                      <p className="mt-1">{session.bank_verification.bank_name}</p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                        Amount
                      </p>
                      <p className="mt-1">GBP {session.bank_verification.amount_gbp.toFixed(2)}</p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                        Reference
                      </p>
                      <p className="mt-1">{session.bank_verification.reference}</p>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                        Code
                      </p>
                      <p className="mt-1">{session.bank_verification.code}</p>
                      <p className="mt-2">Attempts: {session.bank_verification.attempts}</p>
                    </div>
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Cooling-off</p>
                      <p className="mt-2">Configured delay: {session.cooling_off.duration_seconds}s</p>
                      <p className="mt-2">Remaining: {remainingSeconds}s</p>
                      <p className="mt-2">
                        Manual advance: {session.cooling_off.manually_advanced ? "Yes" : "No"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="rounded-full bg-ink/8 px-4 py-2 text-sm text-ink disabled:opacity-50"
                      disabled={isPending || !session.proof_evaluation.approved}
                      onClick={() => mutate("/api/enrollment/advance-cooling-off", session.id)}
                    >
                      Advance cooling-off
                    </button>
                    <button
                      className="rounded-full bg-ink px-4 py-2 text-sm text-mist disabled:opacity-50"
                      disabled={
                        isPending ||
                        session.bank_verification.transaction_status !== "confirmed" ||
                        Boolean(session.issued_credential)
                      }
                      onClick={() => mutate("/api/enrollment/issue", session.id)}
                    >
                      Issue credential manually
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Notification log</p>
                      <div className="mt-2 space-y-2">
                        {session.notifications.map((notification) => (
                          <div key={notification.id} className="rounded-2xl bg-ink/5 p-3">
                            <p>{notification.message}</p>
                            <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-ink/50">
                              {new Date(notification.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/80 p-4 text-sm text-ink/75">
                      <p className="font-medium">Issued credential</p>
                      {session.issued_credential ? (
                        <pre className="mt-2 text-xs">
                          {JSON.stringify(session.issued_credential, null, 2)}
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
