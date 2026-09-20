import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PKPass } from "passkit-generator";
import { getZikEnvironment } from "@/lib/shared/demo-environment";

const required = [
  "ZIK_APPLE_PASS_TYPE_ID", "ZIK_APPLE_TEAM_ID",
  "ZIK_APPLE_SIGNER_CERT_BASE64", "ZIK_APPLE_SIGNER_KEY_BASE64", "ZIK_APPLE_WWDR_CERT_BASE64"
] as const;

export function appleWalletDemoConfigured(): boolean {
  return getZikEnvironment() !== "live" && process.env.ZIK_APPLE_WALLET_DEMO_ENABLED === "true" &&
    required.every(key => Boolean(process.env[key]?.trim()));
}

export function demoPassProperties(passTypeIdentifier: string, teamIdentifier: string) {
  return {
    formatVersion: 1 as const,
    passTypeIdentifier,
    teamIdentifier,
    // Shared across downloads: no per-person or per-device identifier.
    serialNumber: "zik-generic-demo-v1",
    organizationName: "Zik",
    description: "Zik demo pass — not proof of age or identity",
    logoText: "Zik Demo",
    backgroundColor: "rgb(214, 239, 102)",
    foregroundColor: "rgb(24, 37, 27)",
    labelColor: "rgb(40, 98, 60)",
    sharingProhibited: true
  };
}

export async function createAppleWalletDemoPass(): Promise<Buffer> {
  if (!appleWalletDemoConfigured()) throw new Error("Apple Wallet demo is not configured.");
  const pem = (key: string) => Buffer.from(process.env[key]!, "base64");
  const files = ["icon.png", "icon@2x.png", "icon@3x.png"];
  const buffers = Object.fromEntries(await Promise.all(files.map(async file => [
    file, await readFile(path.join(process.cwd(), "assets/apple-wallet", file))
  ])));
  const pass = new PKPass(buffers, {
    signerCert: pem("ZIK_APPLE_SIGNER_CERT_BASE64"),
    signerKey: pem("ZIK_APPLE_SIGNER_KEY_BASE64"),
    wwdr: pem("ZIK_APPLE_WWDR_CERT_BASE64"),
    signerKeyPassphrase: process.env.ZIK_APPLE_SIGNER_KEY_PASSPHRASE || undefined
  }, demoPassProperties(process.env.ZIK_APPLE_PASS_TYPE_ID!, process.env.ZIK_APPLE_TEAM_ID!));
  pass.type = "generic";
  pass.headerFields.push({ key: "mode", label: "STATUS", value: "DEMO ONLY" });
  pass.primaryFields.push({ key: "title", label: "ZIK", value: "Your demo pass" });
  pass.secondaryFields.push({ key: "purpose", label: "PURPOSE", value: "Wallet preview" });
  pass.auxiliaryFields.push({ key: "validity", label: "VERIFICATION", value: "Not valid for verification" });
  pass.backFields.push({ key: "demo-notice", label: "About this demo", value: "A generic demonstration of a Zik pass in Apple Wallet. Not proof of age or identity, a payment card, an activated physical card, or an order confirmation. Adding this pass does not change your Zik Pass status." });
  // Intentionally no barcode, NFC, locations, webServiceURL or authenticationToken.
  return pass.getAsBuffer();
}
