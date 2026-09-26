/** Replace this adapter with the payment/check provider at launch.
 * Preview records are deliberately separate from signed wallet credentials. */
export type FinanceApplication = { version: 1; mode: "preview"; paidAt: number; readyAt: number };
export interface FinanceCheckGateway {
  load(): FinanceApplication | null;
  checkout(): Promise<FinanceApplication>;
}
const KEY = "zik-finance-application-v1";
export function financeStatus(record: FinanceApplication, now = Date.now()) {
  return now >= record.readyAt ? "approved" : "pending";
}
export const financeCheckGateway: FinanceCheckGateway = {
  load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      const record = JSON.parse(raw) as FinanceApplication;
      return record.version === 1 && record.mode === "preview" && Number.isFinite(record.paidAt) && Number.isFinite(record.readyAt) && record.readyAt >= record.paidAt ? record : null;
    } catch { return null; }
  },
  async checkout() {
    const existing = this.load();
    if (existing) return existing;
    await new Promise(resolve => setTimeout(resolve, 1200));
    const paidAt = Date.now();
    const record: FinanceApplication = { version: 1, mode: "preview", paidAt, readyAt: paidAt + 30000 };
    localStorage.setItem(KEY, JSON.stringify(record));
    return record;
  }
};
