import { IPaymentService, CreatePaymentRequest } from '../../domain/interfaces/IPaymentService';
import { Payment } from '../../domain/entities/Payment';
import { PaymentError } from '../../../shared/errors/AppError';
import { mapApiError } from '../providers/mercadopago/MercadoPagoErrorMapper';

export class PaymentRepository implements IPaymentService {
  constructor(
    private readonly supabaseUrl: string,
    private readonly supabaseAnonKey: string,
  ) {}

  async process(request: CreatePaymentRequest): Promise<Payment> {
    const res = await fetch(`${this.supabaseUrl}/functions/v1/create-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseAnonKey}`,
      },
      body: JSON.stringify({
        token: request.token,
        amount: request.amount,
        installments: request.installments,
        payerEmail: request.payerEmail,
        payerFirstName: request.payerFirstName,
        payerLastName: request.payerLastName,
        country: request.country,
        identificationType: request.identificationType,
        identificationNumber: request.identificationNumber,
        paymentMethodId: request.paymentMethodId,
        paymentMethodType: request.paymentMethodType,
        issuerId: request.issuerId,
      }),
    });

    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      throw new PaymentError(mapApiError(data), 'API_ERROR');
    }

    return {
      orderId: String(data.orderId ?? ''),
      paymentId: String(data.paymentId ?? ''),
      status: String(data.status ?? 'pending'),
      statusDetail: data.statusDetail != null ? String(data.statusDetail) : null,
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? 'MXN'),
    };
  }
}
