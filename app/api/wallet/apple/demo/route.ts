import { appleWalletDemoConfigured, createAppleWalletDemoPass } from "@/lib/server/apple-wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  if (!appleWalletDemoConfigured()) {
    return Response.json({ error: "Apple Wallet demo signing is not configured yet." }, { status: 503, headers });
  }
  try {
    const pass = await createAppleWalletDemoPass();
    return new Response(new Uint8Array(pass), {
      headers: { ...headers, "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": 'attachment; filename="zik-demo.pkpass"' }
    });
  } catch {
    // Never expose signing material or library errors to the client or logs.
    return Response.json({ error: "The demo pass could not be signed. Check the server signing configuration." }, { status: 503, headers });
  }
}
