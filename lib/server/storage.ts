import { promises as fs } from "node:fs";
import path from "node:path";
import type { EnrollmentRecord } from "@/lib/shared/types";

interface StoreData {
  enrollments: EnrollmentRecord[];
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
  return JSON.parse(content) as StoreData;
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
