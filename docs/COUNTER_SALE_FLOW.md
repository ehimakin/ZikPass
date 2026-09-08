# Clerk-first Zik Pass sale

The customer can now bring the purchase card to the till without starting on their phone. Start at `/verify/counter`, also linked from `/verify` as **Sell a Zik Pass at the till**.

1. Select the terminal's store and start a counter sale.
2. Inspect photo ID; confirm 18+, or reject and stop without payment.
3. Collect the server-configured price by cash or card at the till, then explicitly record receipt. This prototype does not charge a bank card or integrate a POS terminal.
4. Show the customer the activation QR. It is withheld until ID and payment are confirmed. The activation window starts afresh at payment (the configured physical session TTL, normally 15 minutes).
5. The customer scans the private QR, chooses **Save my Zik Pass**, and finishes the existing demo device check. No store selection, repeat ID check or additional payment is required.
6. The clerk chooses **Check customer progress**, then **Next customer** once claimed or issued.

The printed purchase card links to `/card` instructions, not an automatically paid pass. The unique QR shown by the clerk contains the private activation token in the URL fragment, so it is not sent in the initial page request. The token is posted to the claim endpoint only when the customer elects to save the pass.

## Recovery and safeguards

- The terminal keeps its current sale in sessionStorage across reloads. Store selections have separate saved sales.
- The server stores a SHA-256 token hash rather than the raw token. The raw QR token is held by the clerk browser and handed to the customer.
- Generic enrollment cannot claim a counter sale by guessing its session ID.
- A claim commits the linked enrollment and confirmed payment together under the existing runtime-store transaction lock. Retrying with the same token and public key returns the same enrollment; another device key is rejected.
- Expired paid, unclaimed sales can receive a replacement QR from the authorised same-store terminal. This rotates the token and does not collect payment again. Staff must still be dealing with the same customer. Claimed sales cannot be reassigned through this operation.
- If the clerk's browser storage is cleared before handoff, the UI cannot recover the raw token. Staff-assisted sale lookup/recovery remains a future enhancement; do not take a second payment to work around it.
- Existing store-first customer onboarding remains available. This change does not redesign legacy demo entry modes.

## Prototype boundary

This reuses the existing demo clerk token, JSON runtime storage and demo device authentication. The transaction lock serialises claims within the existing single-process storage model; it is not a distributed database guarantee. Before real deployment, replace those pieces with authenticated staff sessions, shared durable transactional storage with uniqueness constraints, and the intended device-authentication mechanism. A clerk confirmation records an asserted till payment; it is not payment-provider settlement evidence.

## Validation

45 targeted counter-sale, physical-flow and payment tests passed. Tests include ID/payment ordering, wrong-store and unauthorised access, complete issuance, parallel idempotent claims, second-device rejection, generic-endpoint bypass prevention, rejected sales, and expired paid QR rotation. A browser walkthrough exercised clerk ID confirmation → simulated cash receipt → activation link → saved pass → clerk completion.
