import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { getRuntimeDataDir } from "./runtime-paths";

/**
 * A generic windowed counter. Nothing like this exists elsewhere in the repo
 * (confirmed gap) — every route that needs to cap attempts or notification
 * volume (channel verify codes, finder-start spam, PIN attempts in a later
 * phase) should share this rather than growing its own ad hoc counter.
 */

type Bucket = { count: number; windowStartedAt: string };
type RateLimitData = Record<string, Bucket>;

function location() {
  return path.join(getRuntimeDataDir(), "rate-limit.json");
}

function readData(): RateLimitData {
  if (!existsSync(location())) return {};
  try {
    return JSON.parse(readFileSync(location(), "utf8")) as RateLimitData;
  } catch {
    return {};
  }
}

function writeData(data: RateLimitData) {
  mkdirSync(getRuntimeDataDir(), { recursive: true });
  const temp = `${location()}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
    renameSync(temp, location());
  } finally {
    rmSync(temp, { force: true });
  }
}

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: string };

/**
 * `key` should already namespace the action, e.g. `recovery-notify:${cardId}`
 * or `recovery-verify:${cardId}`. Not cross-process safe against concurrent
 * writers (no lock, unlike recovery-store.ts) — acceptable for a best-effort
 * abuse counter where an occasional missed increment under race is not a
 * security property, only a UX one.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const data = readData();
  const now = Date.now();
  const existing = data[key];
  const windowStart = existing ? Date.parse(existing.windowStartedAt) : now;
  const withinWindow = existing && now - windowStart < windowMs;
  const count = (withinWindow ? existing.count : 0) + 1;
  const windowStartedAt = withinWindow ? existing!.windowStartedAt : new Date(now).toISOString();

  data[key] = { count, windowStartedAt };
  writeData(data);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(Date.parse(windowStartedAt) + windowMs).toISOString()
  };
}
