import { ResourceGate } from '../../src/auth/gates';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Action, Badge, Body, ErrorText, Heading, Panel, Screen } from '../../src/components/ui';
import { loadNativePass, type NativePass } from '../../src/native-wallet';
import { credentialStatus } from '../../src/credential-policy';
export default function CardScreen() { return <ResourceGate resource="wallet"><CardContent /></ResourceGate>; }
function CardContent() {
  const router = useRouter();
  const [pass, setPass] = useState<NativePass | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let live = true;
    void loadNativePass().then(value => { if (live) setPass(value); }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'Could not load your card.'); }).finally(() => { if (live) setBusy(false); });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { live = false; clearInterval(timer); };
  }, []);
  return <Screen title="Your card" subtitle="Your Zik pass, kept on this phone.">
    {busy ? <ActivityIndicator accessibilityLabel="Loading card" /> : error ? null : pass ? <Panel><Badge>{pass.physicalCard ? 'Physical card · Digital twin' : 'Digital Zik Pass'}</Badge><Heading>Over 18</Heading><Badge>{credentialStatus(pass.credential, now)}</Badge><Body>{pass.physicalCard ? 'Your physical card’s pass is bound to this phone.' : 'Your signed proof of age is saved on this phone.'}</Body><Body>Expires {new Date(pass.credential.payload.expires_at).toLocaleDateString()}</Body><Body>Signature checked locally. A saved pass does not confirm current revocation status. Native website proof approval is not connected yet.</Body></Panel> : <Panel><Heading>Bring your pass with you.</Heading><Body>After the in-store check, open the private “Open in Zik” link from your existing pass. Confirm it here to bind this phone.</Body><Action onPress={() => router.push('/handoff')}>Link a pass</Action><Action secondary onPress={() => router.push({ pathname: '/explore', params: { path: '/get-pass' } })}>Get Zik Pass</Action></Panel>}
    <ErrorText>{error}</ErrorText>
  </Screen>;
}
