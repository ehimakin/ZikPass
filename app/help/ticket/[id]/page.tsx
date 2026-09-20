import { CustomerShell } from '@/components/customer/customer-shell';
import { TicketThread } from '@/components/customer/support/ticket-thread';
export const metadata = { title: 'Private help ticket · Zik', robots: { index: false, follow: false } };
export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CustomerShell active="help" title="Help ticket"><TicketThread id={id} /></CustomerShell>; }
