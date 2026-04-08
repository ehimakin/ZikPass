export interface RuntimeConfig {
  minOldestAccountMonths: number;
  coolingOffSeconds: number;
  credentialTtlHours: number;
}

export const runtimeConfig: RuntimeConfig = {
  minOldestAccountMonths: Number(process.env.ZIK_MIN_OLDEST_ACCOUNT_MONTHS ?? 12),
  coolingOffSeconds: Number(process.env.ZIK_COOLING_OFF_SECONDS ?? 10),
  credentialTtlHours: Number(process.env.ZIK_CREDENTIAL_TTL_HOURS ?? 24 * 365)
};
