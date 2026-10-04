import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Directory, File, Paths } from 'expo-file-system';
import { LocalVault, type VaultStorage } from './repository';

const KEY = 'zik.native.vault.key.v1';
const POINTER = 'zik.native.vault.index.v1';
const options = { requireAuthentication: true, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, authenticationPrompt: 'Unlock your Zik Vault' };
const directory = () => new Directory(Paths.document, 'zik-vault-v1');
const file = (name: string) => new File(directory(), name);
const hex = (bytes: Uint8Array) => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
const storage: VaultStorage = {
  async read(name) { return file(name).bytes(); },
  async write(name, value) { directory().create({ idempotent: true, intermediates: true }); file(name).write(value); },
  async remove(name) { const target = file(name); if (target.exists) target.delete(); },
  async pointer() {
    const value = await SecureStore.getItemAsync(POINTER);
    if (value !== null && value !== 'a' && value !== 'b') throw new Error('Vault index is unreadable. Your files have not been changed.');
    if (value === null && (file('index-a').exists || file('index-b').exists)) throw new Error('Vault index is unavailable. Your existing files have been kept.');
    return value;
  },
  async commit(slot) { await SecureStore.setItemAsync(POINTER, slot, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  random: Crypto.getRandomBytes
};
export async function unlockNativeVault(): Promise<LocalVault> {
  const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock your Zik Vault', biometricsSecurityLevel: 'strong' });
  if (!auth.success) throw new Error('Unlock cancelled. Your Vault is still locked.');
  let raw = await SecureStore.getItemAsync(KEY, options);
  if (!raw) {
    if (await storage.pointer() || (directory().exists && directory().list().length)) throw new Error('The key for this Vault is unavailable. Existing files have been kept; no replacement key was created.');
    raw = hex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(KEY, raw, options);
  }
  if (!/^[a-f0-9]{64}$/.test(raw)) throw new Error('The Vault key is unreadable.');
  const bytes = Uint8Array.from(raw.match(/../g)!, byte => parseInt(byte, 16));
  try { return new LocalVault(bytes, storage); } finally { bytes.fill(0); }
}
export function clearExportCopies() {
  const folder = new Directory(Paths.cache, 'zik-export');
  if (folder.exists) folder.delete();
}
