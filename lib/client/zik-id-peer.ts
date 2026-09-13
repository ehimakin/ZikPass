"use client";

export async function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error("The direct connection could not be prepared.")); }, 10000);
    const change = () => { if (peer.iceGatheringState === "complete") { cleanup(); resolve(); } };
    const cleanup = () => { window.clearTimeout(timeout); peer.removeEventListener("icegatheringstatechange", change); };
    peer.addEventListener("icegatheringstatechange", change);
  });
}

export async function performPlatformUserVerification(): Promise<void> {
  if (!("PublicKeyCredential" in window) || !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) {
    throw new Error("Face ID, fingerprint or a device passcode is required to present Zik ID on this device.");
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const existing = await navigator.credentials.get({ publicKey: { challenge, rpId: window.location.hostname, timeout: 60000, userVerification: "required" } });
    if (existing) return;
  } catch {
    // No discoverable credential exists for this origin yet. Enrol one locally.
  }
  const userId = crypto.getRandomValues(new Uint8Array(32));
  const created = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Zik Pass", id: window.location.hostname },
      user: { id: userId, name: "zik-id-device", displayName: "Zik ID on this device" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" },
      timeout: 60000,
      attestation: "none"
    }
  });
  if (!created) throw new Error("Device authentication was cancelled.");
}

export async function sendChunkedJson(channel: RTCDataChannel, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  if (serialized.length > 400_000) throw new Error("This Zik ID presentation is too large to share directly.");
  const chunks = Array.from({ length: Math.ceil(serialized.length / 12_000) }, (_, index) => serialized.slice(index * 12_000, (index + 1) * 12_000));
  channel.send(JSON.stringify({ type: "zik-id-start", chunks: chunks.length }));
  channel.bufferedAmountLowThreshold = 48_000;
  for (let index = 0; index < chunks.length; index++) {
    if (channel.bufferedAmount > 96_000) await new Promise<void>((resolve) => channel.addEventListener("bufferedamountlow", () => resolve(), { once: true }));
    channel.send(JSON.stringify({ type: "zik-id-chunk", index, data: chunks[index] }));
  }
  channel.send(JSON.stringify({ type: "zik-id-end" }));
}
