import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { EntryGate } from '../../src/auth/gates';
import { useSession } from '../../src/auth/session';
import { colours } from '../../src/components/ui';
export default function LocalTabs() {
  const session = useSession();
  const sensitive = () => ({ tabPress: () => { session.revoke(); } });
  return <EntryGate><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colours.green, tabBarInactiveTintColor: colours.muted, tabBarStyle: { backgroundColor: colours.canvas, borderTopColor: colours.line }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
    <Tabs.Screen name="dashboard" options={{ href: null }} />
    <Tabs.Screen name="vault" listeners={sensitive()} options={{ title: 'Vault', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>▣</Text> }} />
    <Tabs.Screen name="identity" listeners={sensitive()} options={{ title: 'Zik ID', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>◎</Text> }} />
    <Tabs.Screen name="wallet" listeners={sensitive()} options={{ title: 'Card', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>▤</Text> }} />
    <Tabs.Screen name="explore" listeners={{ tabPress: () => session.revoke() }} options={{ title: 'Explore', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>↗</Text> }} />
  </Tabs></EntryGate>;
}
