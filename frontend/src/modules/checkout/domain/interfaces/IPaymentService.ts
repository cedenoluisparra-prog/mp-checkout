import { Payment } from '../entities/Payment';

export interface CreatePaymentRequest {
  token: string;
  amount: number;
  payerEmail: string;
  payerFirstName: string;
  payerLastName: string;
  country: string;
  identificationType: string;
  identificationNumber: string;
  paymentMethodId: string;
  paymentMethodType: string;
  issuerId?: number;
  installments: number;
}

export interface IPaymentService {
  process(request: CreatePaymentRequest): Promise<Payment>;
}
