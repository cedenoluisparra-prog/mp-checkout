import { Money } from '../value-objects/Money.ts';
import { PaymentStatus } from '../value-objects/PaymentStatus.ts';

export class Payment {
  constructor(
    readonly orderId: string,
    readonly paymentId: string | null,
    readonly externalReference: string,
    readonly amount: Money,
    readonly status: PaymentStatus,
    readonly statusDetail: string | null,
    readonly payerEmail: string,
    readonly paymentMethodId: string,
    readonly country?: string,
    readonly payerName?: string,
    readonly id?: string,
  ) {}

  withStatus(status: PaymentStatus, detail?: string): Payment {
    return new Payment(
      this.orderId,
      this.paymentId,
      this.externalReference,
      this.amount,
      status,
      detail ?? this.statusDetail,
      this.payerEmail,
      this.paymentMethodId,
      this.country,
      this.payerName,
      this.id,
    );
  }
}
