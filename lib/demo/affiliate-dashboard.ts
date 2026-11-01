/** Illustrative inputs only. No production pricing, eligibility or settlement policy. */
export const demoNetwork = { affiliateWeight: 2, totalWeight: 200, grossRevenue: 10000 } as const;
export function calculateAllocation(grossRevenue: number, affiliateWeight: number, totalWeight: number) {
  if (![grossRevenue, affiliateWeight, totalWeight].every(Number.isFinite) || grossRevenue < 0 || affiliateWeight <= 0 || totalWeight < affiliateWeight) {
    throw new RangeError("Expected nonnegative revenue and positive weights within the network total.");
  }
  const participants = grossRevenue * 0.6;
  const pool = participants * 0.55;
  const share = affiliateWeight / totalWeight;
  return { zik: grossRevenue * 0.4, participants, store: participants * 0.45, pool, share, allocation: pool * share };
}
export function simulateAllocation(grossRevenue: number, additionalAffiliates: number) {
  if (!Number.isInteger(additionalAffiliates) || additionalAffiliates < 0) throw new RangeError("Additional affiliates must be a nonnegative integer.");
  return calculateAllocation(grossRevenue, demoNetwork.affiliateWeight, demoNetwork.totalWeight + additionalAffiliates);
}
export const reportingWindows = [
  { window: "1–7 Sep 2026", activity: "420", treatment: "Aggregate example" },
  { window: "8–14 Sep 2026", activity: "560", treatment: "Aggregate example" },
  { window: "15–28 Aug 2026", activity: "Combined / withheld", treatment: "Low-volume windows combined; count withheld" }
];
export const allocationHistory = [
  { window: "1–14 Sep 2026", gross: 10000, totalWeight: 200, status: "Awaiting review (simulation)" },
  { window: "15–31 Aug 2026", gross: 8000, totalWeight: 200, status: "Settled (simulation)" },
  { window: "1–14 Aug 2026", gross: 6000, totalWeight: 160, status: "Settled (simulation)" }
];
export const demoProducts = [
  { name: "Zik Card", price: "£1.99", detail: "Physical card · proposed eligible purchase pool" },
  { name: "Zik Pass", price: "99p", detail: "Digital pass · proposed capped free pioneer phase, then 99p" },
  { name: "Zik Vault", price: "£4.20 / year", detail: "Potential pool contribution is a proposal only" },
  { name: "Zik Vault+", price: "£11.88 / year", detail: "Includes Vault and encrypted backup; storage allowance to be defined" },
  { name: "Zik ID", price: "£2.99", detail: "Initial issuance · no active pool contribution assumed" },
  { name: "Zik Verify", price: "From £9.99", detail: "Proposed price per professional check" }
];
export const money = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
export const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
