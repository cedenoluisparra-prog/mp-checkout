export enum PaymentStatus {
  Pending = 'pending',
  Processed = 'processed',
  Failed = 'failed',
  Refunded = 'refunded',
}

export function paymentStatusFromString(raw: string): PaymentStatus {
  const map: Record<string, PaymentStatus> = {
    pending: PaymentStatus.Pending,
    processed: PaymentStatus.Processed,
    approved: PaymentStatus.Processed,
    failed: PaymentStatus.Failed,
    rejected: PaymentStatus.Failed,
    refunded: PaymentStatus.Refunded,
  };
  return map[raw.toLowerCase()] ?? PaymentStatus.Pending;
}

// Terminal states cannot transition to anything. Processed can only become Refunded.
const ALLOWED_TRANSITIONS = new Map<PaymentStatus, ReadonlySet<PaymentStatus>>([
  [PaymentStatus.Pending, new Set([PaymentStatus.Processed, PaymentStatus.Failed])],
  [PaymentStatus.Processed, new Set([PaymentStatus.Refunded])],
]);

export function isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED_TRANSITIONS.get(from)?.has(to) ?? false;
}
