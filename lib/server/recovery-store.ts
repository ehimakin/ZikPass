import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getRuntimeDataDir } from "./runtime-paths";
import type {
  BorrowedSession,
  FinderSession,
  NotificationChannel,
  RecoveryCard,
  RecoveryConversation,
  RecoveryMessage
} from "@/lib/shared/recovery/types";

interface RecoveryStoreData {
  cards: RecoveryCard[];
  conversations: RecoveryConversation[];
  messages: RecoveryMessage[];
  borrowed_sessions: BorrowedSession[];
  finder_sessions: FinderSession[];
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function equalHash(value: string, expected: string): boolean {
  const actual = Buffer.from(hash(value));
  const other = Buffer.from(expected);
  return actual.length === other.length && timingSafeEqual(actual, other);
}

export function hashSecret(value: string): string {
  return hash(value);
}

function location() {
  return path.join(getRuntimeDataDir(), "recovery-store.json");
}

function readStore(): RecoveryStoreData {
  if (!existsSync(location())) {
    return { cards: [], conversations: [], messages: [], borrowed_sessions: [], finder_sessions: [] };
  }
  const parsed = JSON.parse(readFileSync(location(), "utf8")) as Partial<RecoveryStoreData>;
  return {
    cards: parsed.cards ?? [],
    conversations: parsed.conversations ?? [],
    messages: parsed.messages ?? [],
    borrowed_sessions: parsed.borrowed_sessions ?? [],
    finder_sessions: parsed.finder_sessions ?? []
  };
}

/**
 * Same cross-process-safe pattern as affiliate-onboarding.ts: atomic replace
 * guarded by an exclusive lock directory — with one deliberate difference.
 * affiliate-onboarding.ts only persists when `fn` returns normally, which
 * silently drops any mutation made before a thrown validation error (mostly
 * harmless there — e.g. a lost `lastSeen` touch). Here it isn't harmless:
 * confirmChannelVerification increments `verify_attempts` and then throws on
 * a wrong code, and that increment must survive the throw or the attempt
 * limit never actually limits anything. So this always writes back whatever
 * `fn` mutated, then re-throws.
 */
export function mutateRecoveryStore<T>(fn: (store: RecoveryStoreData) => T): T {
  mkdirSync(getRuntimeDataDir(), { recursive: true });
  const lock = `${location()}.lock`;
  try {
    mkdirSync(lock);
  } catch {
    throw new Error("Recovery storage is busy. Please retry.");
  }
  try {
    const store = readStore();
    let result: T;
    let hasError = false;
    let caught: unknown;
    try {
      result = fn(store);
    } catch (error) {
      hasError = true;
      caught = error;
      result = undefined as T;
    }

    const temp = `${location()}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      writeFileSync(temp, JSON.stringify(store, null, 2), { mode: 0o600 });
      renameSync(temp, location());
    } finally {
      rmSync(temp, { force: true });
    }

    if (hasError) throw caught;
    return result;
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export function readRecoveryStore(): RecoveryStoreData {
  return readStore();
}

export function getCard(cardId: string): RecoveryCard | undefined {
  return readStore().cards.find((card) => card.card_id === cardId);
}

export function getConversation(conversationId: string): RecoveryConversation | undefined {
  return readStore().conversations.find((conversation) => conversation.conversation_id === conversationId);
}

export function listMessages(conversationId: string): RecoveryMessage[] {
  return readStore()
    .messages.filter((message) => message.conversation_id === conversationId)
    .sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at));
}

export function getActiveChannel(card: RecoveryCard): NotificationChannel | undefined {
  return card.channel?.verified_at ? card.channel : undefined;
}
