import { promises as fs } from "node:fs";
import path from "node:path";
import type { EnrollmentRecord, EnrollmentStatus } from "@/lib/shared/types";

interface StoreData {
  enrollments: EnrollmentRecord[];
}

interface LegacyEnrollmentRecord extends Omit<EnrollmentRecord, "bank_verification" | "status"> {
  possession?: {
    code: string;
    reference: string;
    status: "pending" | "verified";
    attempts: number;
    verified_at?: string;
  };
  status: EnrollmentStatus | "awaiting_possession";
}

const dataDir = path.join(process.cwd(), "data");
const statePath = path.join(dataDir, "state.json");

async function ensureStateFile() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    await fs.access(statePath);
  } catch {
    await fs.writeFile(statePath, JSON.stringify({ enrollments: [] }, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoreData> {
  await ensureStateFile();
  const content = await fs.readFile(statePath, "utf8");
  const parsed = JSON.parse(content) as { enrollments?: LegacyEnrollmentRecord[] };

  return {
    enrollments: (parsed.enrollments ?? []).map(normalizeEnrollment)
  };
}

async function writeStore(store: StoreData): Promise<void> {
  await ensureStateFile();
  await fs.writeFile(statePath, JSON.stringify(store, null, 2), "utf8");
}

export async function listEnrollments(): Promise<EnrollmentRecord[]> {
  const store = await readStore();
  return store.enrollments.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getEnrollment(id: string): Promise<EnrollmentRecord | undefined> {
  const store = await readStore();
  return store.enrollments.find((enrollment) => enrollment.id === id);
}

export async function upsertEnrollment(record: EnrollmentRecord): Promise<EnrollmentRecord> {
  const store = await readStore();
  const index = store.enrollments.findIndex((enrollment) => enrollment.id === record.id);

  if (index >= 0) {
    store.enrollments[index] = record;
  } else {
    store.enrollments.push(record);
  }

  await writeStore(store);
  return record;
}

function normalizeEnrollment(record: LegacyEnrollmentRecord): EnrollmentRecord {
  if ("bank_verification" in record && record.bank_verification) {
    return record as EnrollmentRecord;
  }

  const legacyPossession = record.possession;

  return {
    ...record,
    bank_verification: {
      bank_name: "Linked bank account",
      amount_gbp: 0.01,
      code: legacyPossession?.code ?? "000000",
      reference: legacyPossession?.reference ?? "BANK-REF-000000",
      transaction_status: legacyPossession?.status === "verified" ? "confirmed" : "sent",
      attempts: legacyPossession?.attempts ?? 0,
      sent_at: record.created_at,
      confirmed_at: legacyPossession?.verified_at
    },
    status:
      record.status === "awaiting_possession" ? "bank_verification_pending" : (record.status as EnrollmentStatus)
  };
}
