import { IPaymentGateway, CreatePaymentParams, PaymentResult } from '../../../domain/interfaces/IPaymentGateway.ts';
import { ILogger } from '../../../domain/interfaces/ILogger.ts';
import { Payment } from '../../../domain/entities/Payment.ts';
import { Money } from '../../../domain/value-objects/Money.ts';
import { paymentStatusFromString } from '../../../domain/value-objects/PaymentStatus.ts';
import { PaymentError } from '../../../domain/errors/PaymentError.ts';
import { AppConfig } from '../../config/AppConfig.ts';
import { MercadoPagoErrorMapper } from './MercadoPagoErrorMapper.ts';

const ORDERS_API = 'https://api.mercadopago.com/v1/orders';
const PAYMENTS_API = 'https://api.mercadopago.com/v1/payments';
const FETCH_TIMEOUT_MS = 10_000;

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

export class MercadoPagoGateway implements IPaymentGateway {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: ILogger,
  ) {}

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const idempotencyKey = crypto.randomUUID();
    const body = {
      type: 'online',
      processing_mode: 'automatic',
      external_reference: params.externalReference,
      total_amount: params.amount.toFixed(),
      payer: {
        email: params.payerEmail,
        ...(params.payerFirstName ? { first_name: params.payerFirstName } : {}),
        ...(params.payerLastName ? { last_name: params.payerLastName } : {}),
        ...(params.identificationType && params.identificationNumber
          ? { identification: { type: params.identificationType, number: params.identificationNumber } }
          : {}),
      },
      transactions: {
        payments: [{
          amount: params.amount.toFixed(),
          payment_method: {
            id: params.paymentMethodId,
            type: params.paymentMethodType,
            token: params.token,
            installments: params.installments,
          },
        }],
      },
    };

    let response: Response;
    try {
      response = await fetchWithTimeout(ORDERS_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.mpAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      this.logger.error('mp.payment.timeout', { isTimeout });
      throw new PaymentError('El servicio de pago no respondió a tiempo', 'MP_TIMEOUT');
    }

    const json = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const message = MercadoPagoErrorMapper.toMessage(json);
      const detail = MercadoPagoErrorMapper.extractStatusDetail(json);
      this.logger.warn('mp.payment.rejected', { status: response.status, detail });
      throw new PaymentError(message, detail || 'PAYMENT_REJECTED');
    }

    const firstPayment = (json.transactions as Record<string, unknown>)
      ?.payments as Array<Record<string, unknown>>;

    return {
      orderId: String(json.id ?? ''),
      paymentId: String(firstPayment?.[0]?.id ?? json.id ?? ''),
      status: String(json.status ?? 'pending'),
      statusDetail: String(json.status_detail ?? firstPayment?.[0]?.status_detail ?? '') || null,
    };
  }

  async fetchPayment(resourceId: string, type: 'payment' | 'order'): Promise<Payment> {
    const url = type === 'order'
      ? `${ORDERS_API}/${resourceId}`
      : `${PAYMENTS_API}/${resourceId}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${this.config.mpAccessToken}` },
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      this.logger.error('mp.fetch.timeout', { resourceId, type, isTimeout });
      throw new PaymentError(`Timeout al obtener el recurso ${resourceId}`, 'MP_TIMEOUT');
    }

    if (!response.ok) {
      this.logger.error('mp.fetch.failed', { resourceId, type, status: response.status });
      throw new PaymentError(`No se pudo obtener el recurso ${resourceId}`, 'FETCH_FAILED');
    }

    const json = await response.json() as Record<string, unknown>;
    const amount = type === 'order'
      ? Money.fromString(String(json.total_amount ?? '0'))
      : Money.of(Number(json.transaction_amount ?? 0));

    return new Payment(
      String(json.id ?? resourceId),
      String(json.id ?? ''),
      String(json.external_reference ?? ''),
      amount,
      paymentStatusFromString(String(json.status ?? 'pending')),
      String(json.status_detail ?? '') || null,
      String((json.payer as Record<string, unknown>)?.email ?? ''),
      String((json.payment_method_id ?? (json.transactions as Record<string, unknown>)?.payments) ?? ''),
    );
  }
}
