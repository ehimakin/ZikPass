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
  bankVerificationMaxAttempts: Number(process.env.ZIK_BANK_MAX_ATTEMPTS ?? 3)
};
