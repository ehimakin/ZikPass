import "server-only";

const SESSION_TTL_MS = 2 * 60 * 1000;
const MAX_SDP_LENGTH = 200_000;

export interface ZikIdSignalSession {
  id: string;
  code: string;
  challenge: string;
  offer: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: string;
  expiresAt: string;
}

const runtime = globalThis as typeof globalThis & { __zikIdSignalSessions?: Map<string, ZikIdSignalSession> };
const sessions = runtime.__zikIdSignalSessions ??= new Map<string, ZikIdSignalSession>();

function parseDescription(value: unknown, expected: "offer" | "answer"): RTCSessionDescriptionInit {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid connection description.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["type", "sdp"].includes(key)) || record.type !== expected || typeof record.sdp !== "string" || !record.sdp || record.sdp.length > MAX_SDP_LENGTH) {
    throw new Error("Invalid connection description.");
  }
  return { type: expected, sdp: record.sdp };
}

function prune(now = Date.now()) {
  for (const [id, session] of sessions) if (Date.parse(session.expiresAt) <= now) sessions.delete(id);
}

export function createZikIdSignalSession(offerValue: unknown, now = Date.now()): ZikIdSignalSession {
  prune(now);
  const offer = parseDescription(offerValue, "offer");
  const id = crypto.randomUUID();
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
  const session: ZikIdSignalSession = {
    id,
    code,
    challenge: `zik_id_v1:${id}:${nonce}`,
    offer,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString()
  };
  sessions.set(id, session);
  return structuredClone(session);
}

export function readZikIdSignalSession(id: string, code: string, now = Date.now()): ZikIdSignalSession | undefined {
  prune(now);
  const session = sessions.get(id);
  if (!session || session.code !== code) return undefined;
  return structuredClone(session);
}

export function answerZikIdSignalSession(id: string, code: string, answerValue: unknown, now = Date.now()): ZikIdSignalSession {
  const session = readZikIdSignalSession(id, code, now);
  if (!session) throw new Error("This Zik ID request is invalid or has expired.");
  if (session.answer) throw new Error("This Zik ID request has already been claimed.");
  session.answer = parseDescription(answerValue, "answer");
  sessions.set(id, session);
  return structuredClone(session);
}

export function consumeZikIdSignalSession(id: string, code: string): boolean {
  const session = sessions.get(id);
  if (!session || session.code !== code) return false;
  sessions.delete(id);
  return true;
}

export function resetZikIdSignalSessions() {
  sessions.clear();
}

export const resetZikIdSignalSessionsForTests = resetZikIdSignalSessions;
