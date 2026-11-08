import { NextResponse } from "next/server";
import { answerZikIdSignalSession, consumeZikIdSignalSession, readZikIdSignalSession } from "@/lib/server/zik-id-sessions";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  const session = readZikIdSignalSession(id, code);
  if (!session) return NextResponse.json({ error: "This Zik ID request is invalid or has expired." }, { status: 404 });
  return NextResponse.json({ offer: session.offer, answer: session.answer, challenge: session.challenge, expiresAt: session.expiresAt }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as { code?: string; answer?: unknown };
    const session = answerZikIdSignalSession(id, body.code ?? "", body.answer);
    return NextResponse.json({ accepted: true, expiresAt: session.expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to answer Zik ID request." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const code = new URL(request.url).searchParams.get("code") ?? "";
  if (!consumeZikIdSignalSession(id, code)) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  return NextResponse.json({ consumed: true }, { headers: { "Cache-Control": "no-store" } });
}
