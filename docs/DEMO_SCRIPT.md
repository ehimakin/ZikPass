# Zik Pass — five-minute demo script

A repeatable walkthrough for showing the prototype. Everything below is a
demonstration flow: no real ID is scanned or stored, no card is charged.

## Before you start (30 seconds, off-camera)

1. `npm run dev` is running on `http://localhost:3000`.
2. Reset to a clean slate: on `/help` tap **Reset demo data**, or
   `curl -X POST http://localhost:3000/api/demo/reset`.
3. Clear the browser's Zik Pass storage so "you" have no pass yet:
   DevTools → Application → IndexedDB → delete `zik-pass-wallet` (or use a fresh
   private window).
4. Have **two windows** side by side:
   - **Customer** — a normal/mobile-sized window at `/home`.
   - **Clerk** — a second window at `/verify`.

Optional: set `ZIK_PASS_ISSUANCE_PRICE_MINOR=0` in `.env` first if you want to
demo the free flow instead of the £1.99 test price.

---

## 1. The problem and the pass (45s) — Customer window

- Start on **`/home`**. "Age checks online usually mean uploading your ID or a
  selfie to every site. Zik Pass does the ID check **once**, in person, and
  gives you a reusable signed pass that lives on your device."
- Point at the **"What a site receives"** card: only a yes/no over-18 result and
  a one-time token — no name, DOB, photo or document number. Note it's a
  prototype, not a zero-knowledge proof.
- Tap **Get Zik Pass · £1.99**.

## 2. Find a store (30s) — Customer

- On **`/find`**, type a postcode (`EC1`) — the list re-sorts by distance and
  the schematic map recentres. "These are fictional demo stores; the map is a
  labelled schematic, not real tiles."
- Open **Zik Shoreditch** → **Choose this store**.

## 3. Get verified (60s) — Customer + Clerk

- On **`/get-pass`**: "bring photo ID and this phone." Tap **Start**.
- A **6-character code + QR** appears with a live checklist. "I'd show this to
  the clerk."
- **Clerk window** (`/verify`): set **This terminal** to **Zik Shoreditch**,
  type the code, **Find session**.
  - *(Optional 10s aside)* set the terminal to a different store first and try
    the code → "not authorised for this store." Then switch back.
- Clerk: **Confirm 18+**. "The clerk looked at the ID in person and handed it
  back — nothing was scanned."
- **Customer window**: the device check runs on its own; the checklist ticks
  through.

## 4. Pay and receive the pass (45s) — Customer

- The **payment** step unlocks. Tap **Zik demo checkout**.
  - First tap **Simulate a declined card** → the sheet stays open with the error
    and a retry. "A decline is a decline — nothing is issued."
  - Then **Pay £1.99** → success.
- "No card details are collected. Apple Pay would slot in here via Stripe once
  the account and payment domain are set up — that's not wired in this build,
  and we don't fake it."
- The flow lands on **Your pass is ready** → **Open my pass**.
- On **`/pass`**: the active pass, its unique signature mark, pass id and expiry.
  Scroll to **Add to another device** and **Remove this pass** (with a confirm).

## 5. Use it on a site (60s) — Customer

- New tab → **`/affiliate-demo`** (the "JerkMeat" demo site — an original
  food-only parody). "A third-party 18+ site."
- Tap **Verify with Zik** → the Zik-hosted consent screen shows exactly what's
  **shared** (over-18: yes/no) vs **not shared** (name, DOB, photo, ID number).
- **Confirm I'm over 18** → back on the site, **Age verified with Zik**, the
  gate opens.
- Reload the site → it stays verified from a short signed session, no round-trip
  to Zik. "The site never saw your identity — only a one-time signed result its
  backend exchanged server-to-server."

## 6. Wrap (20s)

- "One in-person check, a pass you own, and sites that learn only that you're
  old enough." Mention the **clerk-first sale at the till** (`/verify/purchase`)
  and the honest **offline** page as extras if there's time.

---

## Optional closing: the wider Zik platform

After completing the working Zik Pass demonstration: “What you’ve seen is Zik Pass—the
first Zik product. The same privacy principle later expands into ZikVault and Zik ID.”
Optionally open `/ecosystem`. Vault and ID are planned concepts with planned prices; the
car-hire sharing example is illustrative. Keep the actual demo focused on Pass. Preserved
experimental direct routes are not part of this product demonstration.

## Quick-reference URLs

| Purpose | URL |
| --- | --- |
| Read-only product direction (optional) | `/ecosystem` |
| Customer home | `/home` |
| Store finder | `/find` |
| Onboarding | `/get-pass` |
| Wallet | `/pass` |
| Activate a purchase card | `/card` |
| Clerk verify (customer has a code) | `/verify` |
| Clerk-first purchase sale | `/verify/purchase` |
| Affiliate demo | `/affiliate-demo` |
| Reset demo state | `POST /api/demo/reset` |

## If something goes wrong mid-demo

- Reset with the Help button / `/api/demo/reset` and clear IndexedDB.
- The customer flow **resumes** an in-flight enrolment on reload, and `/pass`
  reconciles a pass that was issued server-side but not stored locally.
- Codes expire after ~5 minutes — start again from `/get-pass` if the clerk
  can't find one.
