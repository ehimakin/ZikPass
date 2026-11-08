import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getStoreById } from '@/lib/shared/stores';
import { audit, SupportError, supportTransaction } from './support/store';
const scrypt = promisify(scryptCallback);
export async function setStoreAccessCode(storeId: string, code: string, actor: string) {
  if (!getStoreById(storeId)) throw new SupportError('Choose a valid store.');
  if (!/^\d{6}$/.test(code)) throw new SupportError('Use a six-digit staff code.');
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(code, salt, 64) as Buffer).toString('hex');
  return supportTransaction(data => {
    data.storeAccess ??= {};
    data.storeAccess[storeId] = { salt, hash, version: randomBytes(16).toString('hex') };
    audit(data, actor, 'store.access_code_set', storeId);
  });
}
export async function readStoreAccess(storeId: string) {
  return supportTransaction(data => data.storeAccess?.[storeId]);
}
export async function checkStoreAccessCode(storeId: string, code: string): Promise<boolean | null> {
  const access = await readStoreAccess(storeId);
  if (!access) return null;
  if (!/^\d{6}$/.test(code)) return false;
  const actual = await scrypt(code, access.salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(access.hash, 'hex'));
}
