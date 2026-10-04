import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, View, Text, StyleSheet } from 'react-native';
import { clearExportCopies, unlockNativeVault } from './native-storage';
import type { LocalVault, VaultIndex } from './repository';

type Session = { vault: LocalVault | null; index: VaultIndex | null; busy: boolean; error: string; unlock(): Promise<void>; lock(): void; refresh(vault: LocalVault): Promise<void> };
const Context = createContext<Session | null>(null);
export function VaultProvider({ children }: { children: ReactNode }) {
  const current = useRef<LocalVault | null>(null);
  const unlocking = useRef(false);
  const generation = useRef(0);
  const [index, setIndex] = useState<VaultIndex | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [covered, setCovered] = useState(AppState.currentState !== 'active');
  function lock() { generation.current++; current.current?.lock(); current.current = null; setIndex(null); }
  useEffect(() => {
    try { clearExportCopies(); } catch { /* Retry export cleanup before the next export. */ }
    const listener = AppState.addEventListener('change', state => {
      setCovered(state !== 'active');
      if (state === 'background') lock();
    });
    return () => { listener.remove(); current.current?.lock(); };
  }, []);
  async function unlock() {
    if (unlocking.current) return;
    unlocking.current = true; setBusy(true); setError('');
    const attempt = generation.current;
    let vault: LocalVault | null = null;
    try {
      vault = await unlockNativeVault();
      const value = await vault.read();
      if (generation.current !== attempt || AppState.currentState === 'background') { vault.lock(); return; }
      current.current = vault; setIndex(value);
    } catch (reason) { vault?.lock(); setError(reason instanceof Error ? reason.message : 'Unable to unlock your Vault.'); }
    finally { unlocking.current = false; setBusy(false); }
  }
  async function refresh(vault: LocalVault) {
    const value = await vault.read();
    if (current.current === vault) setIndex(value);
  }
  return <Context.Provider value={{ vault: current.current, index, busy, error, unlock, lock, refresh }}>
    {children}
    {covered ? <View style={styles.cover} accessibilityViewIsModal><Text style={styles.brand}>Zik</Text><Text>Your private space</Text></View> : null}
  </Context.Provider>;
}
export function useVault() { const value = useContext(Context); if (!value) throw new Error('VaultProvider is required.'); return value; }
const styles = StyleSheet.create({ cover: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 9999, backgroundColor: '#f7f7ef', alignItems: 'center', justifyContent: 'center' }, brand: { fontSize: 54, fontWeight: '800', color: '#28623c', marginBottom: 16 } });
