import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cardDemoEnabled } from '@/lib/shared/card-activation';
import { OPERATOR_SESSION_COOKIE, readOperatorSession } from '@/lib/server/operator-session';
import { CardActivation } from '@/components/operator/card-activation';
export default async function CardActivationPage() {
  if (!cardDemoEnabled()) notFound();
  const session = await readOperatorSession((await cookies()).get(OPERATOR_SESSION_COOKIE)?.value);
  if (!session) redirect('/store?next=/verify/card');
  return <CardActivation storeId={session.storeId} />;
}
