import { runtimeConfig } from "@/lib/shared/config";
import type { ProviderSimulatorScenario } from "@/lib/shared/provider-contracts";

export function resolveScenario(
  requestedScenario?: ProviderSimulatorScenario
): ProviderSimulatorScenario {
  return requestedScenario ?? "clean_adult_match";
}

export async function simulateProviderLatency(multiplier = 1): Promise<number> {
  const latencyMs = Math.max(20, Math.round(runtimeConfig.providerLatencyMs * multiplier));
  await new Promise((resolve) => setTimeout(resolve, latencyMs));
  return latencyMs;
}

export function shouldTransientScenarioRecover(
  scenario: ProviderSimulatorScenario,
  attempts: number
): boolean {
  if (scenario === "provider_unavailable" || scenario === "provider_timeout") {
    return attempts > 1;
  }

  return true;
}

export function normalizeName(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}
