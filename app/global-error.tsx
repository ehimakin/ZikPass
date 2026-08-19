"use client";

import { useEffect } from "react";
import { RecoveryPanel } from "@/components/recovery-panel";
import { classifyError } from "@/lib/shared/errors";

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-mist px-4 py-16 text-ink">
          <RecoveryPanel
            message={classified.message}
            onRestart={() => {
              window.location.href = "/wallet";
            }}
            onRetry={reset}
            operation="app.global_error"
            recoveryAction={classified.recoveryAction}
            title="ZikPass ran into a problem"
          />
        </main>
      </body>
    </html>
  );
}
