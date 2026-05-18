import { Money } from '../../domain/value-objects/Money.ts';
import { Email } from '../../domain/value-objects/Email.ts';
import { ValidationError } from '../../domain/errors/ValidationError.ts';

const MAX_INSTALLMENTS = 48;
const COUNTRY_ID_TYPES: Record<string, string[]> = {
  MX: ['RFC', 'CURP', 'INE', 'PP'],
  AR: ['DNI', 'CI', 'LC', 'LE', 'PP'],
  PE: ['DNI', 'CE', 'PP'],
  BR: ['CPF', 'CNPJ', 'RNE', 'PP'],
  CO: ['CC', 'CE', 'NIT', 'PP'],
  CL: ['RUT', 'CI', 'PP'],
  UY: ['CI', 'RUT', 'PP'],
};
const ALLOWED_PAYMENT_TYPES = new Set([
  'credit_card', 'debit_card', 'prepaid_card',
  'digital_currency', 'digital_wallet', 'voucher_card', 'bank_transfer',
]);

export class CreatePaymentDTO {
  private constructor(
    readonly token: string,
    readonly amount: Money,
    readonly payerEmail: Email,
    readonly payerFirstName: string | undefined,
    readonly payerLastName: string | undefined,
    readonly identificationType: string | undefined,
    readonly identificationNumber: string | undefined,
    readonly paymentMethodId: string,
    readonly paymentMethodType: string,
    readonly installments: number,
    readonly externalReference: string,
    readonly issuerId: number | undefined,
    readonly country: string | undefined,
  ) {}

  static fromRequest(body: Record<string, unknown>): CreatePaymentDTO {
    const token = body.token;
    if (typeof token !== 'string' || !token.trim()) {
      throw new ValidationError('El token de tarjeta es requerido');
    }

    const amount = Money.of(parseFloat(String(body.amount ?? '')));
    const payerEmail = Email.of(String(body.payerEmail ?? ''));
    const paymentMethodId = String(body.paymentMethodId ?? 'visa');

    const paymentMethodType = String(body.paymentMethodType ?? 'credit_card');
    if (!ALLOWED_PAYMENT_TYPES.has(paymentMethodType)) {
      throw new ValidationError(`Tipo de método de pago no soportado: ${paymentMethodType}`);
    }

    const rawInstallments = parseInt(String(body.installments ?? '1'), 10);
    if (isNaN(rawInstallments) || rawInstallments < 1 || rawInstallments > MAX_INSTALLMENTS) {
      throw new ValidationError(`Las cuotas deben ser entre 1 y ${MAX_INSTALLMENTS}`);
    }

    const externalReference = crypto.randomUUID();

    const payerFirstName = body.payerFirstName ? String(body.payerFirstName).trim() : undefined;
    const payerLastName = body.payerLastName ? String(body.payerLastName).trim() : undefined;
    const country = body.country ? String(body.country).trim().toUpperCase() : undefined;
    if (country && !COUNTRY_ID_TYPES[country]) {
      throw new ValidationError(`País no soportado: ${country}`);
    }

    const identificationType = body.identificationType ? String(body.identificationType).trim() : undefined;
    if (identificationType) {
      const allowedForCountry = country
        ? COUNTRY_ID_TYPES[country]
        : Object.values(COUNTRY_ID_TYPES).flat();
      if (!allowedForCountry.includes(identificationType)) {
        throw new ValidationError(
          country
            ? `Tipo de documento no soportado para ${country}: ${identificationType}`
            : `Tipo de documento no soportado: ${identificationType}`,
        );
      }
    }

    const identificationNumber = body.identificationNumber ? String(body.identificationNumber).trim() : undefined;

    const rawIssuerId = body.issuerId;
    const issuerId = rawIssuerId !== undefined && rawIssuerId !== null
      ? parseInt(String(rawIssuerId), 10)
      : undefined;

    return new CreatePaymentDTO(
      token.trim(),
      amount,
      payerEmail,
      payerFirstName,
      payerLastName,
      identificationType,
      identificationNumber,
      paymentMethodId,
      paymentMethodType,
      rawInstallments,
      externalReference,
      issuerId,
      country,
    );
  }
}
