import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { Action, Badge, Body, ErrorText, Heading, Panel, Screen } from '../../src/components/ui';
import { authenticateWallet, loadNativePass, type NativePass } from '../../src/native-wallet';
import { credentialStatus } from '../../src/credential-policy';
export default function CardScreen() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [pass, setPass] = useState<NativePass | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'background') { setPass(null); setUnlocked(false); } });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { listener.remove(); clearInterval(timer); };
  }, []);
  async function unlock() {
    if (busy) return;
    setBusy(true); setError('');
    try { await authenticateWallet(); const value = await loadNativePass(); if (AppState.currentState === 'background') return; setPass(value); setUnlocked(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open your pass.'); }
    finally { setBusy(false); }
  }
  return <Screen title="Your card" subtitle="Your Zik pass, kept on this phone.">
    {!unlocked ? <Panel><Heading>Ready when you are.</Heading><Body>Unlock to view your saved pass or link a new one.</Body><Action busy={busy} onPress={() => void unlock()}>Unlock card</Action></Panel> : pass ? <Panel><Badge>{pass.physicalCard ? 'Physical card · Digital twin' : 'Digital Zik Pass'}</Badge><Heading>Over 18</Heading><Badge>{credentialStatus(pass.credential, now)}</Badge><Body>{pass.physicalCard ? 'Your physical card’s pass is bound to this phone.' : 'Your signed proof of age is saved on this phone.'}</Body><Body>Expires {new Date(pass.credential.payload.expires_at).toLocaleDateString()}</Body><Body>Signature checked locally. A saved pass does not confirm current revocation status. Native website proof approval is not connected yet.</Body><Action secondary onPress={() => { setUnlocked(false); setPass(null); }}>Lock card</Action></Panel> : <Panel><Heading>Bring your pass with you.</Heading><Body>After the in-store check, open the private “Open in Zik” link from your existing pass. Confirm it here to bind this phone.</Body><Action onPress={() => router.push('/handoff')}>Link a pass</Action><Action secondary onPress={() => router.push({ pathname: '/explore', params: { path: '/get-pass' } })}>Get Zik Pass</Action></Panel>}
    <ErrorText>{error}</ErrorText>
  </Screen>;
}
