import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { IPaymentRepository } from '../../domain/interfaces/IPaymentRepository.ts';
import { ILogger } from '../../domain/interfaces/ILogger.ts';
import { Payment } from '../../domain/entities/Payment.ts';
import { PaymentStatus, paymentStatusFromString } from '../../domain/value-objects/PaymentStatus.ts';
import { Money } from '../../domain/value-objects/Money.ts';
import { PaymentError } from '../../domain/errors/PaymentError.ts';
import { AppConfig } from '../config/AppConfig.ts';

export class SupabasePaymentRepository implements IPaymentRepository {
  private readonly client;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: ILogger,
  ) {
    this.client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  async save(payment: Payment): Promise<void> {
    const { error } = await this.client.from('payments').insert({
      order_id: payment.orderId,
      payment_id: payment.paymentId,
      external_reference: payment.externalReference,
      amount: payment.amount.value,
      currency: payment.amount.currency,
      status: payment.status,
      status_detail: payment.statusDetail,
      payer_email: payment.payerEmail,
      payment_method_id: payment.paymentMethodId,
      country: payment.country ?? null,
      payer_name: payment.payerName ?? null,
    });

    if (error) {
      this.logger.error('db.payment.save.failed', {
        orderId: payment.orderId,
        code: error.code,
      });
      throw new PaymentError('Error al persistir el pago', 'DB_SAVE_ERROR');
    }
  }

  async updateStatus(orderId: string, status: PaymentStatus, detail?: string): Promise<void> {
    const { error } = await this.client
      .from('payments')
      .update({ status, status_detail: detail ?? null })
      .eq('order_id', orderId);

    if (error) {
      this.logger.error('db.payment.update.failed', {
        orderId,
        code: error.code,
      });
      throw new PaymentError('Error al actualizar el estado del pago', 'DB_UPDATE_ERROR');
    }
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) {
      this.logger.error('db.payment.find.failed', {
        orderId,
        code: error.code,
      });
      throw new PaymentError('Error al consultar el pago', 'DB_FIND_ERROR');
    }

    if (!data) return null;

    return new Payment(
      data.order_id,
      data.payment_id,
      data.external_reference,
      Money.of(Number(data.amount), data.currency),
      paymentStatusFromString(data.status),
      data.status_detail,
      data.payer_email,
      data.payment_method_id,
      data.country ?? undefined,
      data.payer_name ?? undefined,
      data.id,
    );
  }
}
