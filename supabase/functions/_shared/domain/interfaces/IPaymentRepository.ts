import { Payment } from '../entities/Payment.ts';
import { PaymentStatus } from '../value-objects/PaymentStatus.ts';

export interface IPaymentRepository {
  save(payment: Payment): Promise<void>;
  updateStatus(orderId: string, status: PaymentStatus, detail?: string): Promise<void>;
  findByOrderId(orderId: string): Promise<Payment | null>;
}
