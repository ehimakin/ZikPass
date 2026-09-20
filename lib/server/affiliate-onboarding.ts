import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getRuntimeDataDir } from "./runtime-paths";

export interface AffiliateRegistration {
  id: string; name: string; website: string; callback: string; createdAt: string;
  inviteHash: string; inviteExpiresAt: string; secretHash?: string;
  state: "draft" | "testing" | "active" | "disabled";
  connectedAt?: string; verifiedAt?: string;
  booking?: { id: string; startsAt: string; endsAt: string; email: string; status: "requested" | "confirmed" | "cancelled"; delivery: "not_configured" | "sending" | "sent" | "failed"; sequence: number; createdAt: string };
  pair?: { keyHash: string; createdAt: string; expiresAt: string; client?: { tokenHash: string; lastSeen: string }; agent?: { tokenHash: string; lastSeen: string }; form: Record<string, string>; guidance: string };
  assistance?: { email: string; note: string; requestedAt: string };
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function developmentOnboardingEnabled() { return process.env.NODE_ENV === "development" || (process.env.NODE_ENV === "test"); }
function location() { return path.join(getRuntimeDataDir(), "affiliate-onboarding.json"); }
export function readAffiliateRegistrations(): AffiliateRegistration[] {
  if (!existsSync(location())) return [];
  return JSON.parse(readFileSync(location(), "utf8")) as AffiliateRegistration[];
}
// Local development store: atomic replacement plus an exclusive cross-process writer lock.
export function mutateAffiliateRegistrations<T>(fn: (rows: AffiliateRegistration[]) => T): T {
  if (!developmentOnboardingEnabled()) throw new Error("Development onboarding is unavailable.");
  mkdirSync(getRuntimeDataDir(), { recursive: true });
  const lock = `${location()}.lock`;
  try { mkdirSync(lock); } catch { throw new Error("Onboarding is busy. Please retry."); }
  try {
    const rows = readAffiliateRegistrations(); const result = fn(rows);
    const temp = `${location()}.${randomBytes(8).toString("hex")}.tmp`;
    try { writeFileSync(temp, JSON.stringify(rows, null, 2), { mode: 0o600 }); renameSync(temp, location()); }
    finally { rmSync(temp, { force: true }); }
    return result;
  } finally { rmSync(lock, { recursive: true, force: true }); }
}
function equalHash(value: string, expected: string) {
  const actual = Buffer.from(hash(value)); const other = Buffer.from(expected);
  return actual.length === other.length && timingSafeEqual(actual, other);
}
function authorized(rows: AffiliateRegistration[], id: string, token: string) {
  const row = rows.find(row => row.id === id);
  if (!row || !equalHash(token, row.inviteHash) || Date.parse(row.inviteExpiresAt) <= Date.now()) throw new Error("This setup link is invalid or expired.");
  return row;
}
export function publicRegistration(row: AffiliateRegistration) {
  const { inviteHash: _invite, secretHash: _secret, pair: _pair, ...safe } = row;
  void _invite; void _secret; void _pair;
  return safe;
}
export function createRegistration(name: string, website: string, callback: string) {
  name = name.trim();
  if (!name || name.length > 100) throw new Error("Enter a site name of up to 100 characters.");
  const site = new URL(website); const redirect = new URL(callback);
  for (const url of [site, redirect]) {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && local)) || url.username || url.password || url.hash || url.search) throw new Error("Use HTTPS, or HTTP on localhost, without credentials, queries or fragments.");
  }
  if (site.origin !== redirect.origin) throw new Error("The callback must belong to your website’s origin.");
  const token = randomBytes(32).toString("base64url");
  const row: AffiliateRegistration = { id: `zik_dev_${randomBytes(12).toString("hex")}`, name, website: site.origin, callback: redirect.href, createdAt: new Date().toISOString(), inviteHash: hash(token), inviteExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), state: "draft" };
  return mutateAffiliateRegistrations(rows => { rows.push(row); return { registration: publicRegistration(row), token }; });
}
export function getRegistration(id: string, token: string) {
  if (!developmentOnboardingEnabled()) throw new Error("Development onboarding is unavailable.");
  return publicRegistration(authorized(readAffiliateRegistrations(), id, token));
}
export function updateRegistration(id: string, token: string, action: string, input: { email?: string; note?: string } = {}) {
  return mutateAffiliateRegistrations(rows => {
    const row = authorized(rows, id, token);
    let secret: string | undefined;
    if (action === "credentials") {
      secret = `zik_dev_secret_${randomBytes(32).toString("base64url")}`;
      row.secretHash = hash(secret); row.state = "testing"; delete row.connectedAt; delete row.verifiedAt;
    } else if (action === "activate") {
      if (row.state !== "testing" || !row.connectedAt || !row.verifiedAt) throw new Error("Complete a successful age-check round trip before activation.");
      row.state = "active";
    } else if (action === "disable") { row.state = "disabled"; }
    else if (action === "assistance") {
      const email = input.email?.trim() ?? ""; const note = input.note?.trim() ?? "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || note.length > 2000) throw new Error("Enter a valid email and a note of up to 2,000 characters.");
      row.assistance = { email, note, requestedAt: new Date().toISOString() };
    } else throw new Error("Unknown setup action.");
    return { registration: publicRegistration(row), ...(secret ? { secret } : {}) };
  });
}
export function registeredAffiliate(id: string) {
  if (!developmentOnboardingEnabled()) return undefined;
  return readAffiliateRegistrations().find(row => row.id === id && (row.state === "testing" || row.state === "active") && row.secretHash);
}
export function authenticateRegisteredAffiliate(id: string, authorization: string | null) {
  const row = registeredAffiliate(id);
  return Boolean(row?.secretHash && authorization?.startsWith("Bearer ") && equalHash(authorization.slice(7), row.secretHash));
}
export function recordAffiliateEvidence(id: string, kind: "connectedAt" | "verifiedAt") {
  if (!registeredAffiliate(id)) return;
  mutateAffiliateRegistrations(rows => { const row = rows.find(row => row.id === id)!; row[kind] = new Date().toISOString(); });
}

export function createPair(id: string, token: string) {
  return mutateAffiliateRegistrations(rows => {
    const row = authorized(rows, id, token);
    if (row.booking && row.booking.status !== "cancelled") throw new Error("Cancel the existing booking before replacing its paired session.");
    const key = randomBytes(18).toString("base64url");
    row.pair = { keyHash: hash(key), createdAt: new Date().toISOString(), expiresAt: new Date(Math.min(Date.parse(row.inviteExpiresAt), Date.now() + 7 * 86400000)).toISOString(), form: {}, guidance: "" };
    return { id: row.id, key, expiresAt: row.pair.expiresAt };
  });
}
function validPair(row: AffiliateRegistration | undefined) {
  if (!row?.pair || Date.parse(row.pair.expiresAt) <= Date.now()) throw new Error("This paired session is unavailable or expired.");
  return row.pair;
}
export function joinPair(id: string, key: string, role: "client" | "agent", credential: string) {
  return mutateAffiliateRegistrations(rows => {
    const row = rows.find(row => row.id === id); const pair = validPair(row);
    if (!equalHash(key, pair.keyHash)) throw new Error("Invalid pairing key.");
    if (role === "client") authorized(rows, id, credential);
    else {
      const expected = process.env.ZIK_ONBOARDING_AGENT_KEY;
      if (!expected || expected.length < 32 || !equalHash(credential, hash(expected))) throw new Error("Invalid agent credential.");
    }
    const session = randomBytes(32).toString("base64url");
    pair[role] = { tokenHash: hash(session), lastSeen: new Date().toISOString() };
    return { session, role };
  });
}
export function pairProgress(id: string, session: string, input?: { form?: Record<string, string>; guidance?: string; end?: boolean }) {
  return mutateAffiliateRegistrations(rows => {
    const row = rows.find(row => row.id === id); const pair = validPair(row);
    const role = pair.client && equalHash(session, pair.client.tokenHash) ? "client" : pair.agent && equalHash(session, pair.agent.tokenHash) ? "agent" : undefined;
    if (!role) throw new Error("Join this session first.");
    pair[role]!.lastSeen = new Date().toISOString();
    if (input?.end) { delete pair.client; delete pair.agent; return { ended: true as const }; }
    if (input?.form) {
      if (role !== "client") throw new Error("Only the client can edit their form.");
      const allowed = ["organisation", "framework", "contact", "implementation", "question"];
      for (const [field, value] of Object.entries(input.form)) {
        if (!allowed.includes(field) || typeof value !== "string" || value.length > 2000) throw new Error("Invalid shared form field.");
      }
      pair.form = { ...pair.form, ...input.form };
    }
    if (input?.guidance !== undefined) {
      if (role !== "agent" || typeof input.guidance !== "string" || input.guidance.length > 2000) throw new Error("Invalid agent guidance.");
      pair.guidance = input.guidance;
    }
    const online = (value?: { lastSeen: string }) => Boolean(value && Date.parse(value.lastSeen) > Date.now() - 15000);
    return { ended: false as const, role, clientOnline: online(pair.client), agentOnline: online(pair.agent), form: pair.form, guidance: pair.guidance, registration: publicRegistration(row!), expiresAt: pair.expiresAt };
  });
}
