import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { createPair, getRegistration, mutateAffiliateRegistrations, pairProgress, readAffiliateRegistrations, type AffiliateRegistration } from "./affiliate-onboarding";

const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
function mailSettings() {
  const host = process.env.ZIK_SMTP_HOST; const from = process.env.ZIK_SMTP_FROM;
  const operator = process.env.ZIK_ONBOARDING_EMAIL; const publicUrl = process.env.ZIK_ONBOARDING_PUBLIC_URL;
  if (!host || !from || !operator || !publicUrl || !emailPattern.test(from) || !emailPattern.test(operator)) return undefined;
  let url: URL;
  try { url = new URL(publicUrl); } catch { return undefined; }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return undefined;
  const port = Number(process.env.ZIK_SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!local && (!process.env.ZIK_SMTP_USER || !process.env.ZIK_SMTP_PASSWORD)) return undefined;
  return { host, from, operator, origin: url.origin, port, local };
}
export function bookingDeliveryAvailable() { return Boolean(mailSettings()); }
const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
// RFC 5545 folds by UTF-8 octets, without splitting a multibyte character.
function fold(line: string) {
  const lines: string[] = []; let part = "";
  for (const character of line) { if (Buffer.byteLength(part + character) > 74) { lines.push(part); part = " " + character; } else part += character; }
  lines.push(part); return lines.join("\r\n");
}
export function bookingCalendar(row: AffiliateRegistration, origin: string, organizer: string, operator: string, download = false) {
  const booking = row.booking!; const sessionUrl = `${origin}/dashboard/affiliate/session?id=${encodeURIComponent(row.id)}`;
  const method = download ? "PUBLISH" : booking.status === "cancelled" ? "CANCEL" : "REQUEST";
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Zik Pass//Affiliate Onboarding//EN", `METHOD:${method}`, "BEGIN:VEVENT", `UID:${booking.id}@zikpass`, `DTSTAMP:${stamp(booking.createdAt)}`, `SEQUENCE:${booking.sequence}`, `DTSTART:${stamp(booking.startsAt)}`, `DTEND:${stamp(booking.endsAt)}`, `SUMMARY:${escape(`Zik onboarding: ${row.name}`)}`, `DESCRIPTION:${escape(`Paired onboarding: ${sessionUrl}\nEnter the shared pairing key sent separately in the booking email. The agent also needs their private agent access key. Only shared form fields and integration progress are visible. ${booking.status === "requested" ? "Requested time, awaiting agent confirmation." : booking.status === "confirmed" ? "Confirmed by the Zik agent." : "Session cancelled."}`)}`, `URL:${sessionUrl}`, ...(download ? [] : [`ORGANIZER:mailto:${organizer}`, ...Array.from(new Set([operator, booking.email])).map(email => `ATTENDEE;RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${email}`)]), `STATUS:${booking.status === "confirmed" ? "CONFIRMED" : booking.status === "cancelled" ? "CANCELLED" : "TENTATIVE"}`, "END:VEVENT", "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
async function deliver(id: string, key?: string) {
  const settings = mailSettings();
  if (!settings) return;
  const row = readAffiliateRegistrations().find(row => row.id === id)!;
  const booking = row.booking!;
  const transport = nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.port === 465, requireTLS: !settings.local && settings.port !== 465, ...(process.env.ZIK_SMTP_USER ? { auth: { user: process.env.ZIK_SMTP_USER, pass: process.env.ZIK_SMTP_PASSWORD } } : {}), connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true });
  try {
    const result = await transport.sendMail({ from: settings.from, to: Array.from(new Set([settings.operator, booking.email])), subject: `Zik onboarding ${booking.status}: ${row.name}`, text: `Site: ${row.name}\nRequested time: ${booking.startsAt} to ${booking.endsAt} (UTC)\nStatus: ${booking.status}\n\nJoin: ${settings.origin}/dashboard/affiliate/session?id=${encodeURIComponent(id)}\n${key ? `Shared pairing key: ${key}\n` : "Use the shared pairing key from your original booking email.\n"}Client: open your private setup invitation in this browser first. Agent: use your private agent access key as well as the pairing key.\n\n${booking.status === "requested" ? "This time is requested, not confirmed. The agent can confirm it in the paired session." : "The calendar invitation reflects the current appointment status."}`, icalEvent: { method: booking.status === "cancelled" ? "CANCEL" : "REQUEST", filename: "zik-onboarding.ics", content: bookingCalendar(row, settings.origin, settings.from, settings.operator) } });
    if (result.rejected?.length) throw new Error("Some recipients were rejected.");
    mutateAffiliateRegistrations(rows => { const current = rows.find(row => row.id === id)!; if (current.booking?.sequence === booking.sequence) current.booking.delivery = "sent"; });
  } catch {
    mutateAffiliateRegistrations(rows => { const current = rows.find(row => row.id === id)!; if (current.booking?.sequence === booking.sequence) current.booking.delivery = "failed"; });
  } finally { transport.close(); }
}
export async function requestBooking(id: string, token: string, email: string, startsAt: string) {
  const registration = getRegistration(id, token);
  if (!emailPattern.test(email) || email.length > 254) throw new Error("Enter a valid contact email.");
  const start = Date.parse(startsAt); const end = start + 30 * 60000;
  if (!Number.isFinite(start) || start < Date.now() + 15 * 60000 || end > Date.parse(registration.inviteExpiresAt)) throw new Error("Request a 30-minute session at least 15 minutes from now and before your setup invitation expires.");
  if (registration.booking && registration.booking.status !== "cancelled") throw new Error("This setup already has a booking request. Ask your agent to confirm or cancel it before requesting another.");
  const pair = createPair(id, token);
  mutateAffiliateRegistrations(rows => {
    const row = rows.find(row => row.id === id)!;
    if (row.booking && row.booking.status !== "cancelled") throw new Error("A booking request already exists.");
    row.booking = { id: randomUUID(), startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), email, status: "requested", delivery: bookingDeliveryAvailable() ? "sending" : "not_configured", sequence: 0, createdAt: new Date().toISOString() };
  });
  await deliver(id, pair.key);
  return { registration: getRegistration(id, token), pair };
}
export async function updateBooking(id: string, session: string, status: "confirmed" | "cancelled") {
  const progress = pairProgress(id, session);
  if (progress.ended || progress.role !== "agent") throw new Error("Only the paired agent can confirm or cancel the booking.");
  mutateAffiliateRegistrations(rows => {
    const row = rows.find(row => row.id === id)!;
    if (!row.booking || row.booking.status === "cancelled") throw new Error("No open booking request.");
    if (row.booking.status === status) throw new Error("This booking already has that status.");
    row.booking.status = status; row.booking.sequence++; row.booking.createdAt = new Date().toISOString();
    row.booking.delivery = bookingDeliveryAvailable() ? "sending" : "not_configured";
  });
  await deliver(id);
  return pairProgress(id, session);
}

/** Manual calendar copies, authorized with either a setup token or a paired-role session. */
export function calendarOptions(id: string, credential: string, scope: "setup" | "pair", requestOrigin: string) {
  if (scope === "setup") getRegistration(id, credential);
  else pairProgress(id, credential);
  const row = readAffiliateRegistrations().find(row => row.id === id)!;
  const booking = row.booking;
  if (!booking || booking.status === "cancelled") throw new Error("No open booking to add to a calendar.");
  const origin = new URL(process.env.ZIK_ONBOARDING_PUBLIC_URL || requestOrigin);
  if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) throw new Error("Invalid onboarding origin.");
  const sessionUrl = `${origin.origin}/dashboard/affiliate/session?id=${encodeURIComponent(id)}`;
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({ action: "TEMPLATE", text: `${booking.status === "requested" ? "Requested: " : ""}Zik onboarding: ${row.name}`, dates: `${stamp(booking.startsAt)}/${stamp(booking.endsAt)}`, details: `Paired onboarding: ${sessionUrl}\nStatus: ${booking.status}. Enter your shared pairing key at the session page. Agents also need their private agent access key.\nThis manually added event is a copy. Check Zik for changes or accept the email invitation for booking updates.`, location: sessionUrl }).toString();
  return { googleUrl: google.href, ics: bookingCalendar(row, origin.origin, "", "", true), filename: "zik-onboarding.ics", localOnly: ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) };
}
