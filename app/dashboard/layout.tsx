import type { ReactNode } from "react";
export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Zik Pass", robots: { index: false, follow: false } };
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="zk-surface min-h-screen bg-[var(--zk-canvas)] text-[var(--zk-text)]">
    {children}</div>;
}
