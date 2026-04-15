import type {
  AgeCredential,
  IssuanceChannel,
  PhysicalStoreContext,
  PhysicalStoreSessionRecord
} from "@/lib/shared/types";

export interface RemoteWalletEntryContext {
  lane: "remote";
}

export interface PhysicalWalletEntryContext extends PhysicalStoreContext {
  lane: "physical";
}

export type WalletEntryContext = RemoteWalletEntryContext | PhysicalWalletEntryContext;

export function parseWalletEntryContext(
  params:
    | URLSearchParams
    | {
        get(name: string): string | null;
      }
): WalletEntryContext {
  const flow = params.get("flow");
  const sessionId = params.get("session_id");
  const storeId = params.get("store_id");
  const storeName = params.get("store_name");
  const locationId = params.get("location_id");

  if (
    flow === "physical" &&
    sessionId?.trim() &&
    storeId?.trim() &&
    storeName?.trim() &&
    locationId?.trim()
  ) {
    return {
      lane: "physical",
      session_id: sessionId.trim(),
      store_id: storeId.trim(),
      store_name: storeName.trim(),
      location_id: locationId.trim()
    };
  }

  return { lane: "remote" };
}

export function buildPhysicalWalletUrl(session: PhysicalStoreSessionRecord): string {
  const searchParams = new URLSearchParams({
    flow: "physical",
    session_id: session.session_id,
    store_id: session.store_id,
    store_name: session.store_name,
    location_id: session.location_id
  });

  return `/wallet?${searchParams.toString()}`;
}

export function formatAssuranceLevel(assuranceLevel: AgeCredential["assurance_level"]): string {
  return assuranceLevel === "in_person_verified" ? "In-person verified" : "Remote standard";
}

export function formatIssuanceChannel(channel: IssuanceChannel): string {
  return channel === "physical" ? "In store" : "Remote";
}

export function getCredentialExperienceVariant(
  credential?: Pick<AgeCredential, "assurance_level" | "issuance_channel">
): "remote" | "physical" {
  if (!credential) {
    return "remote";
  }

  return credential.issuance_channel === "physical" ||
    credential.assurance_level === "in_person_verified"
    ? "physical"
    : "remote";
}
