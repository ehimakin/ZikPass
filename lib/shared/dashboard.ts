export const DASHBOARD_ROLES = [
  { id: "customer", title: "Customer", description: "Your wallet, private documents, recovery and support.", href: "/dashboard/customer" },
  { id: "affiliate", title: "Affiliate site", description: "Website integration, credentials and assisted setup.", href: "/dashboard/affiliate" },
  { id: "store", title: "Partner store", description: "Verify customers, process sales and activate cards.", href: "/dashboard/store" },
  { id: "admin", title: "Zik admin", description: "Partner approvals, support operations and recovery cases.", href: "/dashboard/admin" }
] as const;

export function storeDestination(next?: string, code?: string) {
  const action = next === "card" || next === "/verify/card" ? "card"
    : next === "purchase" || next === "/verify/purchase" ? "purchase"
    : next === "verify" || next === "/verify" || code ? "verify" : "";
  return `/dashboard/store${action ? `/${action}` : ""}${code && action === "verify" ? `?code=${encodeURIComponent(code)}` : ""}`;
}
