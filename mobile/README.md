# ZikPass native wallet scaffold

This Expo Router app is the future native companion to the Next.js web onboarding flow. The
browser wallet/PWA remains the current prototype delivery path; this project is not yet a
production native wallet.

## Start a development build

```bash
cd mobile
npm install
EXPO_PUBLIC_ZIK_API_ORIGIN=https://your-zikpass-host.example npx expo start
```

Use a development build for Face ID, biometric key protection, and stable deep-link testing. Expo Go is not sufficient for those native capabilities.

The web flow creates a one-time handoff token. Open the resulting `zik://handoff?token=...` link
with the development build to generate a native holder key and claim the pass. The server keeps
the same logical credential ID and applies the shared device-binding limit/payment policy.

Before production, configure iOS Universal Links and Android App Links for the deployed ZikPass
domain, add native lifecycle/recovery handling, and replace the prototype SecureStore-backed
signing key with a native non-exportable signing implementation. See the repository-level
[`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) and [`docs/TESTING.md`](../docs/TESTING.md)
for the shared handoff contract and manual recovery scenarios.
