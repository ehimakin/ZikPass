import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PurchaseSale } from "@/components/operator/purchase-sale";
import { OPERATOR_SESSION_COOKIE, readOperatorSession } from "@/lib/server/operator-session";

export default async function PurchaseSalePage() {
  const session = await readOperatorSession((await cookies()).get(OPERATOR_SESSION_COOKIE)?.value);
  if (!session) redirect("/store?next=/verify/purchase");
  return <PurchaseSale storeId={session.storeId} />;
}
