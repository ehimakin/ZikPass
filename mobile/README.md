# ZikPass native wallet prototype

This Expo Router app is the native companion to the Next.js web onboarding flow.

## Start a development build

```bash
cd mobile
npm install
EXPO_PUBLIC_ZIK_API_ORIGIN=https://your-zikpass-host.example npx expo start
```

Use a development build for Face ID, biometric key protection, and stable deep-link testing. Expo Go is not sufficient for those native capabilities.

The web flow creates a one-time handoff token. Open the resulting `zik://handoff?token=...` link with the development build to generate a native holder key and claim the pass.

Before production, configure iOS Universal Links and Android App Links for the deployed ZikPass domain, then replace the prototype SecureStore-backed signing key with a native non-exportable signing implementation.
