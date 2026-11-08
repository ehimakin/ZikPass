import { randomUUID } from 'node:crypto';
import { validEmail } from '@/lib/server/mailer';
import type { Ticket } from '@/lib/shared/support/model';
import { supportTransaction, type SupportStore } from './store';

export type Delivery = {
  id: string; event: string; target: string; channel: 'email' | 'sms'; to: string;
  subject: string; text: string; createdAt: string; attempts: number; nextAttemptAt: number;
  status: 'pending' | 'sending' | 'accepted' | 'failed' | 'uncertain';
  firstAttemptAt?: number; acceptanceUncertain?: boolean; claimedAt?: number; providerId?: string; error?: string;
};
const phone = (value: string) => /^\+[1-9]\d{7,14}$/.test(value);
export function deliveryConfiguration() {
  return {
    enabled: process.env.ZIK_SUPPORT_NOTIFICATIONS_ENABLED === 'true',
    email: Boolean(process.env.RESEND_API_KEY && validEmail(process.env.ZIK_SUPPORT_FROM_EMAIL ?? '')),
    sms: Boolean(/^AC[a-f0-9]{32}$/i.test(process.env.TWILIO_ACCOUNT_SID ?? '') && process.env.TWILIO_AUTH_TOKEN && /^MG[a-f0-9]{32}$/i.test(process.env.TWILIO_MESSAGING_SERVICE_SID ?? '')),
  };
}
function enqueue(data: SupportStore, event: string, target: string, channel: Delivery['channel'], to: string, subject: string, text: string) {
  if (!deliveryConfiguration().enabled || !(channel === 'email' ? validEmail(to) : phone(to))) return;
  const deliveries = data.deliveries ??= [];
  if (deliveries.some(item => item.event === event && item.channel === channel && item.to === to)) return;
  deliveries.push({ id: randomUUID(), event, target, channel, to, subject, text, createdAt: new Date().toISOString(), attempts: 0, nextAttemptAt: 0, status: 'pending' });
}
export function staffNotification(data: SupportStore, event: string, target: string, urgent = false) {
  // No customer content, bearer links or diagnostic details leave the help desk.
  const text = `Zik support needs attention. Reference: ${target}. Sign in to the staff dashboard to review it.`;
  enqueue(data, event, target, 'email', process.env.ZIK_SUPPORT_STAFF_EMAIL ?? '', 'Zik support: action needed', text);
  if (urgent) enqueue(data, event, target, 'sms', process.env.ZIK_SUPPORT_STAFF_PHONE ?? '', '', text);
}
export function customerNotification(data: SupportStore, ticket: Ticket) {
  if (!ticket.emailNotifications || !ticket.contactEmail) return;
  enqueue(data, `ticket:${ticket.id}:${ticket.version}`, ticket.id, 'email', ticket.contactEmail, 'Your Zik support ticket has an update',
    `There is an update to ticket ${ticket.id}. Open your saved private ticket link to read it. For your privacy, this email contains no ticket contents or access key. Replies to this email are not added to your ticket.`);
}

async function send(item: Delivery): Promise<{ status: Delivery['status']; providerId?: string; error?: string; retry?: boolean; acceptanceUncertain?: boolean }> {
  const config = deliveryConfiguration();
  if (!config[item.channel === 'email' ? 'email' : 'sms']) return { status: 'pending', error: 'Provider is not configured.', retry: true };
  try {
    const email = item.channel === 'email';
    const response = await fetch(email ? 'https://api.resend.com/emails' : `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: email ? { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': item.id } : {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: email ? JSON.stringify({ from: process.env.ZIK_SUPPORT_FROM_EMAIL, to: [item.to], subject: item.subject, text: item.text }) : new URLSearchParams({ To: item.to, MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!, Body: item.text }).toString(),
    });
    if (!response.ok) {
      // 429 is a definite rejection. Ambiguous failures are never retried for SMS.
      const retry = response.status === 429 || (email && response.status >= 500);
      return { status: retry ? 'pending' : response.status >= 500 ? 'uncertain' : 'failed', error: `Provider HTTP ${response.status}`, retry, acceptanceUncertain: email && response.status >= 500 };
    }
    const payload = await response.json();
    const providerId = email ? payload.id : payload.sid;
    return typeof providerId === 'string' ? { status: 'accepted', providerId } : { status: 'uncertain', error: 'Provider response lacked a message identifier.' };
  } catch {
    return item.channel === 'email' ? { status: 'pending', error: 'Provider request did not complete.', retry: true, acceptanceUncertain: true } : { status: 'uncertain', error: 'SMS outcome unknown. Check Twilio before sending again.' };
  }
}

/** Claims commit before network I/O; parallel workers cannot send the same claim. */
export async function processDeliveries(preferredIds: string[] = []) {
  if (!deliveryConfiguration().enabled) return { processed: 0 };
  let processed = 0;
  for (let i = 0; i < 5; i++) {
    const item = await supportTransaction(data => {
      const now = Date.now();
      for (const value of data.deliveries ?? []) {
        if (value.status === 'sending' && now - (value.claimedAt ?? 0) > 120000) {
          value.status = value.channel === 'email' ? 'pending' : 'uncertain';
          value.acceptanceUncertain = true;
          value.error = 'Worker interrupted; review provider history for uncertain messages.';
        }
        // Resend idempotency keys expire after 24h; never retry outside that window.
        if (value.status === 'pending' && value.attempts > 0 && value.acceptanceUncertain !== false && now - (value.firstAttemptAt ?? Date.parse(value.createdAt)) > 23 * 3600000) value.status = 'uncertain';
      }
      const due = (value: Delivery) => value.status === 'pending' && value.nextAttemptAt <= now;
      const next = data.deliveries?.find(value => preferredIds.includes(value.id) && due(value)) ?? data.deliveries?.find(due);
      if (!next) return null;
      next.status = 'sending'; next.claimedAt = now; next.firstAttemptAt ??= now; next.attempts++;
      return { ...next };
    });
    if (!item) break;
    const result = await send(item);
    await supportTransaction(data => {
      const current = data.deliveries?.find(value => value.id === item.id);
      if (!current || current.status !== 'sending' || current.claimedAt !== item.claimedAt) return;
      Object.assign(current, { acceptanceUncertain: Boolean((current.acceptanceUncertain ?? (item.attempts > 1)) || result.acceptanceUncertain), status: result.retry && item.attempts >= 6 ? 'failed' : result.status, error: result.error, providerId: result.providerId,
        nextAttemptAt: Date.now() + Math.min(3600000, 60000 * 2 ** item.attempts) });
    });
    processed++;
  }
  return { processed };
}
