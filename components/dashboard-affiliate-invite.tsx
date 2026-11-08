"use client";
import { useEffect } from "react";
// Invitation credentials live in the fragment, which is never sent to the server.
export function DashboardAffiliateInvite() {
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has("setup") && params.has("key")) location.replace(`/dashboard/affiliate${location.hash}`);
  }, []);
  return null;
}
