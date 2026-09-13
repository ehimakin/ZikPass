import { randomBytes, timingSafeEqual } from "node:crypto";
import { getIssuerKeyMaterial } from "@/lib/server/issuer-keys";
import { signString, verifyString } from "@/lib/shared/crypto/ed25519";
import { isLiveEnvironment } from "@/lib/shared/demo-environment";
import { getStoreById } from "@/lib/shared/stores";

export const OPERATOR_SESSION_COOKIE = "zik-operator-session";
export const OPERATOR_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DOMAIN = "zik:operator-session:v1:";

export interface OperatorSession {
  storeId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function configuredLoginCode(): string | null {
  const configured = process.env.ZIK_CLERK_LOGIN_CODE?.trim();
  if (configured) return configured;
  return isLiveEnvironment ? null : "8640";
}

export function verifyOperatorLoginCode(input: string): boolean {
  const expected = configuredLoginCode();
  if (!expected || input.length > 64) return false;
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function createOperatorSession(storeId: string, now = Date.now()) {
  if (!getStoreById(storeId)) throw new Error("Choose a valid store.");
  const session: OperatorSession = {
    storeId,
    issuedAt: now,
    expiresAt: now + OPERATOR_SESSION_TTL_MS,
    nonce: randomBytes(24).toString("base64url")
  };
  const encoded = Buffer.from(JSON.stringify(session)).toString("base64url");
  const keys = await getIssuerKeyMaterial();
  const signature = await signString(keys.privateKeyJwk, DOMAIN + encoded);
  return { token: `${encoded}.${signature}`, expiresAt: session.expiresAt };
}

export async function readOperatorSession(token: string | undefined, now = Date.now()): Promise<OperatorSession | null> {
  if (!token || token.length > 2048) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    const keys = await getIssuerKeyMaterial();
    if (!await verifyString(keys.publicKeyJwk, DOMAIN + encoded, signature)) return null;
    const session = JSON.parse(Buffer.from(encoded, "base64url").toString()) as OperatorSession;
    if (!getStoreById(session.storeId) || !Number.isFinite(session.issuedAt)
      || !Number.isFinite(session.expiresAt) || session.issuedAt > now || session.expiresAt <= now
      || session.expiresAt - session.issuedAt > OPERATOR_SESSION_TTL_MS
      || typeof session.nonce !== "string" || session.nonce.length < 16) return null;
    return session;
  } catch {
    return null;
  }
}

export function operatorCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.floor(OPERATOR_SESSION_TTL_MS / 1000)
  };
}
