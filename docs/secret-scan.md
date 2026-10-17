# Local repository secret scan

Scope: ZikPass local checkout and all locally available Git refs. Scanner: Gitleaks 8.30.1. No remote fetch, credential validation against providers, history rewriting, or credential rotation was performed.

## Result

**No confirmed exposed credentials found in the scanned committed history or current committable files.** This is a secret-exposure scan, not a security certification or application penetration test.

- Git contains 81 reachable commits across local branches and remote-tracking refs. Gitleaks inspected 78 commits with scanable patch content; a supplemental comparison examined 1,522 reachable Git blobs.
- Scanned 765 current tracked/untracked non-ignored files and six selected ignored local configuration/runtime files.
- History: eight matches, reviewed as false positives: a localStorage key name, four TypeScript type references, one test-only owner secret, and two CocoaPods checksum entries.
- Current files: seven matches, the current versions of those same false positives.
- Ignored local files: 45 matches: two configured secret values in `.env.local`, one Google Maps API key in `DELETE_BEFORE_PRODUCTION_CREDENTIALS/google-maps.env`, and 42 runtime token hashes. These are not evidence of Git exposure.
- The locally stored issuer private key exists at `data/issuer-keypair.json` and is ignored. Supplemental checks found no private JWK scalar literals in the inspected historical blobs.
- Exact-value comparisons found none of the configured local client secret, onboarding agent key, admin password hash, Google Maps key or issuer private scalar in inspected historical blobs. No values appear in this report.
- `.env`, `.env.local` and `mobile/.env.local` are ignored and untracked. Only `.env.example` is tracked. The mobile website origin is public configuration, not a credential.

## Prevention gaps to address before release

1. `.p8` Apple private keys are not covered by the current ignore rules. Add an exclusion before downloading an App Store Connect API key into the repo.
2. `.env.production` and `mobile/.env.production` are not ignored. Broaden environment-file exclusions while explicitly retaining safe example files. The existing `.env.production.local` pattern is covered.
3. Generated `mobile/.expo` metadata is tracked. The current devices list is empty, but future local device records should not be committed. Untrack generated local metadata and ignore it as a separate reviewed cleanup.
4. Add repeatable secret scanning to pre-push/CI checks, plus GitHub push protection where available. Use narrowly reviewed exceptions for known false positives rather than ignoring whole source directories.
5. The Google Maps browser API key is deliberately client-visible when used through `NEXT_PUBLIC_`. Verify website/referrer restrictions, allowed APIs and quotas in Google Cloud; this scan did not access or change those settings.
6. Keep issuer private keys, admin credentials and runtime data outside source control and in the appropriate deployment secret/storage systems. If a real credential is later confirmed exposed, rotate/revoke it before considering history cleanup.

## Limits

Remote-tracking refs reflect the last local fetch. Deleted remote branches, unreachable/reflog-only commits, remote-only commits, GitHub Actions logs/artifacts, releases, forks, deployed bundles, cloud environment settings and developer credentials outside this repository were not audited.

Dependency/build output directories were excluded from the current-file snapshot. Two large MP4 assets were excluded from the current snapshot and supplemental exact-value blob comparison: `public/13061609-hd_1920_1080_60fps.mp4` and `public/Hero Videos/Splash rough 1.mp4`. Binary archives were not unpacked. Pattern scanners can miss unsupported/custom secret formats.

Private temporary copies used for scanning were removed after analysis. Retained local scan reports contain locations and rule metadata only, with matched values and snippets removed. Application files, local credentials, ignore rules and Git history were not changed by the scan.

## Follow-up remediation

The original scan findings above describe the state before remediation. Ignore rules now cover `.p8` and environment variants; generated Expo metadata has been untracked without deleting local files. Local commit/push hooks and a pinned CI scanner have been added. GitHub secret scanning and push protection were verified enabled. The configured history/current-file scan and safeguard tests pass. Google Cloud key restrictions remain unverified because authenticated console access was unavailable. See [secret-protection.md](secret-protection.md) for setup and remaining verification.
