import { ValidationError } from '../../../shared/errors/AppError';
import { Money } from '../../domain/value-objects/Money';
import { Email } from '../../domain/value-objects/Email';
import { CardNumber } from '../../domain/value-objects/CardNumber';

export interface PaymentFormFields {
  amount: string;
  payerEmail: string;
  cardNumber: string;
  cardholderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  identificationNumber: string;
}

export interface FormErrors {
  amount?: string;
  payerEmail?: string;
  cardNumber?: string;
  cardholderName?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  identificationNumber?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FormErrors;
}

export function validatePaymentForm(fields: PaymentFormFields): ValidationResult {
  const errors: FormErrors = {};

  try {
    Money.of(parseFloat(fields.amount));
  } catch (e) {
    errors.amount = e instanceof ValidationError ? e.message : 'Monto inválido';
  }

  try {
    Email.of(fields.payerEmail);
  } catch (e) {
    errors.payerEmail = e instanceof ValidationError ? e.message : 'Correo inválido';
  }

  try {
    CardNumber.of(fields.cardNumber);
  } catch (e) {
    errors.cardNumber = e instanceof ValidationError ? e.message : 'Número de tarjeta inválido';
  }

  if (!fields.cardholderName.trim()) {
    errors.cardholderName = 'Ingresa el nombre del titular';
  }

  const month = parseInt(fields.expMonth, 10);
  if (!fields.expMonth || isNaN(month) || month < 1 || month > 12) {
    errors.expMonth = 'Mes inválido';
  }

  const year = parseInt(fields.expYear, 10);
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  if (!fields.expYear || isNaN(year) || year < currentYear) {
    errors.expYear = 'Año inválido';
  } else if (!errors.expMonth && year === currentYear && month < currentMonth) {
    errors.expMonth = 'Tarjeta vencida';
  }

  if (!fields.cvv || fields.cvv.length < 3) {
    errors.cvv = 'CVV inválido';
  }

  if (!fields.identificationNumber.trim()) {
    errors.identificationNumber = 'Ingresa tu documento';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
