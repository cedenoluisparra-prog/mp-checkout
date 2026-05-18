import { Payment } from '../entities/Payment.ts';
import { Money } from '../value-objects/Money.ts';

export interface PaymentResult {
  orderId: string;
  paymentId: string;
  status: string;
  statusDetail: string | null;
}

export interface CreatePaymentParams {
  token: string;
  amount: Money;
  payerEmail: string;
  payerFirstName?: string;
  payerLastName?: string;
  identificationType?: string;
  identificationNumber?: string;
  paymentMethodId: string;
  paymentMethodType: string;
  installments: number;
  externalReference: string;
  issuerId?: number;
}

export interface IPaymentGateway {
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  fetchPayment(resourceId: string, type: 'payment' | 'order'): Promise<Payment>;
}
