"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, Skeleton, StatusBadge } from "@/components/customer/ui";
import { RecoverySetup } from "@/components/customer/recovery/recovery-setup";
import { ConversationView } from "@/components/customer/recovery/conversation-view";
import * as ownerSession from "@/lib/client/recovery/owner-session";
import * as api from "@/lib/client/recovery/api";
import type { OwnerCardView } from "@/lib/client/recovery/api";
import type { RecoveryConversation } from "@/lib/shared/recovery/types";

type LoadState = "loading" | "none" | "ready";

export function RecoveryDashboard() {
  const [state, setState] = useState<LoadState>("loading");
  const [card, setCard] = useState<OwnerCardView | undefined>(undefined);
  const [conversations, setConversations] = useState<RecoveryConversation[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const owned = await ownerSession.loadOwnedCard();
      if (!owned) {
        setState("none");
        return;
      }
      setCard(owned);
      const local = await ownerSession.currentOwnerSecret();
      if (local) {
        const list = await api.listOwnerConversations(owned.card_id, local.ownerSecret);
        setConversations(list);
      }
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your recovery card.");
      setState("none");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (state === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (state === "none" || !card) {
    return (
      <div>
        {error ? <Alert tone="critical" title="Could not load your recovery card">{error}</Alert> : null}
        <RecoverySetup onCreated={() => void refresh()} />
      </div>
    );
  }

  const active = conversations.find((conversation) => conversation.conversation_id === selected);

  if (active) {
    return (
      <OwnerConversation
        conversation={active}
        card={card}
        onBack={() => setSelected(undefined)}
        onEnded={() => void refresh()}
      />
    );
  }

  return (
    <div>
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-extrabold tracking-[0.16em] text-[#65604c]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4f1043505904-1" : undefined}>YOUR RECOVERY CARD</p>
            <p className="mt-1 font-mono text-[13px] text-[var(--zk-text-soft)]">{card.card_id}</p>
          </div>
          {card.revoked ? <StatusBadge tone="critical">Revoked</StatusBadge> : <StatusBadge tone="positive">Active</StatusBadge>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
          <StatusBadge tone={card.channel?.verified_at ? "positive" : "caution"}>
            {card.channel?.verified_at ? `Contact verified: ${card.channel.address}` : "No verified contact"}
          </StatusBadge>
        </div>
        {card.revoked ? (
          <Alert tone="caution" title="This card no longer works for new finders">
            Its old QR code and link are dead. Existing conversations below still work until you end them.
          </Alert>
        ) : null}
      </Card>

      <div className="mt-6">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4f1043505904-2" : undefined}>Conversations</p>
        {conversations.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4f1043505904-3" : undefined}>No one has scanned your card yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {conversations.map((conversation) => (
              <li key={conversation.conversation_id}>
                <button
                  type="button"
                  onClick={() => setSelected(conversation.conversation_id)}
                  className="flex w-full items-center justify-between rounded-none border border-[var(--zk-line)] bg-[var(--zk-card)] p-4 text-left hover:bg-[var(--zk-sunken)]"
                >
                  <span className="text-[14px] font-semibold">
                    {conversation.status === "open" ? "Open conversation" : conversation.status === "ended" ? "Ended conversation" : "Blocked conversation"}
                  </span>
                  <span className="text-[12px] text-[var(--zk-text-faint)]">
                    {new Date(conversation.last_message_at).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!card.revoked ? (
        <div className="mt-8 border-t border-[var(--zk-line)] pt-5">
          <RevokeCardButton card={card} onRevoked={() => void refresh()} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Prompts once per page session for the messaging passphrase, unwraps the
 * messaging key locally, then hands off to the shared chat UI. The
 * passphrase and unwrapped key never reach recovery-dashboard.tsx itself —
 * they stay inside this component's closure for the lifetime of the chat.
 */
function OwnerConversation({
  conversation,
  card,
  onBack,
  onEnded
}: {
  conversation: RecoveryConversation;
  card: OwnerCardView;
  onBack: () => void;
  onEnded: () => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [secretKey, setSecretKey] = useState<Uint8Array | undefined>(undefined);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const local = await ownerSession.currentOwnerSecret();
      if (!local) throw new Error("This device is not set up as the card owner.");
      const key = await ownerSession.unwrapMessagingKey(
        card.recovery_key_envelope,
        card.recovery_key_sealed,
        card.owner_public_key,
        passphrase
      );
      setSecretKey(key);
      setToken(local.ownerSecret);
    } catch {
      setError("Incorrect messaging passphrase.");
    } finally {
      setBusy(false);
      setPassphrase("");
    }
  }

  if (secretKey && token) {
    return (
      <ConversationView
        conversationId={conversation.conversation_id}
        cardId={card.card_id}
        role="owner-trusted"
        token={token}
        secretKey={secretKey}
        peerPublicKey={conversation.finder_public_key}
        onBack={onBack}
        onEnded={onEnded}
      />
    );
  }

  return (
    <form onSubmit={unlock}>
      <button type="button" onClick={onBack} className="mb-3 text-[13px] font-semibold text-[var(--zk-text-soft)] hover:underline" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4f1043505904-4" : undefined}>
        ← Back
      </button>
      <p className="text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4f1043505904-5" : undefined}>
        Enter your messaging passphrase to read this conversation. It&apos;s never sent to Zik — the key is unwrapped in this browser only.
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
  );
}

function RevokeCardButton({ card, onRevoked }: { card: OwnerCardView; onRevoked: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function revoke() {
    setBusy(true);
    setError("");
    try {
      const local = await ownerSession.currentOwnerSecret();
      if (!local) throw new Error("This device is not set up as the card owner.");
      await api.revokeCard(card.card_id, local.ownerSecret);
      onRevoked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke this card.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>Revoke this card</Button>;
  }

  return (
    <div>
      <Alert tone="caution" title="Revoke this recovery card?">
        Its QR code and link stop working immediately. Anyone who already has the QR code, printed card or sticker cannot start a new conversation with it, but conversations already open stay open until you end them.
      </Alert>
      {error ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{error}</p> : null}
      <div className="mt-3 flex gap-3">
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
        <Button type="button" variant="danger" loading={busy} onClick={() => void revoke()}>Revoke card</Button>
      </div>
    </div>
  );
}
