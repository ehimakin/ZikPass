"use client";

import { useEffect, useState } from "react";

/**
 * Honest connectivity indicator. Shows only when the browser reports offline.
 * It does not claim anything works offline - it tells the reader why actions
 * that need the network (find a store, get a pass, confirm age) will fail.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="bg-[var(--zk-caution-bg)] px-4 py-2 text-center text-[12px] font-semibold text-[var(--zk-caution)]"
    >
      You&rsquo;re offline - store search, new passes and age checks need a connection.
    </div>
  );
}
