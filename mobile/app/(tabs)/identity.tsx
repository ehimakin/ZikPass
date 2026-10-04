import { useState } from 'react';
import { Action, Badge, Body, ErrorText, Field, Heading, Panel, Screen, VaultGate } from '../../src/components/ui';
import { useVault } from '../../src/vault/context';
export default function IdentityScreen() { return <Screen title="Zik ID" subtitle="Your details. Your say."><VaultGate><Identity /></VaultGate></Screen>; }
function Identity() {
  const { vault, index, refresh } = useVault();
  const [name, setName] = useState(index?.identity.name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(index?.identity.dateOfBirth ?? '');
  const [address, setAddress] = useState(index?.identity.address ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save() {
    if (!vault || busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await vault.updateIdentity({ name, dateOfBirth, address }); await refresh(vault); setMessage('Saved privately on this device.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your details.'); }
    finally { setBusy(false); }
  }
  return <Panel><Badge>Local profile · Not verified</Badge><Heading>Keep your details together.</Heading><Field label="Full name" value={name} onChangeText={setName} maxLength={160} autoComplete="name" /><Field label="Date of birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={setDateOfBirth} maxLength={10} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /><Field label="Address" value={address} onChangeText={setAddress} maxLength={1000} multiline /><Action busy={busy} onPress={() => void save()}>Save on this device</Action><ErrorText>{error}</ErrorText>{message ? <Body>{message}</Body> : null}<Body>These details are entered by you, not an issued Zik ID. Identity checks and verified sharing are coming soon. Nothing here is sent to a website.</Body></Panel>;
}
