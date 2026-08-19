"use client";

import { useEffect } from "react";
import { installGlobalErrorHandlers } from "@/lib/client/error-reporting";

export function GlobalErrorReporter() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return null;
}
