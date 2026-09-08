import { readdir } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Only display-ready transparent logos belong in this pool. */
export async function GET() {
  const entries = await readdir(path.join(process.cwd(), "public/affiliates/logos/desktop"), { withFileTypes: true });
  const logos = entries
    .filter((entry) => entry.isFile() && /\.(svg|png|webp|avif)$/i.test(entry.name))
    .map((entry) => `/affiliates/logos/desktop/${encodeURIComponent(entry.name)}`)
    .sort();
  return Response.json(logos, { headers: { "Cache-Control": "no-store" } });
}
