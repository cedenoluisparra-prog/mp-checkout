import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { CreatePaymentDTO } from './CreatePaymentDTO.ts';

const validBody = {
  token: 'tok_abc123',
  amount: '100',
  payerEmail: 'test@example.com',
  paymentMethodId: 'visa',
  paymentMethodType: 'credit_card',
  installments: '1',
};

Deno.test('CreatePaymentDTO - crea DTO válido y genera externalReference', () => {
  const dto = CreatePaymentDTO.fromRequest(validBody);
  assertEquals(dto.token, 'tok_abc123');
  assertEquals(dto.amount.value, 100);
  assertEquals(dto.payerEmail.value, 'test@example.com');
  assertEquals(dto.installments, 1);
  // externalReference es un UUID generado en el servidor
  assertEquals(typeof dto.externalReference, 'string');
  assertEquals(dto.externalReference.length, 36);
});

Deno.test('CreatePaymentDTO - rechaza token vacío', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, token: '' }),
    Error,
    'token',
  );
});

Deno.test('CreatePaymentDTO - rechaza token que no es string', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, token: 123 }),
    Error,
  );
});

Deno.test('CreatePaymentDTO - rechaza monto menor al mínimo ($10)', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, amount: '5' }),
    Error,
  );
});

Deno.test('CreatePaymentDTO - rechaza monto mayor al máximo ($999,999)', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, amount: '1000000' }),
    Error,
  );
});

Deno.test('CreatePaymentDTO - rechaza email inválido', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, payerEmail: 'no-es-email' }),
    Error,
  );
});

Deno.test('CreatePaymentDTO - rechaza paymentMethodType no permitido', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, paymentMethodType: 'cash' }),
    Error,
    'cash',
  );
});

Deno.test('CreatePaymentDTO - rechaza installments = 0', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, installments: '0' }),
    Error,
  );
});

Deno.test('CreatePaymentDTO - rechaza installments > 48', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, installments: '49' }),
    Error,
  );
});

Deno.test('CreatePaymentDTO - acepta installments en el límite superior (48)', () => {
  const dto = CreatePaymentDTO.fromRequest({ ...validBody, installments: '48' });
  assertEquals(dto.installments, 48);
});

Deno.test('CreatePaymentDTO - acepta país válido con tipo de documento correcto', () => {
  const dto = CreatePaymentDTO.fromRequest({ ...validBody, country: 'MX', identificationType: 'RFC' });
  assertEquals(dto.country, 'MX');
});

Deno.test('CreatePaymentDTO - acepta pasaporte (PP) en cualquier país', () => {
  const dto = CreatePaymentDTO.fromRequest({ ...validBody, country: 'AR', identificationType: 'PP' });
  assertEquals(dto.country, 'AR');
});

Deno.test('CreatePaymentDTO - rechaza país no soportado', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, country: 'ZZ' }),
    Error,
    'ZZ',
  );
});

Deno.test('CreatePaymentDTO - rechaza tipo de documento inválido para el país', () => {
  assertThrows(
    () => CreatePaymentDTO.fromRequest({ ...validBody, country: 'AR', identificationType: 'RFC' }),
    Error,
    'RFC',
  );
});

Deno.test('CreatePaymentDTO - acepta sin país ni tipo de documento', () => {
  const dto = CreatePaymentDTO.fromRequest(validBody);
  assertEquals(dto.country, undefined);
});
