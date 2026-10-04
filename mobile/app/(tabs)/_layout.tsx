import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colours } from '../../src/components/ui';
export default function LocalTabs() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colours.green, tabBarInactiveTintColor: colours.muted, tabBarStyle: { backgroundColor: colours.canvas, borderTopColor: colours.line }, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' } }}>
    <Tabs.Screen name="vault" options={{ title: 'Vault', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>▣</Text> }} />
    <Tabs.Screen name="identity" options={{ title: 'Zik ID', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>◎</Text> }} />
    <Tabs.Screen name="wallet" options={{ title: 'Card', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>▤</Text> }} />
    <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 23 }}>↗</Text> }} />
  </Tabs>;
}
