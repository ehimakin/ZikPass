import type { Route } from "next";
import { StatusPage } from "@/components/customer/status-page";
import { ButtonLink } from "@/components/customer/ui";

export default function NotFound() {
  return (
    <StatusPage emoji="?" title="Page not found">
      <p>That link doesn&rsquo;t go anywhere in Zik Pass.</p>
      <div className="mt-5">
        <ButtonLink href={"/home" as Route} size="lg">
          Go to home
        </ButtonLink>
      </div>
    </StatusPage>
  );
}
