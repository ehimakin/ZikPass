"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ZikLogoMark } from "@/components/zik-logo";
import { Alert, Button } from "@/components/customer/ui";
import { ConversationView } from "@/components/customer/recovery/conversation-view";
import { unwrapMessagingKey } from "@/lib/client/recovery/owner-session";
import * as api from "@/lib/client/recovery/api";

/**
 * Deliberately not wrapped in CustomerShell: no primary nav, no burger menu,
 * no Vault/wallet links exist on this page at all — the exclusion the brief
 * requires is structural (this code never imports those modules), not a
 * runtime permission check. Nothing here is written to localStorage or
 * IndexedDB; the unwrapped key lives only in this component's state for the
 * life of the tab.
 */
export function BorrowedPage({ conversationId, replyToken }: { conversationId: string; replyToken: string }) {
  const [exchanged, setExchanged] = useState<Awaited<ReturnType<typeof api.exchangeReplyToken>> | undefined>(undefined);
  const [passphrase, setPassphrase] = useState("");
  const [secretKey, setSecretKey] = useState<Uint8Array | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (!replyToken) {
      setError("This link is missing its access token.");
      return;
    }
    api
      .exchangeReplyToken(conversationId, replyToken)
      .then(setExchanged)
      .catch((err) => setError(err instanceof Error ? err.message : "This reply link is invalid or has already been used."));
  }, [conversationId, replyToken]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (!exchanged) return;
    setBusy(true);
    setError("");
    try {
      const key = await unwrapMessagingKey(exchanged.envelope, exchanged.sealed, exchanged.ownerPublicKey, passphrase);
      setSecretKey(key);
    } catch {
      setError("Incorrect messaging passphrase.");
    } finally {
      setBusy(false);
      setPassphrase("");
    }
  }

  async function endSession() {
    if (!exchanged) return;
    await api.endBorrowedSession(conversationId, exchanged.sessionToken);
    setEnded(true);
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--zk-canvas)]">
      <div className="mx-auto flex w-full max-w-[480px] flex-col px-4 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZikLogoMark className="h-7 w-7" />
            <span className="text-[15px] font-extrabold tracking-tight text-[#28623c]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-65b042e12c73-1" : undefined}>Zik</span>
          </div>
          {exchanged && !ended ? (
            <Button type="button" variant="ghost" onClick={() => void endSession()}>End session</Button>
          ) : null}
        </div>

        {ended ? (
          <div className="mt-6">
            <Alert tone="info" title="Session ended">This device can no longer read or reply to this conversation.</Alert>
          </div>
        ) : error ? (
          <div className="mt-6">
            <Alert tone="critical" title="Could not open this reply link">{error}</Alert>
          </div>
        ) : !exchanged ? (
          <p className="mt-6 text-[14px] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-65b042e12c73-2" : undefined}>Loading…</p>
        ) : !secretKey ? (
          <form onSubmit={unlock} className="mt-6">
            <h1 className="text-[22px] font-bold tracking-[-0.02em]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-65b042e12c73-3" : undefined}>Enter your messaging passphrase</h1>
            <p className="mt-2 text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-65b042e12c73-4" : undefined}>
              This unwraps your messaging key in this browser only — it is never sent to Zik. This session cannot open a Vault, add a trusted device, or accept a seed phrase, even if you try.
            </p>
            <input
              className="mt-4 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-[16px]"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="off"
              required
            />
            {error ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{error}</p> : null}
            <Button type="submit" size="lg" className="mt-4" loading={busy}>Unlock</Button>
          </form>
        ) : (
          <div className="mt-6">
            <ConversationView
              conversationId={conversationId}
              role="owner-borrowed"
              token={exchanged.sessionToken}
              secretKey={secretKey}
              peerPublicKey={exchanged.finderPublicKey}
              onBack={() => setSecretKey(undefined)}
              onEnded={() => setEnded(true)}
              restricted
            />
          </div>
        )}
      </div>
    </div>
  );
}
