import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ClerkVerify } from "@/components/operator/clerk-verify";
import { OPERATOR_SESSION_COOKIE, readOperatorSession } from "@/lib/server/operator-session";

export default async function VerifyPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = await readOperatorSession((await cookies()).get(OPERATOR_SESSION_COOKIE)?.value);
  if (!session) {
    const code = getParam(params.code);
    redirect(`/store?next=/verify${code ? `&code=${encodeURIComponent(code)}` : ""}`);
  }
  return <ClerkVerify initialCode={getParam(params.code)} storeId={session.storeId} />;
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
