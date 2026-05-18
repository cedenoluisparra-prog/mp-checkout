import { DomainError } from './DomainError.ts';

export class PaymentError extends DomainError {
  constructor(message: string, code = 'PAYMENT_ERROR') {
    super(message, code);
    this.name = 'PaymentError';
  }
}
