import { DashboardStoreSignout } from "@/components/dashboard-store-signout";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OPERATOR_SESSION_COOKIE, readOperatorSession } from "@/lib/server/operator-session";
import { ButtonLink } from "@/components/customer/ui";
import { cardDemoEnabled } from "@/lib/shared/card-activation";
import { getStoreById } from "@/lib/shared/stores";
export default async function Page() {
  const session = await readOperatorSession((await cookies()).get(OPERATOR_SESSION_COOKIE)?.value);
  if (!session) redirect("/dashboard/store/login");
  return <main className="mx-auto max-w-4xl space-y-6 px-6 py-12"><h1 className="text-4xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f401235b1a56-1" : undefined}>Partner store</h1>
    <p>Signed in at {getStoreById(session.storeId)?.name}.</p>
    <div className="flex flex-wrap gap-4"><ButtonLink href="/dashboard/store/verify">Verify a customer</ButtonLink><ButtonLink href="/dashboard/store/purchase">Sell a Zik Pass</ButtonLink>{cardDemoEnabled() && <ButtonLink href="/dashboard/store/card">Activate a card</ButtonLink>}<ButtonLink href="/dashboard/store/login">Change store</ButtonLink></div><DashboardStoreSignout />
  </main>;
}
