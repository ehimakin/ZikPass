import { getStoreById } from "@/lib/shared/stores";

export interface AuthorizedRetailVerifier {
  verifier_id: string;
  retailer_id: string;
  retailer_name: string;
  location_id: string;
  verification_method: "physical_id_check";
}

const DEMO_RETAIL_VERIFIER_TOKEN =
  process.env.ZIK_DEMO_RETAIL_VERIFIER_TOKEN ?? "demo-retail-terminal";

// Fixed identity used when no store scope is supplied (legacy callers/tests).
const DEFAULT_STORE_ID = "zik-london-001";

export function getDemoRetailVerifierToken(): string {
  return DEMO_RETAIL_VERIFIER_TOKEN;
}

/**
 * Authenticate a retail clerk terminal and scope it to a specific store.
 *
 * The demo still uses a single shared terminal token (see AUDIT.md C1 - a
 * chosen entry mode / shared secret is not proof of a real till sale). What
 * changed: the returned identity is now derived from the shared store
 * catalogue for the `storeId` in play, so a session created for one store
 * resolves to that store's clerk identity and the caller's downstream
 * `session.store_id === verifier.retailer_id` check enforces store scope
 * across all catalogue locations - not just Oxford Street.
 */
export function authenticateRetailVerifier(
  token: string | undefined,
  storeId?: string
): AuthorizedRetailVerifier {
  if (!token || token !== DEMO_RETAIL_VERIFIER_TOKEN) {
    throw new Error("An authorised retail verifier session is required.");
  }

  const store = getStoreById(storeId) ?? getStoreById(DEFAULT_STORE_ID);

  if (!store) {
    throw new Error("No store catalogue entry is available for this verifier session.");
  }

  return {
    verifier_id: store.operator.verifierId,
    retailer_id: store.id,
    retailer_name: store.name,
    location_id: store.operator.locationId,
    verification_method: "physical_id_check"
  };
}
