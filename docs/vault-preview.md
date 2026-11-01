# Vault visual preview

> **PRODUCTION BLOCKER — `/vault-legacy` MUST be wiped before production.** Remove the legacy route and its page implementation, remove or replace every link to it (including the ID and retail demo links), and update the legacy disclosure tests. Do not ship this route or leave it accessible in a production build. Verify that `/vault-legacy` returns 404 before release.

Open `/Vault` or `/vault`. The capitalized URL redirects temporarily to the canonical `/vault` page. `/vault-preview` remains an alias for the same new page. The older local-storage demo lives at `/vault-legacy`; its ID/retail links and disclosure tests target that route.

The page uses the existing immersive CustomerShell, typography, header and bottom navigation. Artwork is responsive inline SVG in gold #CBB95B and white; there are no raster backgrounds.

Enter `OPEN` (case-insensitive, surrounding whitespace ignored) for a mock success. Any other non-empty key gives a mock failure. Empty submissions request a key. Both Enter and the arrow button submit the same form. Editing or resubmitting resets the visual state; refresh clears the input. Success fades the safe after opening its door; failure briefly shakes the red safe and shows alarm rays, without audio or rapid flashes. Reduced-motion mode uses static outcomes.

`lib/client/vault-preview.ts` is the isolated, abortable validation adapter. It does not import the existing VaultSession and performs no storage, cryptography or network operations. Replace its contract when production validation is designed. UI phases and SVG animation remain independent of that adapter. Pending work is cancelled on unmount and duplicate submissions are blocked.

Validation: `npx playwright test e2e/vault-preview.spec.ts` covers keyboard/button submission, repeat attempts, typing rotation, empty keys, both outcomes, refresh, reduced motion, 320/390/768/1440px layouts and all public Vault URLs and preservation of the legacy demo. Run against a local server with `ZIK_E2E_BASE_URL` as needed. No demo reset endpoint is called by this spec.

## Development-only demo Vault

During `npm run dev`, the exact key `memaguy` opens an empty demo Vault after the safe animation. Add/remove buttons use fictional samples held only in React memory; locking or refreshing clears them. Real document upload, storage and verification are not implemented. `OPEN` still runs only the original animation preview.

The `memaguy` branch and demo rendering require `NODE_ENV === "development"`; production and test environments reject the key. This is a development UI convenience, never an authentication mechanism. Do not connect it to real user data.

## Document search permission preview

The open demo Vault’s “search” control opens a native modal with document categories, an optional custom category, selectable photo/file/resource sources and explicit consent. Consent resets when the scope changes. All selections start unchecked and closing the modal clears them. The demo produces labelled fictional matches only: no file picker, library permissions, AI processing, upload, import or persistence occurs. Production search requires a separately designed device-permission and on-device processing integration.

## Local processing permission and persona preview

The development key now opens a permission screen before the Vault. Acceptance is unchecked by default and held only in memory; declining returns to the locked page. Locking or refresh clears it. This is prototype consent wording, not a production EULA. It outlines local text/data extraction, excludes automated face recognition/matching/age estimation and face templates, and distinguishes optional human identity checks from unverified extracted facts. Source access and external sharing remain separate permissions.

The demo includes an adjacent unverified persona card (placeholder portrait, name, date of birth and address), an Add demo document button and a National Insurance Number sample card. All inputs/samples remain in memory; no actual uploads, extraction, biometrics or verification are performed.
