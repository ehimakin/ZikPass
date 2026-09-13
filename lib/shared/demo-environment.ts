/**
 * Explicit demo/test environment flag, independent of NODE_ENV.
 *
 * A deployed demo commonly runs a production build (`next start`), so
 * `NODE_ENV === "production"` must NOT be what gates demo tooling, the
 * payment simulator, or fixture reset. Those are gated on this flag instead.
 *
 * Resolution order:
 *   1. ZIK_ENV env var: "demo" | "test" | "live"
 *   2. NEXT_PUBLIC_ZIK_ENV (for client bundles)
 *   3. Default: "demo" (this repository is a prototype)
 *
 * "live" is never selected implicitly and this milestone ships no live path.
 */

export type ZikEnvironment = "demo" | "test" | "live";

function readRaw(): string | undefined {
  return (
    process.env.ZIK_ENV ??
    process.env.NEXT_PUBLIC_ZIK_ENV ??
    undefined
  );
}

export function getZikEnvironment(): ZikEnvironment {
  const raw = readRaw()?.toLowerCase().trim();
  if (raw === "live" || raw === "test" || raw === "demo") return raw;
  return "demo";
}

export const zikEnvironment = getZikEnvironment();

/** Demo tooling, fixture reset and the payment simulator are available here. */
export const isDemoEnvironment = zikEnvironment !== "live";

/** True only when a real payment provider path is intended to be active. */
export const isLiveEnvironment = zikEnvironment === "live";

/** Short label for the environment badge shown in the UI. */
export function environmentBadgeLabel(): string {
  switch (zikEnvironment) {
    case "test":
      return "Test environment";
    case "live":
      return "Live";
    default:
      return "Demo";
  }
}
