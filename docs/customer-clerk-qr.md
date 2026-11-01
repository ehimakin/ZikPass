# Customer–clerk QR handoff: local test

This first milestone connects two browsers. It does not perform device authentication, approve final issuance or create a digital voucher credential.

## Start with the dashboard

1. Run `npm run dev -- --hostname 0.0.0.0` from the repository if the development server is not already running.
2. Put the Mac and iPhone on the same trusted Wi-Fi network. Find the Mac’s Wi-Fi IP in System Settings → Wi-Fi → Details → TCP/IP.
3. On the Mac, open `http://YOUR_MAC_IP:3000/dashboard`. Use the IP address on the Mac too: the QR uses the terminal’s current origin. A localhost QR will not work on the phone.
4. Choose **Partner store**, then sign in with the configured store access code. In the default demo configuration the fallback is `8640`; configured store codes take precedence.
5. Choose **Sell a Zik Pass**. Select **Digital ZikPass · single-use voucher**, then **Start sale**.
6. Simulate the witnessed ID check with **ID checked — confirm 18+**. With the default early-access price, select **Continue — show QR**; no payment is needed. Nonzero configured prices are recorded at the till, never charged by this screen.
7. Scan the displayed QR with the iPhone Camera and open the link in Safari. No app or TestFlight update is needed.
8. The customer enters `/dashboard/customer/activate` and sees **Connected to the counter**. The clerk sees **Customer connected** automatically, normally within three seconds.

All actors enter through `/dashboard`; the clerk uses its partner-store workspace and the QR deep-links into the customer workspace. Registered sites retain their affiliate workspace. The handoff screens omit the general website navigation so it cannot cover the QR. The local visual editor is already hidden on non-localhost addresses.

## Behaviour and boundaries

- The QR contains a random token in its URL fragment. The server stores its hash. It becomes usable only after the clerk’s ID/till confirmation.
- Opening the link records arrival only. It is not proof of device ownership, an authenticated device binding, or clerk approval for final issuance. Someone with the QR can also open the page; this is deliberately not a credential claim.
- Refreshing the customer page is safe. Clerk progress polls automatically; a failed poll shows a warning. “Customer connected” means the page was opened, not guaranteed continued online presence.
- An expired QR shows recovery instructions. The clerk can replace it without another payment; the previous token is invalidated and the connected indicator resets.
- Existing physical-card sales retain their separate £2.99 route and claim behaviour. Digital voucher price uses existing server pricing (default free early access).
- The sale API now requires the signed clerk login cookie and derives the store on the server. The browser no longer sends the shared demo verifier token.
- No server deployment or app release is performed. This demo still uses the repository’s prototype verifier and runtime storage; it is not production-ready identity assurance.

If Safari cannot load the link, first open the dashboard URL manually on the iPhone. Check Wi-Fi isolation, VPN routing and the Mac firewall. HTTP on trusted Wi-Fi is sufficient for this connection-only test; the next authentication milestone needs HTTPS and its own security validation. An HTTPS tunnel is an alternative, but use that same tunnel origin for both roles and do not expose a default-code terminal publicly.

## Validation

`npx vitest run tests/purchase-sale.test.ts tests/dashboard.test.ts tests/purchase-sale-route.test.ts`

Use a disposable `ZIK_RUNTIME_DATA_DIR` when running service tests to keep local demo records intact. Tests cover arrival prerequisites, no issuance, repeated arrival, expiry, token replacement, clerk login enforcement and the pre-existing physical-card claim path. A two-browser Playwright smoke test confirmed the arrival page and automatic clerk update; a real iPhone camera scan remains the manual acceptance check.
