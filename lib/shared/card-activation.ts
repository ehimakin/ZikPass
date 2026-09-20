export function cardDemoEnabled() {
  return (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')
    && (process.env.ZIK_ENV ?? process.env.NEXT_PUBLIC_ZIK_ENV)?.trim().toLowerCase() !== 'live';
}

/** Public serial, or the literal payload in a QR/Code128 barcode. URLs are never accepted. */
export function parseCardSerial(input: unknown): string {
  if (typeof input !== 'string' || input.length > 80) throw new Error('Invalid card format. Use ZKC-DEMO-000001 or ZIKCARD:1:ZKC-DEMO-000001.');
  const serial = input.trim().toUpperCase().replace(/^ZIKCARD:1:/, '');
  if (!/^ZKC-DEMO-\d{6}$/.test(serial)) throw new Error('Invalid card format. Use ZKC-DEMO-000001 or ZIKCARD:1:ZKC-DEMO-000001.');
  return serial;
}
export type CardStage = 'additional_services' | 'awaiting_customer' | 'device_connected' | 'completed' | 'expired' | 'cancelled';
export type CardSessionView = {
  id: string; serial: string; expiresAt: number; stage: CardStage; simulated: boolean;
  token?: string; pairingCode?: string;
};
export const CARD_STAGE_LABELS: Record<CardStage, string> = {
  additional_services: 'Additional document services',
  awaiting_customer: 'Awaiting customer', device_connected: 'Device connected — confirm binding',
  completed: 'Completed', expired: 'Expired', cancelled: 'Cancelled',
};
