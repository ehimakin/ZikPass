"use client";

import { useEffect } from "react";
import { RecoveryPanel } from "@/components/recovery-panel";
import { classifyError } from "@/lib/shared/errors";

export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const classified = classifyError(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-1 items-center justify-center px-4 py-16 text-ink sm:px-6">
      <RecoveryPanel
        message={classified.message}
        onRestart={() => {
          window.location.href = "/wallet";
        }}
        onRetry={reset}
        operation="app.route_error"
        recoveryAction={classified.recoveryAction}
        title="This page ran into a problem"
      />
    </main>
  );
}
