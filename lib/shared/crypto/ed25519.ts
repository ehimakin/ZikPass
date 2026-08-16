import { base64UrlToBytes, bytesToBase64Url, toUtf8Bytes } from "@/lib/shared/utils";

export interface ExportedKeyPair {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

export async function generateKeyPair(): Promise<ExportedKeyPair> {
  const subtle = getSubtleCrypto();
  const keyPair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKeyJwk = await subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await subtle.exportKey("jwk", keyPair.privateKey);

  return { publicKeyJwk, privateKeyJwk };
}

export async function signString(privateKeyJwk: JsonWebKey, payload: string): Promise<string> {
  const subtle = getSubtleCrypto();
  const privateKey = await subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "Ed25519" },
    false,
    ["sign"]
  );

  const signature = await subtle.sign(
    "Ed25519",
    privateKey,
    toArrayBuffer(toUtf8Bytes(payload))
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function verifyString(
  publicKeyJwk: JsonWebKey,
  payload: string,
  signature: string
): Promise<boolean> {
  const subtle = getSubtleCrypto();
  const publicKey = await subtle.importKey(
    "jwk",
    publicKeyJwk,
    { name: "Ed25519" },
    false,
    ["verify"]
  );

  return subtle.verify(
    "Ed25519",
    publicKey,
    toArrayBuffer(base64UrlToBytes(signature)),
    toArrayBuffer(toUtf8Bytes(payload))
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function getSubtleCrypto(): SubtleCrypto {
  const cryptoApi =
    typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;
  const subtle =
    cryptoApi?.subtle ??
    ((cryptoApi as Crypto & { webkitSubtle?: SubtleCrypto } | undefined)?.webkitSubtle ?? null);

  if (subtle) {
    return subtle;
  }

  const secureContextHint =
    typeof window !== "undefined" && !window.isSecureContext
      ? " Open the app on localhost or HTTPS instead of a LAN IP or other insecure origin."
      : "";

  throw new Error(
    `This browser session does not expose Web Crypto signing APIs.${secureContextHint}`
  );
}
