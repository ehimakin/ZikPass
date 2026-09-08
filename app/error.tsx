"use client";

import { useEffect } from "react";
import type { Route } from "next";
import { StatusPage } from "@/components/customer/status-page";
import { Button, ButtonLink } from "@/components/customer/ui";
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
    <StatusPage emoji="!" title="This page ran into a problem">
      <p>{classified.message}</p>
      <div className="mt-5 space-y-2">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href={"/home" as Route} variant="secondary" size="lg">
          Go to home
        </ButtonLink>
      </div>
    </StatusPage>
  );
}
