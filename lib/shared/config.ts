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
  // How long a visitor who has already seen the homepage splash goes
  // without seeing it again. Below this, reloads/revisits stay quiet.
  // Short in dev by default so the branding is easy to see while working;
  // long in production so real visitors aren't shown it on every reload.
  homepageSplashSuppressSeconds: number;
  // Affiliate age-check demo: how long a signing challenge and an issued
  // one-time authorization code each remain valid.
  affiliateChallengeTtlSeconds: number;
  affiliateAuthorizationCodeTtlSeconds: number;
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
  passIssuancePriceMinor: Number(process.env.ZIK_PASS_ISSUANCE_PRICE_MINOR ?? 0),
  homepageSplashSuppressSeconds: Number(
    process.env.ZIK_HOMEPAGE_SPLASH_SUPPRESS_SECONDS ??
      (process.env.NODE_ENV === "production" ? 1800 : 120)
  ),
  affiliateChallengeTtlSeconds: Number(process.env.ZIK_AFFILIATE_CHALLENGE_TTL_SECONDS ?? 120),
  affiliateAuthorizationCodeTtlSeconds: Number(
    process.env.ZIK_AFFILIATE_CODE_TTL_SECONDS ?? 120
  )
};
