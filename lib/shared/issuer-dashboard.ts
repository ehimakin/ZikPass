import type { CoolingOffState, EnrollmentRecord, NotificationRecord } from "@/lib/shared/types";

export type IssuerSessionRecord = Partial<EnrollmentRecord> & { id?: string };

export function formatAdminDateTime(
  value?: string,
  fallback = "Not yet"
): string {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

export function formatFingerprint(value?: string): string {
  if (!value?.trim()) {
    return "Fingerprint unavailable";
  }

  return `Fingerprint ${value.slice(0, 16)}...`;
}

export function formatCurrencyGbp(value?: number): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `GBP ${value.toFixed(2)}`
    : "GBP unavailable";
}

export function getNotificationRecords(
  notifications?: NotificationRecord[]
): NotificationRecord[] {
  return Array.isArray(notifications) ? notifications : [];
}

export function getRemainingSeconds(
  coolingOff?: Partial<CoolingOffState>,
  now = Date.now()
): number | null {
  if (!coolingOff?.ends_at) {
    return null;
  }

  const endsAt = new Date(coolingOff.ends_at).getTime();
  if (Number.isNaN(endsAt)) {
    return null;
  }

  return Math.max(Math.ceil((endsAt - now) / 1000), 0);
}

export function isCoolingComplete(
  coolingOff?: Partial<CoolingOffState>,
  now = Date.now()
): boolean {
  if (coolingOff?.manually_advanced) {
    return true;
  }

  const remainingSeconds = getRemainingSeconds(coolingOff, now);
  return remainingSeconds === 0;
}

export function stringifyForAdmin(value: unknown, fallback: string): string {
  if (value === undefined || value === null) {
    return fallback;
  }

  return JSON.stringify(value, null, 2);
}
