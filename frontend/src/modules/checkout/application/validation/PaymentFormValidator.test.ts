import { describe, it, expect } from 'vitest';
import { validatePaymentForm, PaymentFormFields } from './PaymentFormValidator';

const validFields: PaymentFormFields = {
  amount: '100',
  payerEmail: 'test@example.com',
  cardNumber: '4111111111111111',
  cardholderName: 'JUAN PEREZ',
  expMonth: '12',
  expYear: '30',
  cvv: '123',
  identificationNumber: 'ABCD123456EFG',
};

describe('validatePaymentForm', () => {
  it('pasa con datos válidos', () => {
    const { valid } = validatePaymentForm(validFields);
    expect(valid).toBe(true);
  });

  it('falla si monto es menor al mínimo', () => {
    const { valid, errors } = validatePaymentForm({ ...validFields, amount: '5' });
    expect(valid).toBe(false);
    expect(errors.amount).toBeTruthy();
  });

  it('falla si monto no es número', () => {
    const { valid, errors } = validatePaymentForm({ ...validFields, amount: 'abc' });
    expect(valid).toBe(false);
    expect(errors.amount).toBeTruthy();
  });

  it('falla si email es inválido', () => {
    const { valid, errors } = validatePaymentForm({ ...validFields, payerEmail: 'no-es-email' });
    expect(valid).toBe(false);
    expect(errors.payerEmail).toBeTruthy();
  });

  it('falla si número de tarjeta es muy corto', () => {
    const { valid, errors } = validatePaymentForm({ ...validFields, cardNumber: '123456' });
    expect(valid).toBe(false);
    expect(errors.cardNumber).toBeTruthy();
  });

  it('falla si nombre del titular está vacío', () => {
    const { valid, errors } = validatePaymentForm({ ...validFields, cardholderName: '' });
    expect(valid).toBe(false);
    expect(errors.cardholderName).toBeTruthy();
  });

  it('falla si mes es inválido', () => {
    const { valid, errors } = validatePaymentForm({ ...validFields, expMonth: '13' });
    expect(valid).toBe(false);
    expect(errors.expMonth).toBeTruthy();
  });

  it('falla si la tarjeta está vencida (mismo año, mes anterior)', () => {
    const now = new Date();
    const year = String(now.getFullYear() % 100).padStart(2, '0');
    const pastMonth = String(now.getMonth()).padStart(2, '0'); // getMonth() is 0-based = last month
    if (pastMonth === '00') return; // skip in January edge case
    const { valid, errors } = validatePaymentForm({ ...validFields, expMonth: pastMonth, expYear: year });
    expect(valid).toBe(false);
    expect(errors.expMonth).toBeTruthy();
  });

  it('acepta tarjeta que vence este mes', () => {
    const now = new Date();
    const year = String(now.getFullYear() % 100).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const { valid } = validatePaymentForm({ ...validFields, expMonth: month, expYear: year });
    expect(valid).toBe(true);
  });

  it('falla si el año es del pasado', () => {
    const now = new Date();
    const pastYear = String((now.getFullYear() % 100) - 1).padStart(2, '0');
    const { valid, errors } = validatePaymentForm({ ...validFields, expYear: pastYear });
    expect(valid).toBe(false);
    expect(errors.expYear).toBeTruthy();
  });

  it('falla si CVV es menor a 3 dígitos', () => {
    const { valid, errors } = validatePaymentForm({ ...validFields, cvv: '12' });
    expect(valid).toBe(false);
    expect(errors.cvv).toBeTruthy();
  });

  it('falla si número de documento está vacío', () => {
    const { valid, errors } = validatePaymentForm({ ...validFields, identificationNumber: '' });
    expect(valid).toBe(false);
    expect(errors.identificationNumber).toBeTruthy();
  });
});
