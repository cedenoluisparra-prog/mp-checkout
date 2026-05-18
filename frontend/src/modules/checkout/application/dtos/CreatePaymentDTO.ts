import { Money } from '../../domain/value-objects/Money';
import { Email } from '../../domain/value-objects/Email';

export interface CreatePaymentDTO {
  token: string;
  amount: Money;
  payerEmail: Email;
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

export function buildCreatePaymentDTO(raw: {
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
}): CreatePaymentDTO {
  return {
    ...raw,
    amount: Money.of(raw.amount),
    payerEmail: Email.of(raw.payerEmail),
  };
}
