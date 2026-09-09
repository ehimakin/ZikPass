import { redirect } from "next/navigation";

// The store-session dashboard was the pre-/find way to bootstrap a physical
// session and duplicated /verify's code lookup. Both are now covered by the
// customer store finder and the clerk purchase-sale flow.
export default function StorePage() {
  redirect("/verify");
}
