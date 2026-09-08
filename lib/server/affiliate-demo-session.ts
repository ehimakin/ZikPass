import { randomBytes } from "node:crypto";
import { getIssuerKeyMaterial } from "@/lib/server/issuer-keys";
import { signString, verifyString } from "@/lib/shared/crypto/ed25519";

export const DEMO_AFFILIATE_ID = "nightfall-demo";
export const DEMO_AFFILIATE_REDIRECT = "/affiliate-demo/callback";
export const AGE_SESSION_COOKIE = "zik-nightfall-age-session";
export const AGE_REQUEST_COOKIE = "zik-nightfall-age-request";
export const AGE_SESSION_TTL_MS = 30 * 60 * 1000;
const DOMAIN = "zik:affiliate-age-session:v1:";

interface AgeSession {
  audience: string;
  ageOver18: true;
  expiresAt: number;
  issuedAt: number;
  nonce: string;
}

/** Prototype: signed, audience-bound cookie; no identity or device key is stored in it. */
export async function createAffiliateAgeSession(passExpiresAt: string, now = Date.now()) {
  const expiresAt = Math.min(Date.parse(passExpiresAt), now + AGE_SESSION_TTL_MS);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) throw new Error("Age confirmation has expired.");
  const session: AgeSession = { audience: DEMO_AFFILIATE_ID, ageOver18: true, issuedAt: now, expiresAt, nonce: randomBytes(24).toString("base64url") };
  const encoded = Buffer.from(JSON.stringify(session)).toString("base64url");
  const keys = await getIssuerKeyMaterial();
  const signature = await signString(keys.privateKeyJwk, DOMAIN + encoded);
  return { token: `${encoded}.${signature}`, expiresAt };
}

export async function readAffiliateAgeSession(token: string | undefined, now = Date.now()): Promise<AgeSession | null> {
  if (!token || token.length > 2048) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    const keys = await getIssuerKeyMaterial();
    if (!await verifyString(keys.publicKeyJwk, DOMAIN + encoded, signature)) return null;
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString()) as AgeSession;
    if (session.audience !== DEMO_AFFILIATE_ID || session.ageOver18 !== true || !Number.isFinite(session.expiresAt)
      || !Number.isFinite(session.issuedAt) || session.issuedAt > now || session.expiresAt <= now
      || session.expiresAt - session.issuedAt > AGE_SESSION_TTL_MS || typeof session.nonce !== "string") return null;
    return session;
  } catch { return null; }
}

export function affiliateCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
}
