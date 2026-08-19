"use client";

export async function reportClientError(input: {
  message: string;
  operation?: string;
  route?: string;
  context?: Record<string, unknown>;
}): Promise<string | null> {
  try {
    const response = await fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const data = (await response.json()) as { reference: string | null };
    return data.reference;
  } catch {
    return null;
  }
}

let installed = false;

/**
 * Catches errors and rejections that never reach a component's own
 * try/catch (e.g. a promise created outside React event handlers) so they
 * still produce a filed report instead of vanishing into the console.
 */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === "undefined") {
    return;
  }

  installed = true;

  window.addEventListener("error", (event) => {
    void reportClientError({
      message: event.message || "Unhandled error",
      operation: "window.onerror",
      route: window.location.pathname
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    const message = reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection");
    void reportClientError({
      message,
      operation: "unhandledrejection",
      route: window.location.pathname
    });
  });
}
