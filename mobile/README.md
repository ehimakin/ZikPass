# Zik mobile

Zik's native home for local documents, identity details and a device-bound pass. The existing website supplies the remaining services through `react-native-webview` (WKWebView on iOS). This extends the existing Expo app and shared pass protocol.

## What lives where

| Surface | Implementation |
| --- | --- |
| Vault | Native document import, encrypted storage, image preview, explicit sharing and deletion |
| Zik ID | Encrypted local profile; clearly self-entered, not an issued or verified identity |
| Card | Native signed pass storage, authenticated display and existing server-authorised handoff; physical-card origin is supplied by the server |
| Explore | Existing Zik website: in-store onboarding, partners, product information and future services |

Vault and ID share an authenticated local session. Documents and their metadata use AES-256-GCM with separate authenticated contexts. The key is held in authenticated device-only SecureStore. The app covers private screens when inactive and locks the Vault on backgrounding. The WebView has no API for reading local documents, identity or signing keys.

A native pass is a digital twin of the physical card's issued credential, not an NFC copy. A serial number does not establish ownership. The existing one-time handoff and device-binding policy are retained. Imported signatures and holder keys are checked before saving; a saved credential is not proof of current revocation status.

## Run

```bash
cd mobile
npm ci
EXPO_PUBLIC_ZIK_API_ORIGIN=https://your-deployed-zik-host.example npm run ios
```

Use a native development build, not Expo Go, to test biometric key protection and deep links. This SDK's native dependencies require Swift 6.2 or newer; the installed Xcode 16.2 / Swift 6.0 cannot compile them. Select a compatible Xcode before running the native build. If CocoaPods encounters an unsupported locale, run it with `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

`EXPO_PUBLIC_ZIK_API_ORIGIN` must be the exact HTTPS origin, without a path or credentials. Development builds also allow HTTP on localhost, 127.0.0.1 and the Android emulator's 10.0.2.2. Use HTTPS for physical-device testing. Without an origin, Vault and ID remain available and Explore explains that the website is not configured.

```bash
npm run typecheck
npx expo export --platform ios --output-dir /tmp/zik-mobile-export
# From the repository root:
npx vitest run tests/mobile-local.test.ts tests/device-bindings.test.ts
```

## Boundaries and remaining work

- Native OCR, document-derived claims, issued Zik ID, verified selective disclosure and native website proof approval are not implemented. The local profile does not claim verification.
- VaultCloud, StoreKit purchases/subscriptions and recovery are not connected. Keep originals. Uninstalling, resetting the device or invalidating biometric keys can make local data unavailable. Browser Vault data is not automatically migrated.
- Sharing explicitly creates a decrypted temporary copy for the chosen app. Zik cleans its export cache after sharing and on launch; it cannot remove copies retained by another app.
- The holder signing key remains the existing SecureStore-backed Ed25519 implementation, not a hardware non-exportable key. Universal Links/App Links and production handoff authorisation/recovery need a separate release review.
- No NFC/card-chip communication, online physical-card purchase, fake payment or invented verification is added.
- Android scaffolding is retained but has not been built or tested in this change.

## Device acceptance checks

1. Import a PDF and image, restart, authenticate and reopen. Check deletion and cancelled imports.
2. Save ID details, background the app, then confirm reauthentication is required and the task-switcher preview is covered.
3. Cancel authentication, deny permissions and test unavailable biometrics. Confirm existing files are never replaced when a key is unavailable.
4. Follow a real issued-pass handoff. Check signature rejection, expired/used tokens, pending/expired states and the device-binding limit.
5. Confirm physical-card handoffs show the digital-twin label and digital-only handoffs do not.
6. Browse the configured website; Vault/ID links should switch to native tabs. External HTTPS links require confirmation; file, JavaScript and unrecognised custom schemes are blocked.
7. Go offline: local documents/profile remain usable, Explore has a retry state, and pass display does not claim an online revocation check.
