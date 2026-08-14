import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPair } from "@/lib/shared/crypto/ed25519";
import { getIssuerKeyPath } from "@/lib/server/runtime-paths";

interface IssuerKeyMaterial {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

const keyPath = getIssuerKeyPath();

export async function getIssuerKeyMaterial(): Promise<IssuerKeyMaterial> {
  await fs.mkdir(path.dirname(keyPath), { recursive: true });

  try {
    const content = await fs.readFile(keyPath, "utf8");
    return JSON.parse(content) as IssuerKeyMaterial;
  } catch {
    const keyPair = await generateKeyPair();
    await fs.writeFile(keyPath, JSON.stringify(keyPair, null, 2), "utf8");
    return keyPair;
  }
}

export async function getIssuerPublicKey(): Promise<JsonWebKey> {
  const keyMaterial = await getIssuerKeyMaterial();
  return keyMaterial.publicKeyJwk;
}
