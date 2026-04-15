import os from "node:os";
import path from "node:path";

const bundledDataDir = path.join(process.cwd(), "data");

function shouldUseTempRuntimeDir(): boolean {
  return Boolean(
    process.env.ZIK_RUNTIME_DATA_DIR ||
      process.env.VERCEL ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.AWS_REGION
  );
}

export function getBundledDataDir(): string {
  return bundledDataDir;
}

export function getRuntimeDataDir(): string {
  if (process.env.ZIK_RUNTIME_DATA_DIR?.trim()) {
    return process.env.ZIK_RUNTIME_DATA_DIR.trim();
  }

  if (shouldUseTempRuntimeDir()) {
    return path.join(os.tmpdir(), "zik-pass-data");
  }

  return bundledDataDir;
}

export function getRuntimeStatePath(): string {
  return path.join(getRuntimeDataDir(), "runtime-state.json");
}

export function getSeedStatePath(): string {
  return path.join(getBundledDataDir(), "state.json");
}

export function getIssuerKeyPath(): string {
  return path.join(getRuntimeDataDir(), "issuer-keypair.json");
}
