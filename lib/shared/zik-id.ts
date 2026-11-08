import type { PresentationBundle } from "@/lib/shared/types";
import { boundedString, deviceSelfie, strictObject } from "@/lib/shared/vault";

export interface ZikIdDisclosedFields {
  over18: true;
  legalName?: string;
  deliveryAddress?: string;
  email?: string;
}

export interface ZikIdPeerPayload {
  version: 1;
  sessionId: string;
  sharedAt: string;
  selfie: string;
  disclosed: ZikIdDisclosedFields;
  presentation: PresentationBundle;
}

export function parseZikIdPeerPayload(value: unknown): ZikIdPeerPayload {
  const record = strictObject(value, ["version", "sessionId", "sharedAt", "selfie", "disclosed", "presentation"]);
  if (record.version !== 1 || typeof record.sharedAt !== "string" || !Number.isFinite(Date.parse(record.sharedAt))) throw new Error("Invalid Zik ID payload.");
  const disclosed = strictObject(record.disclosed, ["over18"], ["legalName", "deliveryAddress", "email"]);
  if (disclosed.over18 !== true) throw new Error("Invalid Zik ID payload.");
  const optional = (key: "legalName" | "deliveryAddress" | "email") => disclosed[key] === undefined ? undefined : boundedString(disclosed[key], 512);
  const presentation = record.presentation;
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) throw new Error("Invalid Zik ID payload.");
  return {
    version: 1,
    sessionId: boundedString(record.sessionId, 64),
    sharedAt: record.sharedAt,
    selfie: deviceSelfie({ data_url: record.selfie, provenance: "device_selfie", captured_at: record.sharedAt }).data_url,
    disclosed: {
      over18: true,
      ...(optional("legalName") ? { legalName: optional("legalName") } : {}),
      ...(optional("deliveryAddress") ? { deliveryAddress: optional("deliveryAddress") } : {}),
      ...(optional("email") ? { email: optional("email") } : {})
    },
    presentation: presentation as PresentationBundle
  };
}
