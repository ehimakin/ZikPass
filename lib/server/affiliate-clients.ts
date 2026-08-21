/**
 * Fixed demo affiliate registry, mirroring the pattern in retail-verifier.ts
 * (a hardcoded prototype credential rather than a real client-management
 * system). Real affiliate onboarding would register a client_id with its
 * own redirect URI allowlist server-side, never trusting a redirect_uri
 * supplied only by the browser.
 */
export interface AffiliateClientConfig {
  client_id: string;
  display_name: string;
  redirect_uris: string[];
}

const DEMO_AFFILIATE_CLIENTS: Record<string, AffiliateClientConfig> = {
  "nightfall-demo": {
    client_id: "nightfall-demo",
    display_name: "Nightfall",
    redirect_uris: ["/affiliate-demo/callback"]
  }
};

export function getAffiliateClient(clientId: string): AffiliateClientConfig | undefined {
  return DEMO_AFFILIATE_CLIENTS[clientId];
}

export function isAllowedAffiliateRedirectUri(clientId: string, redirectUri: string): boolean {
  const client = getAffiliateClient(clientId);
  return Boolean(client?.redirect_uris.includes(redirectUri));
}
