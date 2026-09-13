/**
 * Fixed demo affiliate registry, mirroring the pattern in retail-verifier.ts
 * (a hardcoded prototype credential rather than a real client-management
 * system). Real affiliate onboarding would register a client_id with its
 * own redirect URI allowlist server-side, never trusting a redirect_uri
 * supplied only by the browser.
 */
import { timingSafeEqual } from "node:crypto";

export interface AffiliateClientConfig {
  client_id: string;
  display_name: string;
  redirect_uris: string[];
}

const DEMO_AFFILIATE_CLIENTS: Record<string, AffiliateClientConfig> = {
  "harbour-demo": { client_id: "harbour-demo", display_name: "Harbour & Pine", redirect_uris: ["/retail-demo"] },
  "nightfall-demo": {
    client_id: "nightfall-demo",
    display_name: "JerkMeat",
    redirect_uris: ["/affiliate-demo/callback"]
  }
};

/** External standalone affiliates that read their own redirect URI + secret from env, keyed by client_id. */
const EXTERNAL_AFFILIATE_ENV: Record<string, { redirectUriEnv: string; clientSecretEnv: string; displayName: string }> = {
  jerkmeat: { redirectUriEnv: "ZIK_JERKMEAT_REDIRECT_URI", clientSecretEnv: "ZIK_JERKMEAT_CLIENT_SECRET", displayName: "JerkMeat" },
  pomhub: { redirectUriEnv: "ZIK_POMHUB_REDIRECT_URI", clientSecretEnv: "ZIK_POMHUB_CLIENT_SECRET", displayName: "PomHub" },
  pomography: { redirectUriEnv: "ZIK_POMOGRAPHY_REDIRECT_URI", clientSecretEnv: "ZIK_POMOGRAPHY_CLIENT_SECRET", displayName: "Pomography" }
};

export function getAffiliateClient(clientId: string): AffiliateClientConfig | undefined {
  const external = EXTERNAL_AFFILIATE_ENV[clientId];
  if (external) {
    const redirectUri = process.env[external.redirectUriEnv];
    if (!redirectUri || !process.env[external.clientSecretEnv]) return undefined;
    return { client_id: clientId, display_name: external.displayName, redirect_uris: [redirectUri] };
  }
  return DEMO_AFFILIATE_CLIENTS[clientId];
}

/** External affiliates authenticate from their backend; never expose this secret to a browser. */
export function authenticateAffiliateClient(clientId: string, authorization: string | null): boolean {
  if (clientId === "nightfall-demo") return true; // Existing embedded prototype only.
  const external = EXTERNAL_AFFILIATE_ENV[clientId];
  if (!external || !getAffiliateClient(clientId)) return false;
  const expected = Buffer.from(`Bearer ${process.env[external.clientSecretEnv]}`);
  const actual = Buffer.from(authorization ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isAllowedAffiliateRedirectUri(clientId: string, redirectUri: string): boolean {
  const client = getAffiliateClient(clientId);
  return Boolean(client?.redirect_uris.includes(redirectUri));
}
