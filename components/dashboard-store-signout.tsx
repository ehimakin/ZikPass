"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/customer/ui";
export function DashboardStoreSignout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/operator/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not sign out. Try again.");
      router.replace("/dashboard"); router.refresh();
    } catch { setError("Could not sign out. Try again."); setBusy(false); }
  }
  return <div><Button loading={busy} onClick={() => void signOut()}>Sign out of store</Button>{error && <p role="alert">{error}</p>}</div>;
}
