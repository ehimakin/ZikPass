import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VaultProvider } from '../src/vault/context';
export default function RootLayout() {
  return <SafeAreaProvider><VaultProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /><Stack.Screen name="handoff" options={{ presentation: 'modal' }} /></Stack></VaultProvider></SafeAreaProvider>;
}
