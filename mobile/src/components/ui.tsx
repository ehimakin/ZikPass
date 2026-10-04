import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type TextInputProps, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { useVault } from '../vault/context';
export const colours = { canvas: '#f7f7ef', ink: '#17251e', green: '#28623c', muted: '#626c61', line: '#dce0d3', lime: '#d6ef66' };
export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <SafeAreaView edges={['top']} style={styles.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={styles.brand}>Zik</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.body}>{subtitle}</Text> : null}{children}</ScrollView></SafeAreaView>;
}
export function Panel({ children }: { children: ReactNode }) { return <View style={styles.panel}>{children}</View>; }
export function Body({ children }: { children: ReactNode }) { return <Text style={styles.body}>{children}</Text>; }
export function Heading({ children }: { children: ReactNode }) { return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>; }
export function Badge({ children }: { children: ReactNode }) { return <Text style={styles.badge}>{children}</Text>; }
export function Action({ children, onPress, secondary, busy, disabled }: { children: string; onPress(): void; secondary?: boolean; busy?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, { opacity: disabled || busy ? .5 : pressed ? .75 : 1 }]}>{busy ? <ActivityIndicator color={secondary ? colours.ink : '#fff'} /> : <Text style={[styles.buttonText, secondary && { color: colours.ink }]}>{children}</Text>}</Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View style={{ gap: 8 }}><Text style={{ color: colours.ink, fontWeight: '600' }}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colours.muted} style={styles.field} {...props} /></View>; }
export function ErrorText({ children }: { children: string }) { return children ? <Text accessibilityRole="alert" style={{ color: '#9f241c', lineHeight: 22 }}>{children}</Text> : null; }
export function VaultGate({ children }: { children: ReactNode }) {
  const session = useVault();
  if (session.vault && session.index) return children;
  return <Panel><Badge>Only on this device</Badge><Heading>Your private space, locked.</Heading><Body>Use your device authentication to open Vault and Zik ID.</Body><Action busy={session.busy} onPress={() => void session.unlock()}>Unlock</Action><ErrorText>{session.error}</ErrorText><Body>Keep your original documents. Native Vault backup and recovery are not connected yet.</Body></Panel>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.canvas }, content: { padding: 22, paddingBottom: 40, gap: 20 }, brand: { color: colours.green, fontSize: 22, fontWeight: '800' }, title: { fontSize: 38, letterSpacing: -1.2, fontWeight: '800', color: colours.ink }, heading: { fontSize: 23, fontWeight: '700', color: colours.ink }, body: { fontSize: 15, color: colours.muted, lineHeight: 23 }, panel: { borderRadius: 24, borderWidth: 1, borderColor: colours.line, backgroundColor: '#fff', padding: 22, gap: 16 }, badge: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#eef3db', color: colours.green, fontSize: 12, fontWeight: '700' }, button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.ink, padding: 14, borderRadius: 28 }, secondary: { backgroundColor: colours.canvas, borderWidth: 1, borderColor: colours.line }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }, field: { color: colours.ink, borderColor: colours.line, borderWidth: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 16, minHeight: 50 }
});
