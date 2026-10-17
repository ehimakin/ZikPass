import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { UnlockAttempts } from './attempts';
import { useVault } from '../vault/context';
export type Resource = 'vault' | 'identity' | 'wallet';
const labels = { vault: 'Vault', identity: 'Zik ID', wallet: 'Card' };
type Session = { entered: boolean; resource: Resource | null; busy: boolean; error: string; unlock(target?: Resource): Promise<boolean>; revoke(): void; lock(): void };
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const vault = useVault();
  const [entered, setEntered] = useState(false);
  const [resource, setResource] = useState<Resource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempts = useRef(new UnlockAttempts());
  const vaultRef = useRef(vault); vaultRef.current = vault;
  const revoke = useCallback(() => { attempts.current.invalidate(); setResource(null); setError(''); vaultRef.current.lock(); }, []);
  const lock = useCallback(() => { revoke(); setEntered(false); }, [revoke]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'background') lock(); });
    return () => listener.remove();
  }, [lock]);
  async function unlock(target?: Resource) {
    const attempt = attempts.current.begin();
    if (attempt === null) return false;
    setBusy(true); setError('');
    try {
      if (target === 'vault' || target === 'identity') {
        if (!await vaultRef.current.unlock()) return false;
      } else {
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: target ? `Unlock ${labels[target]}` : 'Unlock Zik', biometricsSecurityLevel: 'strong' });
        if (!result.success) throw new Error('Unlock cancelled. Try again when you’re ready.');
      }
      if (!attempts.current.valid(attempt) || AppState.currentState === 'background') { vaultRef.current.lock(); return false; }
      if (target) setResource(target); else setEntered(true);
      return true;
    } catch (reason) {
      if (attempts.current.valid(attempt)) setError(reason instanceof Error ? reason.message : 'Could not unlock.');
      return false;
    } finally { attempts.current.finish(); setBusy(false); }
  }
  return <Context.Provider value={{ entered, resource, busy, error, unlock, revoke, lock }}>{children}</Context.Provider>;
}
export function useSession() { const value = useContext(Context); if (!value) throw new Error('SessionProvider required'); return value; }
