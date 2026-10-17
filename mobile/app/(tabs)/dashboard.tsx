import { useRouter } from 'expo-router';
import { View, Text } from 'react-native';
import { Action, Badge, Body, Heading, Panel, Screen, colours } from '../../src/components/ui';
import { useSession, type Resource } from '../../src/auth/session';
export default function Dashboard() {
  const router = useRouter();
  const session = useSession();
  function open(resource: Resource) { session.revoke(); router.navigate(`/${resource}`); }
  return <Screen title="Your Zik." subtitle="Everything you keep close.">
    <Panel><View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colours.lime, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, color: colours.green }}>◎</Text></View><View><Heading>Your private space</Heading><Badge>On this device</Badge></View></View><Body>Your documents, identity and card. Open each with your device authentication.</Body></Panel>
    <Panel><Heading>Keep it together.</Heading><Action secondary onPress={() => open('vault')}>Open Vault</Action><Action secondary onPress={() => open('identity')}>Open Zik ID</Action><Action secondary onPress={() => open('wallet')}>Open Card</Action></Panel>
    <Action onPress={() => { session.revoke(); router.navigate('/explore'); }}>Explore Zik</Action>
    <Action secondary onPress={session.lock}>Lock Zik</Action>
  </Screen>;
}
