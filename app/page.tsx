import { redirect } from "next/navigation";

// The customer entry point is the new mobile-first surface at /home.
// The previous WalletSurface homepage (with its forced splash window) is
// retired from the primary journey; its regression paths live on under
// /onboarding and /wallet.
export default function RootPage() {
  redirect("/home");
}
