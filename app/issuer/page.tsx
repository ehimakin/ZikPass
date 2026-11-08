import { redirect } from "next/navigation";

// The legacy issuer console is retired from the admin interface.
export default function IssuerPage() {
  redirect("/dashboard/admin");
}
