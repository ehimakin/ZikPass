import { randomBytes } from "node:crypto";
import { sendMail, smtpAvailable, validEmail } from "./mailer";

export function recoveryNotifyAvailable(): boolean {
  return smtpAvailable();
}

/** HTTPS everywhere, or HTTP only on localhost for local development — same rule as affiliate onboarding's callback validation. */
function recoveryPublicUrl(): URL | undefined {
  const raw = process.env.ZIK_RECOVERY_PUBLIC_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

export function recoveryOrigin(): string | undefined {
  return recoveryPublicUrl()?.origin;
}

export async function sendVerificationCode(address: string, code: string): Promise<boolean> {
  if (!validEmail(address)) throw new Error("Enter a valid email address.");
  return sendMail({
    to: address,
    subject: "Confirm your Zik recovery contact",
    text: `Use this code to confirm this address as your lost-phone recovery contact:\n\n${code}\n\nIt expires in 15 minutes. If you did not request this, ignore this email — nothing changes without the code.`
  });
}

/**
 * Sent when a finder opens a recovery card and starts a conversation. The
 * link carries only a bearer reply_token (a capability that scopes access to
 * this one conversation, the same class of thing as the pairing key
 * affiliate-booking.ts already emails in plaintext) — never key material.
 * Reading the conversation still requires the recovery passphrase, entered
 * on whichever device opens the link, to unwrap the envelope in
 * RecoveryCard.recovery_key_envelope; the server holds that envelope but,
 * same as Vault, never the passphrase or the key it protects.
 */
export async function notifyOwnerOfConversation(input: {
  address: string;
  conversationId: string;
  replyToken: string;
}): Promise<boolean> {
  const origin = recoveryOrigin();
  const link = origin
    ? `${origin}/recovery/borrowed/${encodeURIComponent(input.conversationId)}?token=${encodeURIComponent(
        input.replyToken
      )}`
    : undefined;

  return sendMail({
    to: input.address,
    subject: "Someone may have found your phone",
    text: [
      "Someone scanned your Zik recovery card and opened a private conversation.",
      "",
      link
        ? `Reply here (works on any device, including a borrowed one): ${link}\nYou'll need your recovery passphrase to open it — the one you set when you created this card.`
        : "Open the Zik app on your trusted device to reply — no reply link could be built (recovery public URL is not configured).",
      "",
      "This link only opens this one conversation. It cannot open your Vault, add a device, or see anything else about your account.",
      "The finder cannot see your identity unless you choose to share it in the conversation.",
      "If you did not lose your phone, you can ignore this — the card ID cannot be used for anything but starting a conversation like this one."
    ].join("\n")
  });
}

export function generateReplyToken(): string {
  return randomBytes(24).toString("base64url");
}
