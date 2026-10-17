import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Action, Body, ErrorText, Heading, Panel, Screen, colours } from '../components/ui';
import { useSession, type Resource } from './session';
import { useVault } from '../vault/context';
const labels = { vault: 'Vault', identity: 'Zik ID', wallet: 'Card' };
export function EntryGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [splash, setSplash] = useState(!session.entered);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
        if (!live) return;
        Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 280, useNativeDriver: true }).start(() => { if (live) setSplash(false); });
      });
    }, 700);
    return () => { live = false; clearTimeout(timer); opacity.stopAnimation(); };
  }, [opacity]);
  if (splash) return <Animated.View style={[styles.splash, { opacity }]}><Text accessibilityRole="header" style={styles.logo}>Zik</Text><Text style={styles.tagline}>Your private space.</Text></Animated.View>;
  if (!session.entered) return <View style={styles.entry}><Text style={styles.logo}>Zik</Text><Heading>Welcome back.</Heading><Body>Your world. Under your control.</Body><Action busy={session.busy} onPress={() => { void session.unlock().then(ok => { if (ok && pathname !== '/handoff') router.replace('/dashboard'); }); }}>Unlock Zik</Action><ErrorText>{session.error}</ErrorText></View>;
  return children;
}
export function ResourceGate({ resource, children }: { resource: Resource; children: ReactNode }) {
  const session = useSession();
  const vault = useVault();
  const router = useRouter();
  const focused = usePathname() === `/${resource}`;
  const attempted = useRef(false);
  const sessionRef = useRef(session); sessionRef.current = session;
  useEffect(() => {
    if (focused) return () => sessionRef.current.revoke();
  }, [focused]);
  const allowed = session.resource === resource && (resource === 'wallet' || Boolean(vault.vault));
  useEffect(() => {
    if (!focused || allowed) { attempted.current = false; return; }
    if (!attempted.current && !session.busy) { attempted.current = true; void session.unlock(resource); }
  }, [focused, allowed, resource, session]);
  if (!focused || !allowed) return <Screen title={labels[resource]}><Panel><Heading>Just for you.</Heading><Body>Confirm it’s you to open {labels[resource]}.</Body><Action busy={session.busy} onPress={() => void session.unlock(resource)}>{`Unlock ${labels[resource]}`}</Action><ErrorText>{session.error || vault.error}</ErrorText><Action secondary disabled={session.busy} onPress={() => { session.revoke(); router.replace('/dashboard'); }}>Back to home</Action></Panel></Screen>;
  return children;
}
const styles = StyleSheet.create({ splash: { flex: 1, backgroundColor: colours.canvas, alignItems: 'center', justifyContent: 'center', gap: 14 }, logo: { fontSize: 64, fontWeight: '800', color: colours.green, letterSpacing: -3 }, tagline: { color: colours.muted, fontSize: 17 }, entry: { flex: 1, justifyContent: 'center', backgroundColor: colours.canvas, padding: 28, gap: 24 } });
