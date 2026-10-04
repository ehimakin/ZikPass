export const CATEGORIES = ['general', 'technical', 'bug', 'recovery', 'billing', 'privacy', 'store_partner'] as const;
export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'waiting_engineering', 'resolved', 'closed'] as const;
export const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export const BUG_STATUSES = ['new', 'investigating', 'in_progress', 'in_review', 'resolved'] as const;
export const RECOVERY_OUTCOMES = ['not_reviewed', 'guidance_sent', 'customer_confirmed_recovery', 'needs_reverification', 'no_recoverable_backup'] as const;
export type Category = typeof CATEGORIES[number];
export type TicketStatus = typeof TICKET_STATUSES[number];
export type Priority = typeof PRIORITIES[number];
export type BugStatus = typeof BUG_STATUSES[number];
export type RecoveryOutcome = typeof RECOVERY_OUTCOMES[number];
export const RESPONSE_HOURS: Record<Priority, number> = { urgent: 4, high: 24, normal: 72, low: 120 };
export type SupportMessage = { id: string; requestId: string; author: 'customer' | 'admin'; authorName: string; visibility: 'public' | 'internal'; body: string; createdAt: string };
export type PartnerApproval = { status: 'approved'; approvedAt: string; approvedBy: string };
export type Ticket = {
  id: string; accessHash: string; creationId: string; subject: string; category: Category; priority: Priority; status: TicketStatus;
  partnerApproval?: PartnerApproval;
  contactEmail?: string; errorReference?: string; diagnostic?: string; assignee: string; resolution: string; recoveryOutcome: RecoveryOutcome;
  createdAt: string; updatedAt: string; dueAt: string; firstResponseAt?: string; closedAt?: string; version: number; bugId?: string; messages: SupportMessage[];
};
export type PublicTicket = Pick<Ticket, 'id' | 'subject' | 'category' | 'status' | 'resolution' | 'createdAt' | 'updatedAt' | 'version' | 'messages'>;
export type AdminTicket = Omit<Ticket, 'accessHash' | 'creationId'>;
export type Bug = {
  id: string; fingerprint?: string; title: string; status: BugStatus; priority: Priority; assignee: string; route: string; operation: string;
  occurrences: number; references: string[]; ticketIds: string[]; reproduction: string; expected: string; actual: string;
  fixSummary: string; verification: string; changeUrl: string; createdAt: string; updatedAt: string; lastSeenAt: string; version: number;
};
export type AuditEvent = { id: string; at: string; actor: string; action: string; target: string; changes: string[] };
export type Workspace = { tickets: AdminTicket[]; bugs: Bug[]; audit: AuditEvent[]; storageReady: boolean; recoveryAvailable: boolean; generatedAt: string };
export function label(value: string) { return value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()); }
export function isActive(status: TicketStatus) { return status !== 'resolved' && status !== 'closed'; }
