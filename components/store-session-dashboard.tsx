"use client";
import { useEffect, useState, useTransition } from "react";
import { SurfaceCard } from "@/components/surface-card";
import { StatusPill } from "@/components/status-pill";
import { buildGenericPhysicalWalletUrl, buildPhysicalWalletUrl } from "@/lib/shared/physical-flow";
import type { EnrollmentRecord, PhysicalStoreSessionRecord } from "@/lib/shared/types";

interface ApiError {
  error: string;
}

const demoRetailVerifierToken = "demo-retail-terminal";

export function StoreSessionDashboard() {
  const [sessions, setSessions] = useState<PhysicalStoreSessionRecord[]>([]);
  const [latestSession, setLatestSession] = useState<PhysicalStoreSessionRecord | null>(null);
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<PhysicalStoreSessionRecord | null>(null);
  const [verificationResult, setVerificationResult] = useState<EnrollmentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void refreshSessions();
  }, []);

  async function refreshSessions() {
    try {
      const response = await fetch("/api/physical/sessions");
      const data = (await response.json()) as { sessions: PhysicalStoreSessionRecord[] } | ApiError;

      if (!response.ok) {
        setError((data as ApiError).error);
        return;
      }

      const nextSessions = (data as { sessions: PhysicalStoreSessionRecord[] }).sessions;
      setSessions(nextSessions);
      setLatestSession(nextSessions[0] ?? null);
      setError(null);
    } catch {
      setError("Store sessions are temporarily unavailable.");
    }
  }

  function createSession() {
    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/physical/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          const data = (await response.json()) as PhysicalStoreSessionRecord | ApiError;

          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          setLatestSession(data as PhysicalStoreSessionRecord);
          setLookupResult(null);
          setVerificationResult(null);
          await refreshSessions();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to create a new store session.");
        }
      })();
    });
  }

  function lookupSession() {
    if (!lookupCode.trim()) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/physical/sessions/lookup", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-zik-retailer-token": demoRetailVerifierToken
            },
            body: JSON.stringify({ userCode: lookupCode.trim().toUpperCase() })
          });
          const data = (await response.json()) as PhysicalStoreSessionRecord | ApiError;

          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          setLookupResult(data as PhysicalStoreSessionRecord);
          setVerificationResult(null);
          setError(null);
        } catch (err) {
          setLookupResult(null);
          setVerificationResult(null);
          setError(err instanceof Error ? err.message : "Unable to find that session.");
        }
      })();
    });
  }

  function submitIdCheck(decision: "confirm" | "reject") {
    if (!lookupCode.trim()) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetch("/api/physical/sessions/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-zik-retailer-token": demoRetailVerifierToken
            },
            body: JSON.stringify({
              userCode: lookupCode.trim().toUpperCase(),
              decision,
              checkedBy: "Demo clerk",
              note:
                decision === "confirm"
                  ? "Physical ID checked in store."
                  : "Physical ID did not establish 18+."
            })
          });
          const data = (await response.json()) as EnrollmentRecord | ApiError;

          if (!response.ok) {
            throw new Error((data as ApiError).error);
          }

          setVerificationResult(data as EnrollmentRecord);
          await refreshSessions();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to confirm the in-person ID check.");
        }
      })();
    });
  }

  return (
    <div className="grid gap-6">
      <SurfaceCard
        title="Retail-card QR"
        subtitle="The printed card is generic. Scanning it starts a fresh customer session on the phone."
      >
        {error ? <p className="mb-4 text-sm text-[#b4535f]">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <a
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist"
            href={buildGenericPhysicalWalletUrl({
              store_id: "zik-london-001",
              store_name: "Zik Oxford Street",
              location_id: "front-desk"
            })}
          >
            Open generic retail-card QR
          </a>
          <button
            className="rounded-full border border-ink/10 bg-[#f7faee] px-5 py-3 text-sm font-medium text-ink hover:bg-[#edf3df]"
            disabled={isPending}
            onClick={createSession}
          >
            {isPending ? "Creating..." : "Create session manually"}
          </button>
          {latestSession ? (
            <a
              className="rounded-full border border-ink/10 bg-[#f7faee] px-5 py-3 text-sm font-medium text-ink hover:bg-[#edf3df]"
              href={buildPhysicalWalletUrl(latestSession)}
            >
              Open customer wallet flow
            </a>
          ) : null}
        </div>

        {latestSession ? (
          <div className="mt-5 rounded-[26px] bg-ink/5 p-5 text-sm text-ink/76">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone="good">{latestSession.store_name}</StatusPill>
              <StatusPill tone="neutral">{latestSession.status}</StatusPill>
            </div>
            <p className="mt-4 font-medium text-ink">Customer launch link</p>
            <p className="mt-2 break-all rounded-[18px] bg-white px-4 py-3 font-mono text-xs text-ink/72">
              {buildPhysicalWalletUrl(latestSession)}
            </p>
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard
        title="Clerk verification"
        subtitle="Enter the short code shown on the customer device and confirm the physical ID check."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="w-full rounded-[22px] border border-ink/10 bg-ink/5 px-5 py-4 text-lg font-medium tracking-[0.28em] text-ink outline-none"
            maxLength={6}
            placeholder="ABC123"
            value={lookupCode}
            onChange={(event) => setLookupCode(event.target.value.replace(/[^A-Z0-9]/gi, "").toUpperCase())}
          />
          <button
            className="rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-medium text-ink"
            disabled={isPending || lookupCode.trim().length < 6}
            onClick={lookupSession}
          >
            Find session
          </button>
          <button
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-mist"
            disabled={isPending || lookupCode.trim().length < 6}
            onClick={() => submitIdCheck("confirm")}
          >
            Confirm 18+
          </button>
          <button
            className="rounded-full border border-[#d27a86]/45 bg-[#fff6f7] px-5 py-3 text-sm font-semibold text-[#9f3748]"
            disabled={isPending || lookupCode.trim().length < 6}
            onClick={() => submitIdCheck("reject")}
          >
            Unable to verify
          </button>
        </div>

        {lookupResult ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] bg-ink p-5 text-mist">
              <div className="flex flex-wrap gap-3">
                <StatusPill tone="good">{lookupResult.store_name}</StatusPill>
                <StatusPill tone="neutral">{lookupResult.status}</StatusPill>
              </div>
              <p className="mt-4 font-heading text-2xl font-semibold tracking-tight">
                Session {lookupResult.session_id}
              </p>
              <p className="mt-2 text-sm text-mist/76">
                User code {lookupResult.user_code ?? "Not yet issued"}
              </p>
            </div>
            <div className="rounded-[24px] bg-white p-5 text-sm text-ink/76">
              <p className="font-medium text-ink">Verification state</p>
              <p className="mt-2">Clerk verification: {lookupResult.clerk_verification.status}</p>
              <p className="mt-2">Device auth: {lookupResult.device_auth.status}</p>
              <p className="mt-2">Expires: {new Date(lookupResult.expires_at).toLocaleString()}</p>
            </div>
          </div>
        ) : null}

        {verificationResult?.physical_verification ? (
          <div className="mt-5 rounded-[24px] bg-[#f7faee] p-5 text-sm text-ink/76">
            <p className="font-medium text-ink">Verification confirmed</p>
            <p className="mt-2">{verificationResult.last_user_message}</p>
            <p className="mt-2">
              Next step: the user completes device authentication on the device receiving the pass.
            </p>
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard
        title="Recent sessions"
        subtitle="Demo-ready view of the store sessions currently in play."
      >
        {sessions.length === 0 ? (
          <p className="text-sm text-ink/65">No store sessions yet.</p>
        ) : (
          <div className="grid gap-3">
            {sessions.slice(0, 6).map((session) => (
              <article
                key={session.session_id}
                className="rounded-[22px] border border-ink/8 bg-white/88 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{session.store_name}</p>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.22em] text-ink/45">
                      {session.session_id}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone="neutral">{session.status}</StatusPill>
                    {session.user_code ? <StatusPill tone="good">{session.user_code}</StatusPill> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
