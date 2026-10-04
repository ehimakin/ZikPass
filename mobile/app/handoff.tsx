import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Action, Body, ErrorText, Field, Heading, Panel, Screen } from '../src/components/ui';
import { claimHandoff } from '../src/native-wallet';
import { WEB_ORIGIN } from '../src/config';
import { webDestination } from '../src/web-policy';
export default function HandoffScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  async function claim() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const destination = webDestination(link.trim(), WEB_ORIGIN ?? 'https://unconfigured.invalid');
      const supplied = token ?? (destination.kind === 'handoff' ? destination.token : null);
      if (!supplied) throw new Error('Paste the private Open in Zik link supplied after your pass is issued. A card serial alone cannot link a pass.');
      await claimHandoff(supplied); setDone(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not link your pass.'); }
    finally { setBusy(false); }
  }
  return <Screen title={done ? 'Pass linked.' : 'Link this phone'} subtitle="Your pass stays yours."><Panel><Heading>{done ? 'Your pass is saved locally.' : 'Confirm your digital twin.'}</Heading><Body>{done ? 'Open Card to view your saved pass.' : 'Use the private activation link from your issued Zik pass. Linking uses the existing device allowance and requires an internet connection.'}</Body>{!token && !done ? <Field label="Private activation link" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} textContentType="none" /> : null}{done ? <Action onPress={() => router.replace('/wallet')}>Open Card</Action> : <Action busy={busy} onPress={() => void claim()}>Confirm and link</Action>}<ErrorText>{error}</ErrorText><Action secondary disabled={busy} onPress={() => router.replace('/wallet')}>{done ? 'Done' : 'Cancel'}</Action></Panel></Screen>;
}
