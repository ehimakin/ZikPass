import { StatusPage } from "@/components/customer/status-page";

export const metadata = {
  title: "Offline",
  description: "Zik Pass needs a connection for this."
};

// Served by the service worker when a navigation fails while offline.
export default function OfflinePage() {
  return (
    <StatusPage emoji="!" title="You're offline">
      <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-f36598296a84-1" : undefined}>
        Zik Pass needs a connection to find stores, get a pass, or confirm your age
        for a site. Pages you&rsquo;ve already opened will still load.
      </p>
      <p className="mt-3 text-[13px] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f36598296a84-2" : undefined}>
        Your pass stays saved on this device - reconnect and open{" "}
        <span className="font-semibold">My pass</span> to use it.
      </p>
    </StatusPage>
  );
}
