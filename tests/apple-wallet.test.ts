import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appleWalletDemoConfigured, createAppleWalletDemoPass } from "@/lib/server/apple-wallet";
import { GET } from "@/app/api/wallet/apple/demo/route";

afterEach(() => vi.unstubAllEnvs());

describe("Apple Wallet generic demo", () => {
  it("fails closed without explicit enablement and in live mode", async () => {
    vi.stubEnv("ZIK_ENV", "demo");
    vi.stubEnv("ZIK_APPLE_WALLET_DEMO_ENABLED", "false");
    expect(appleWalletDemoConfigured()).toBe(false);
    expect((await GET()).status).toBe(503);
    vi.stubEnv("ZIK_APPLE_WALLET_DEMO_ENABLED", "true");
    vi.stubEnv("ZIK_APPLE_SIGNER_KEY_BASE64", "");
    expect(appleWalletDemoConfigured()).toBe(false);
    vi.stubEnv("ZIK_ENV", "live");
    expect(appleWalletDemoConfigured()).toBe(false);
  });

  it("packages icons, valid manifest hashes and a verifiable detached signature without user data", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zik-pass-signing-test-"));
    try {
      // Ephemeral synthetic test certificate only: not Apple-issued or installable.
      execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "key.pem", "-out", "cert.pem", "-days", "1", "-subj", "/CN=Zik Synthetic Test"], { cwd: dir, stdio: "ignore" });
      vi.stubEnv("ZIK_ENV", "test");
      vi.stubEnv("ZIK_APPLE_WALLET_DEMO_ENABLED", "true");
      vi.stubEnv("ZIK_APPLE_PASS_TYPE_ID", "pass.test.zik.demo");
      vi.stubEnv("ZIK_APPLE_TEAM_ID", "TESTTEAM01");
      vi.stubEnv("ZIK_APPLE_SIGNER_CERT_BASE64", readFileSync(path.join(dir, "cert.pem")).toString("base64"));
      vi.stubEnv("ZIK_APPLE_WWDR_CERT_BASE64", readFileSync(path.join(dir, "cert.pem")).toString("base64"));
      vi.stubEnv("ZIK_APPLE_SIGNER_KEY_BASE64", readFileSync(path.join(dir, "key.pem")).toString("base64"));
      vi.stubEnv("ZIK_APPLE_SIGNER_KEY_PASSPHRASE", "");
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/vnd.apple.pkpass");
      expect(response.headers.get("cache-control")).toBe("no-store");
      writeFileSync(path.join(dir, "demo.pkpass"), Buffer.from(await response.arrayBuffer()));
      execFileSync("unzip", ["-q", "demo.pkpass", "-d", "unpacked"], { cwd: dir });
      const unpacked = path.join(dir, "unpacked");
      const manifest = JSON.parse(readFileSync(path.join(unpacked, "manifest.json"), "utf8"));
      expect(Object.keys(manifest).sort()).toEqual(["icon.png", "icon@2x.png", "icon@3x.png", "pass.json"].sort());
      for (const [file, hash] of Object.entries(manifest)) {
        expect(createHash("sha1").update(readFileSync(path.join(unpacked, file))).digest("hex")).toBe(hash);
      }
      execFileSync("openssl", ["smime", "-verify", "-inform", "DER", "-in", "signature", "-content", "manifest.json", "-noverify"], { cwd: unpacked, stdio: "ignore" });
      const pass = JSON.parse(readFileSync(path.join(unpacked, "pass.json"), "utf8"));
      expect(pass.serialNumber).toBe("zik-generic-demo-v1");
      expect(pass.generic.headerFields[0].value).toBe("DEMO ONLY");
      for (const field of ["barcode", "barcodes", "nfc", "locations", "webServiceURL", "authenticationToken"]) expect(pass[field]).toBeUndefined();
      vi.stubEnv("ZIK_APPLE_SIGNER_KEY_BASE64", Buffer.from("INVALID TEST KEY").toString("base64"));
      const failure = await GET();
      expect(failure.status).toBe(503);
      expect(await failure.text()).not.toContain("INVALID TEST KEY");
      await expect(createAppleWalletDemoPass()).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
