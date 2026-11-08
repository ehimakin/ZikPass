"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@/components/customer/ui";
import { RecoveryChat, startPoller, type DecryptedMessage } from "@/lib/client/recovery/chat";
import * as api from "@/lib/client/recovery/api";
import type { ConversationRole } from "@/lib/client/recovery/api";

/**
 * The chat UI shared by all three surfaces: the owner's trusted-device
 * dashboard, the finder's page, and the borrowed-device dashboard. Each
 * caller resolves its own secret key and bearer token first — this
 * component only ever sees key material already in memory, never a
 * passphrase or an owner_secret.
 */
export function ConversationView({
  conversationId,
  cardId,
  role,
  token,
  secretKey,
  peerPublicKey,
  onBack,
  onEnded,
  restricted = false
}: {
  conversationId: string;
  cardId?: string;
  role: ConversationRole;
  token: string;
  secretKey: Uint8Array;
  peerPublicKey: string;
  onBack: () => void;
  onEnded?: () => void;
  /** Borrowed-device UI hides identity-adjacent actions and shows the exclusion notice. */
  restricted?: boolean;
}) {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);
  const chatRef = useRef<RecoveryChat | undefined>(undefined);

  useEffect(() => {
    chatRef.current = new RecoveryChat(conversationId, role, token, secretKey, peerPublicKey, cardId);
    const seen = new Set<string>();

    const stop = startPoller(
      async () => {
        const fetched = await chatRef.current!.fetchMessages();
        const isNew = fetched.some((message) => !seen.has(message.message_id));
        fetched.forEach((message) => seen.add(message.message_id));
        setMessages(fetched);
        return { changed: isNew };
      },
      (err) => setError(err instanceof Error ? err.message : "Could not load new messages.")
    );

    // Not zeroing secretKey here: it's a prop this component doesn't own, and
    // React Strict Mode's dev-only double-invoke would zero it on the
    // throwaway first mount before the real one ever uses it. Same
    // convention as VaultV2.lock() — drop the reference, don't mutate the
    // caller's array. Whichever component generated/unwrapped the key is
    // responsible for its own lifetime.
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !chatRef.current) return;
    setSending(true);
    setError("");
    try {
      await chatRef.current.send(text);
      setDraft("");
      const fetched = await chatRef.current.fetchMessages();
      setMessages(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  async function end() {
    try {
      await api.endConversation(conversationId, role, token, cardId);
      setEnded(true);
      onEnded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end this conversation.");
    }
  }

  async function block() {
    try {
      await api.blockConversation(conversationId, role, token, cardId);
      setEnded(true);
      onEnded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not block this conversation.");
    }
  }

  async function report() {
    try {
      await api.reportConversation(conversationId, role, token, cardId);
    } catch {
      // Reporting is best-effort; the user already sees no visible change either way.
    }
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-[13px] font-semibold text-[var(--zk-text-soft)] hover:underline" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d450560682b6-1" : undefined}>
        ← Back
      </button>

      {restricted ? (
        <Alert tone="info" title="Restricted session">
          This link only opens this one conversation. It cannot open a Vault, add a device, or see anything else about this account. It expires soon and you can end it early below.
        </Alert>
      ) : null}

      <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto rounded-none border border-[var(--zk-line)] bg-[var(--zk-sunken)] p-3">
        {messages.length === 0 ? (
          <p className="text-[13px] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d450560682b6-2" : undefined}>No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.message_id}
              className={
                message.sender === (role === "finder" ? "finder" : "owner")
                  ? "ml-auto max-w-[80%] rounded-none bg-ink px-3 py-2 text-[14px] text-[var(--zk-text-on-ink)]"
                  : "mr-auto max-w-[80%] rounded-none bg-[var(--zk-card)] px-3 py-2 text-[14px]"
              }
            >
              {message.ok ? message.text : <em data-local-edit={process.env.NODE_ENV === "development" ? "ve-d450560682b6-3" : undefined}>This message could not be decrypted.</em>}
              <p className="mt-1 text-[10px] opacity-70">{new Date(message.sent_at).toLocaleTimeString()}</p>
            </div>
          ))
        )}
      </div>

      {error ? <p className="mt-2 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{error}</p> : null}

      {ended ? (
        <Alert tone="info" title="This conversation has ended" />
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-[16px]"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message"
            maxLength={4000}
          />
          <Button type="submit" loading={sending} disabled={!draft.trim()}>Send</Button>
        </form>
      )}

      {!ended ? (
        <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
          <Button type="button" variant="ghost" onClick={() => void end()}>End conversation</Button>
          <Button type="button" variant="ghost" onClick={() => void block()}>Block</Button>
          <Button type="button" variant="ghost" onClick={() => void report()}>Report</Button>
        </div>
      ) : null}
    </div>
  );
}
