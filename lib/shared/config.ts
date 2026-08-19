export interface RuntimeConfig {
  minOldestAccountMonths: number;
  coolingOffSeconds: number;
  physicalCoolingOffSeconds: number;
  physicalSessionTtlSeconds: number;
  physicalUserCodeTtlSeconds: number;
  physicalDeviceAuthChallengeTtlSeconds: number;
  credentialTtlHours: number;
  providerLatencyMs: number;
  bankVerificationMaxAttempts: number;
  // Device extension / payment policy. Global defaults; a StorePlanRecord
  // may override device limit, price, or currency for a specific store.
  deviceLimitIncluded: number;
  deviceExtensionPriceMinor: number;
  deviceExtensionCurrency: string;
  platformSharePercent: number;
  passIssuancePriceMinor: number;
}

export const runtimeConfig: RuntimeConfig = {
  minOldestAccountMonths: Number(process.env.ZIK_MIN_OLDEST_ACCOUNT_MONTHS ?? 12),
  coolingOffSeconds: Number(process.env.ZIK_COOLING_OFF_SECONDS ?? 10),
  physicalCoolingOffSeconds: Number(process.env.ZIK_PHYSICAL_COOLING_OFF_SECONDS ?? 0),
  physicalSessionTtlSeconds: Number(process.env.ZIK_PHYSICAL_SESSION_TTL_SECONDS ?? 900),
  physicalUserCodeTtlSeconds: Number(process.env.ZIK_PHYSICAL_CODE_TTL_SECONDS ?? 300),
  physicalDeviceAuthChallengeTtlSeconds: Number(
    process.env.ZIK_PHYSICAL_DEVICE_AUTH_TTL_SECONDS ?? 300
  ),
  credentialTtlHours: Number(process.env.ZIK_CREDENTIAL_TTL_HOURS ?? 24 * 365),
  providerLatencyMs: Number(process.env.ZIK_PROVIDER_LATENCY_MS ?? 80),
  bankVerificationMaxAttempts: Number(process.env.ZIK_BANK_MAX_ATTEMPTS ?? 3),
  deviceLimitIncluded: Number(process.env.ZIK_DEVICE_LIMIT_INCLUDED ?? 2),
  deviceExtensionPriceMinor: Number(process.env.ZIK_DEVICE_EXTENSION_PRICE_MINOR ?? 299),
  deviceExtensionCurrency: process.env.ZIK_DEVICE_EXTENSION_CURRENCY ?? "GBP",
  platformSharePercent: Number(process.env.ZIK_PLATFORM_SHARE_PERCENT ?? 20),
  passIssuancePriceMinor: Number(process.env.ZIK_PASS_ISSUANCE_PRICE_MINOR ?? 0)
};
