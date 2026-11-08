import { openMessage, sealMessage } from "@/lib/shared/recovery/crypto";
import { pollMessages, sendCiphertext, type ConversationRole } from "@/lib/client/recovery/api";

export type DecryptedMessage = {
  message_id: string;
  sender: "finder" | "owner";
  sent_at: string;
} & ({ ok: true; text: string } | { ok: false });

/** Local to one browser tab: decrypts with a secret key that never leaves this process. */
export class RecoveryChat {
  constructor(
    private conversationId: string,
    private role: ConversationRole,
    private token: string,
    private secretKey: Uint8Array,
    private peerPublicKey: string,
    private cardId?: string
  ) {}

  /**
   * One message failing to decrypt (wrong key, tampering, or a key rotated
   * since it was sent) must not blank out the rest of the conversation —
   * each message is opened independently and a failure becomes a visible
   * placeholder rather than an exception that aborts the whole poll.
   */
  async fetchMessages(): Promise<DecryptedMessage[]> {
    const raw = await pollMessages(this.conversationId, this.role, this.token, this.cardId);
    return raw.map((message) => {
      try {
        const text = openMessage(this.secretKey, this.peerPublicKey, this.conversationId, {
          ciphertext: message.ciphertext,
          nonce: message.nonce
        });
        return { message_id: message.message_id, sender: message.sender, sent_at: message.sent_at, ok: true, text };
      } catch {
        return { message_id: message.message_id, sender: message.sender, sent_at: message.sent_at, ok: false };
      }
    });
  }

  async send(text: string): Promise<void> {
    const sealed = sealMessage(this.secretKey, this.peerPublicKey, this.conversationId, text);
    await sendCiphertext(this.conversationId, this.role, this.token, sealed.ciphertext, sealed.nonce, this.cardId);
  }
}

/**
 * Short-polling with backoff and visibility awareness — the affiliate paired
 * session (components/affiliate-paired-session.tsx) polls a fixed 2s with
 * neither, flagged as a smell in AUDIT.md L3. This backs off from 2s toward
 * 15s when nothing changes, resets to 2s on new activity, and pauses while
 * the tab is hidden.
 */
export function startPoller(fn: () => Promise<{ changed: boolean }>, onError: (error: unknown) => void): () => void {
  let stopped = false;
  let delay = 2000;
  let first = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function tick() {
    if (stopped) return;
    // Visibility only pauses repeat polling — the first load must not wait on a tab regaining focus.
    if (document.hidden && !first) {
      timer = setTimeout(tick, 1000);
      return;
    }
    first = false;
    try {
      const { changed } = await fn();
      delay = changed ? 2000 : Math.min(delay * 1.5, 15000);
    } catch (error) {
      onError(error);
      delay = Math.min(delay * 1.5, 15000);
    }
    if (!stopped) timer = setTimeout(tick, delay);
  }

  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
