import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Action, Body, Heading, Panel, Screen, colours } from '../../src/components/ui';
import { WEB_ORIGIN } from '../../src/config';
import { webDestination } from '../../src/web-policy';
const presentation = `document.documentElement.setAttribute('data-zik-native', 'true'); true;`;
export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ path?: string }>();
  const browser = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [url, setUrl] = useState(WEB_ORIGIN ? `${WEB_ORIGIN}/home` : '');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!WEB_ORIGIN || !params.path) return;
    try {
      const target = new URL(params.path, WEB_ORIGIN);
      const destination = webDestination(target.href, WEB_ORIGIN);
      if (destination.kind === 'web') { setFailed(false); setUrl(destination.url); }
    } catch { /* Ignore malformed incoming paths. */ }
  }, [params.path]);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current) { browser.current?.goBack(); return true; }
      return false;
    });
    return () => listener.remove();
  }, []);
  if (!WEB_ORIGIN) return <Screen title="Explore"><Panel><Heading>Your local space is ready.</Heading><Body>This build has no Zik website configured. Vault and Zik ID work locally. Set EXPO_PUBLIC_ZIK_API_ORIGIN to your deployed HTTPS Zik site when building the app.</Body></Panel></Screen>;
  function navigate(value: string) {
    const destination = webDestination(value, WEB_ORIGIN!);
    if (destination.kind === 'web') return true;
    if (destination.kind === 'native') router.navigate(destination.path);
    else if (destination.kind === 'handoff') router.push({ pathname: '/handoff', params: { token: destination.token } });
    else if (destination.kind === 'external') Alert.alert('Open in your browser?', new URL(destination.url).hostname, [{ text: 'Cancel', style: 'cancel' }, { text: 'Open', onPress: () => { void Linking.openURL(destination.url).catch(() => Alert.alert('Could not open this link.')); } }]);
    return false;
  }
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colours.canvas }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, minHeight: 48 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back in website" onPress={() => browser.current?.goBack()} style={{ padding: 12 }}><Text style={{ color: colours.green }}>← Back</Text></Pressable>
      <Text style={{ fontWeight: '700', color: colours.ink }}>Explore Zik</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Website home" onPress={() => { setFailed(false); setUrl(`${WEB_ORIGIN}/home`); browser.current?.reload(); }} style={{ padding: 12 }}><Text style={{ color: colours.green }}>Home</Text></Pressable>
    </View>
    {failed ? <View style={{ padding: 22, gap: 20 }}><Panel><Heading>Couldn’t load this page.</Heading><Body>Try again when you’re online. Your local Vault is still available.</Body><Action onPress={() => { setFailed(false); setLoading(true); }}>Try again</Action><Action secondary onPress={() => router.navigate('/vault')}>Open Vault</Action></Panel></View> : <>
      {loading ? <ActivityIndicator accessibilityLabel="Loading Zik" style={{ padding: 8 }} color={colours.green} /> : null}
      <WebView ref={browser} source={{ uri: url }} style={{ flex: 1, backgroundColor: colours.canvas }}
        applicationNameForUserAgent="ZikNative/1" originWhitelist={['*']}
        onShouldStartLoadWithRequest={request => navigate(request.url)}
        onOpenWindow={event => { if (navigate(event.nativeEvent.targetUrl)) setUrl(event.nativeEvent.targetUrl); }}
        onNavigationStateChange={state => { canGoBack.current = state.canGoBack; }}
        onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
        onHttpError={event => { if (event.nativeEvent.statusCode >= 400 && event.nativeEvent.url === url) setFailed(true); }}
        onContentProcessDidTerminate={() => setFailed(true)} onRenderProcessGone={() => setFailed(true)}
        injectedJavaScript={presentation} injectedJavaScriptBeforeContentLoaded={presentation}
        allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never" thirdPartyCookiesEnabled={false} sharedCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows
      />
    </>}
  </SafeAreaView>;
}
