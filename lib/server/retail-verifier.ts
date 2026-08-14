export interface AuthorizedRetailVerifier {
  verifier_id: string;
  retailer_id: string;
  retailer_name: string;
  location_id: string;
  verification_method: "physical_id_check";
}

const DEMO_RETAIL_VERIFIER_TOKEN =
  process.env.ZIK_DEMO_RETAIL_VERIFIER_TOKEN ?? "demo-retail-terminal";

export function getDemoRetailVerifierToken(): string {
  return DEMO_RETAIL_VERIFIER_TOKEN;
}

export function authenticateRetailVerifier(token: string | undefined): AuthorizedRetailVerifier {
  if (!token || token !== DEMO_RETAIL_VERIFIER_TOKEN) {
    throw new Error("An authorised retail verifier session is required.");
  }

  return {
    verifier_id: "demo-clerk-terminal-001",
    retailer_id: "zik-london-001",
    retailer_name: "Zik Oxford Street",
    location_id: "front-desk",
    verification_method: "physical_id_check"
  };
}
