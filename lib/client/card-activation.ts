import type { CardSessionView } from "@/lib/shared/card-activation";
export async function cardRequest(body: object): Promise<CardSessionView> {
  const response = await fetch('/api/demo/card-activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Service unavailable. Try again.');
  return value;
}
