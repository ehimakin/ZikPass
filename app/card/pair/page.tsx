import { notFound } from 'next/navigation';
import { cardDemoEnabled } from '@/lib/shared/card-activation';
import { CustomerShell } from '@/components/customer/customer-shell';
import { CardPairing } from '@/components/customer/card-pairing';
export const dynamic = 'force-dynamic';
export default function CardPairingPage() {
  if (!cardDemoEnabled()) notFound();
  return <CustomerShell active="pass"><CardPairing /></CustomerShell>;
}
