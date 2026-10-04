import { useEffect, useState } from 'react';
import { Alert, AppState, Image, Modal, View } from 'react-native';
import { File, Directory, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Action, Badge, Body, ErrorText, Heading, Panel, Screen, VaultGate } from '../../src/components/ui';
import { useVault } from '../../src/vault/context';
import { clearExportCopies } from '../../src/vault/native-storage';
import type { LocalDocument } from '../../src/vault/repository';
export default function VaultScreen() {
  return <Screen title="Vault" subtitle="Your documents. Kept close."><VaultGate><Documents /></VaultGate></Screen>;
}
function Documents() {
  const { vault, index, refresh, lock } = useVault();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state !== 'active') setImage(null); }); return () => listener.remove(); }, []);
  if (!vault || !index) return null;
  async function add() {
    if (!vault || busy) return;
    setBusy(true); setError('');
    let source: File | null = null;
    let bytes: Uint8Array | null = null;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0]; source = new File(asset.uri);
      if (source.size > 10 * 1024 * 1024) throw new Error('Choose a file up to 10 MB.');
      bytes = await source.bytes();
      await vault.import(asset.name, asset.mimeType ?? 'application/octet-stream', bytes);
      await refresh(vault);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not import this file.'); }
    finally { bytes?.fill(0); if (source?.uri.startsWith(Paths.cache.uri) && source.exists) source.delete(); setBusy(false); }
  }
  async function open(document: LocalDocument, share: boolean) {
    if (!vault || busy) return;
    setBusy(true); setError('');
    let bytes: Uint8Array | null = null;
    try {
      const result = await vault.document(document.id); bytes = result.bytes;
      if (share) {
        if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
        clearExportCopies();
        const folder = new Directory(Paths.cache, 'zik-export'); folder.create({ intermediates: true });
        const copy = new File(folder, document.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document'); copy.write(bytes);
        try { await Sharing.shareAsync(copy.uri, { mimeType: document.mime, dialogTitle: 'Share a copy' }); }
        finally { clearExportCopies(); }
      } else {
        let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
        setImage(`data:${document.mime};base64,${btoa(binary)}`);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open this document.'); }
    finally { bytes?.fill(0); setBusy(false); }
  }
  function remove(document: LocalDocument) {
    Alert.alert('Remove this document?', 'Your original file is unchanged.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { if (!vault) return; setBusy(true); void vault.remove(document.id).then(() => refresh(vault)).catch(() => setError('Could not remove the document.')).finally(() => setBusy(false)); } }]);
  }
  return <>
    <Action busy={busy} onPress={() => void add()}>Add a document</Action>
    <ErrorText>{error}</ErrorText>
    {!index.documents.length ? <Panel><Heading>A place for the important things.</Heading><Body>Add a photo or PDF. Files are encrypted on this device and are not uploaded.</Body></Panel> : index.documents.map(document => <Panel key={document.id}><Badge>Stored locally · Not verified</Badge><Heading>{document.name}</Heading><Body>{Math.max(1, Math.round(document.size / 1024))} KB · {new Date(document.addedAt).toLocaleDateString()}</Body>{document.mime.startsWith('image/') ? <Action secondary disabled={busy} onPress={() => void open(document, false)}>View image</Action> : null}<Action secondary disabled={busy} onPress={() => Alert.alert('Share a copy?', 'The app you choose will receive a decrypted copy of this document.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => void open(document, true) }])}>Share a copy</Action><Action secondary disabled={busy} onPress={() => remove(document)}>Remove</Action></Panel>)}
    <Body>PDFs can be opened through “Share a copy”. On-device text extraction is not connected in the native app yet.</Body>
    <Action secondary onPress={lock}>Lock Vault</Action>
    <Modal visible={Boolean(image)} onRequestClose={() => setImage(null)} animationType="fade"><View style={{ flex: 1, backgroundColor: '#17251e', padding: 24, paddingTop: 70 }}>{image ? <Image source={{ uri: image }} resizeMode="contain" style={{ flex: 1 }} accessibilityLabel="Your saved document" alt="Your saved document" /> : null}<Action onPress={() => setImage(null)}>Close</Action></View></Modal>
  </>;
}
