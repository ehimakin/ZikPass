import nodemailer from "nodemailer";

/**
 * Generic SMTP settings + transport, factored out of the transport-creation
 * logic in affiliate-booking.ts so a second feature (recovery notifications)
 * doesn't duplicate the same validation. affiliate-booking.ts keeps its own
 * booking-specific mailSettings() (operator CC, calendar attachments) — this
 * covers only the shared "is SMTP configured, build me a transport" part.
 */

const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function validEmail(value: string): boolean {
  return emailPattern.test(value) && value.length <= 254;
}

export function smtpSettings() {
  const host = process.env.ZIK_SMTP_HOST;
  const from = process.env.ZIK_SMTP_FROM;
  if (!host || !from || !validEmail(from)) return undefined;

  const port = Number(process.env.ZIK_SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;

  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!local && (!process.env.ZIK_SMTP_USER || !process.env.ZIK_SMTP_PASSWORD)) return undefined;

  return { host, from, port, local };
}

export function smtpAvailable(): boolean {
  return Boolean(smtpSettings());
}

export async function sendMail(input: { to: string; subject: string; text: string }): Promise<boolean> {
  const settings = smtpSettings();
  if (!settings) return false;

  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: !settings.local && settings.port !== 465,
    ...(process.env.ZIK_SMTP_USER
      ? { auth: { user: process.env.ZIK_SMTP_USER, pass: process.env.ZIK_SMTP_PASSWORD } }
      : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true
  });

  try {
    const result = await transport.sendMail({
      from: settings.from,
      to: input.to,
      subject: input.subject,
      text: input.text
    });
    return !result.rejected?.length;
  } catch {
    return false;
  } finally {
    transport.close();
  }
}
