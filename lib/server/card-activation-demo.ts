import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getRuntimeDataDir } from './runtime-paths';
import { cardDemoEnabled, parseCardSerial, type CardSessionView } from '@/lib/shared/card-activation';

type Session = CardSessionView & { storeId: string; operator: string; token: string; pairingCode: string; mockPublicKey?: string; flowVersion?: 2; purchaseCheck?: "demo_preverified_and_paid" };
export type CardDemoData = { sessions: Session[] };
/** Replace with a transactional database and genuine card registry before production. */
export interface CardDemoAdapter { transact<T>(fn: (data: CardDemoData) => T): Promise<T> }
const queues = globalThis as typeof globalThis & { cardDemoQueue?: Promise<unknown> };
export const fileCardDemoAdapter: CardDemoAdapter = {
  transact<T>(fn: (data: CardDemoData) => T): Promise<T> {
    const run = (queues.cardDemoQueue ?? Promise.resolve()).then(async () => {
      const filename = path.join(getRuntimeDataDir(), 'card-activation-demo.json');
      await fs.mkdir(path.dirname(filename), { recursive: true });
      let data: CardDemoData;
      try { data = JSON.parse(await fs.readFile(filename, 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; data = { sessions: [] }; }
      const result = fn(data);
      const temp = `${filename}.${randomUUID()}.tmp`;
      await fs.writeFile(temp, JSON.stringify(data), { mode: 0o600 });
      await fs.rename(temp, filename);
      return result;
    });
    queues.cardDemoQueue = run.catch(() => undefined);
    return run;
  },
};
export type CardDemoInput = {
  action: string; serial?: unknown; id?: string; token?: string; mockPublicKey?: string;
};
export type CardDemoActor = { storeId: string; operator: string };
const terminal = (s: Session) => ['completed', 'cancelled', 'expired'].includes(s.stage);
const view = (s: Session, clerk: boolean): CardSessionView => ({ id: s.id, serial: s.serial, expiresAt: s.expiresAt, stage: s.stage, simulated: s.simulated, ...(clerk && s.stage !== 'additional_services' ? { token: s.token, pairingCode: s.pairingCode } : {}) });

export async function cardDemoAction(input: CardDemoInput, actor?: CardDemoActor, adapter = fileCardDemoAdapter, now = Date.now()): Promise<CardSessionView> {
  if (!cardDemoEnabled()) throw new Error('Demo card activation is unavailable.');
  if (typeof input.token === 'string' && /^[a-f0-9]{12}$/i.test(input.token)) input = { ...input, token: input.token.toUpperCase() };
  const publicAction = ['pair', 'customer_status', 'customer_bind'].includes(input.action);
  if (!publicAction && !actor) throw new Error('Clerk login required.');
  return adapter.transact(data => {
    for (const s of data.sessions) {
      if (!terminal(s) && s.flowVersion !== 2) s.stage = 'cancelled';
      if (!terminal(s) && s.expiresAt <= now) s.stage = 'expired';
    }
    if (input.action === 'start') {
      const serial = parseCardSerial(input.serial);
      const number = Number(serial.slice(-6));
      if (number === 999998 || data.sessions.some(s => s.serial === serial && s.stage === 'completed')) throw new Error('This card is already activated. Its binding cannot be transferred.');
      if (number === 999999) throw new Error('This card is unavailable. Ask a supervisor for another card.');
      if (number < 1 || number > 100) throw new Error('Unknown card. This demo recognises serials 000001–000100.');
      const existing = data.sessions.find(s => s.serial === serial && !terminal(s));
      if (existing) {
        if (existing.storeId !== actor!.storeId || existing.operator !== actor!.operator) throw new Error('Card unavailable: another clerk session is using it.');
        return view(existing, true);
      }
      const s: Session = { id: randomUUID(), serial, storeId: actor!.storeId, operator: actor!.operator, expiresAt: now + 5 * 60_000, stage: 'additional_services', flowVersion: 2, purchaseCheck: 'demo_preverified_and_paid', simulated: false, token: randomBytes(32).toString('base64url'), pairingCode: '' };
      do { s.pairingCode = randomBytes(6).toString('hex').toUpperCase(); } while (data.sessions.some(other => other.pairingCode === s.pairingCode));
      data.sessions.push(s);
      return view(s, true);
    }
    const s = publicAction
      ? data.sessions.find(s => input.token && (s.token === input.token || s.pairingCode === input.token))
      : data.sessions.find(s => s.id === input.id && s.storeId === actor!.storeId && s.operator === actor!.operator);
    if (!s) throw new Error('Session unavailable. Check the pairing code or sign in as the original clerk.');
    if (publicAction) {
      if (!/^demo-public-key:[a-f0-9-]{36}$/.test(input.mockPublicKey ?? '')) throw new Error('A demo device association is required.');
      if (s.mockPublicKey && s.mockPublicKey !== input.mockPublicKey) throw new Error('This session is connected to another device. Reconnection cannot transfer it.');
    }
    if (input.action === 'status' || input.action === 'customer_status') return view(s, !publicAction);
    if (terminal(s)) {
      if (input.action === 'pair' && s.stage === 'completed' && s.mockPublicKey === input.mockPublicKey) return view(s, false);
      if (input.action === 'customer_bind' && s.stage === 'completed' && s.mockPublicKey === input.mockPublicKey) return view(s, false);
      if (input.action === 'simulate_bind' && s.stage === 'completed' && s.simulated) return view(s, true);
      if (input.action === 'cancel' && s.stage === 'cancelled') return view(s, true);
      throw new Error(`Session ${s.stage}. No changes were made.`);
    }
    if (input.action === 'cancel') s.stage = 'cancelled';
    else if (input.action === 'show_qr') {
      if (s.stage === 'additional_services') s.stage = 'awaiting_customer';
    } else if (input.action === 'pair') {
      if (!['awaiting_customer', 'device_connected'].includes(s.stage)) throw new Error('The clerk must display the pairing QR first.');
      if (!s.mockPublicKey) { s.mockPublicKey = input.mockPublicKey; s.stage = 'device_connected'; }
    } else if (input.action === 'customer_bind') {
      if (!s.mockPublicKey || s.stage !== 'device_connected' || s.purchaseCheck !== 'demo_preverified_and_paid') throw new Error('Pair this device with an eligible purchased card first.');
      s.stage = 'completed';
    } else if (input.action === 'simulate_pair') {
      if (s.stage !== 'awaiting_customer' || s.mockPublicKey) throw new Error('Display the QR first; an existing connection cannot be replaced.');
      s.mockPublicKey = `demo-public-key:${randomUUID()}`; s.simulated = true; s.stage = 'device_connected';
    } else if (input.action === 'simulate_bind') {
      if (!s.simulated || !s.mockPublicKey || s.stage !== 'device_connected' || s.purchaseCheck !== 'demo_preverified_and_paid') throw new Error('A simulated paired device is required.');
      s.stage = 'completed';
    } else throw new Error('Unknown action.');
    return view(s, !publicAction);
  });
}
