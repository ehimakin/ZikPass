import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/auth/session';
import { VaultProvider } from '../src/vault/context';
export default function RootLayout() {
  return <SafeAreaProvider><VaultProvider><SessionProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /><Stack.Screen name="handoff" options={{ presentation: 'modal' }} /></Stack></SessionProvider></VaultProvider></SafeAreaProvider>;
}
