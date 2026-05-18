import { IPaymentGateway } from '../../domain/interfaces/IPaymentGateway.ts';
import { IPaymentRepository } from '../../domain/interfaces/IPaymentRepository.ts';
import { ILogger } from '../../domain/interfaces/ILogger.ts';
import { WebhookEvent } from '../../domain/entities/WebhookEvent.ts';
import { paymentStatusFromString, isValidTransition } from '../../domain/value-objects/PaymentStatus.ts';

export class ProcessWebhookUseCase {
  constructor(
    private readonly gateway: IPaymentGateway,
    private readonly repository: IPaymentRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(event: WebhookEvent): Promise<void> {
    this.logger.info('webhook.received', {
      type: event.type,
      resourceId: event.resourceId,
    });

    const payment = await this.gateway.fetchPayment(event.resourceId, event.type);

    // C3: Verify the order exists in our DB — reject spoofed resourceIds
    const existing = await this.repository.findByOrderId(payment.orderId);
    if (!existing) {
      this.logger.warn('webhook.order_not_found', {
        orderId: payment.orderId,
        resourceId: event.resourceId,
      });
      return;
    }

    const newStatus = paymentStatusFromString(payment.status);

    // H3: Idempotency — skip if status is already the same
    if (existing.status === newStatus) {
      this.logger.info('webhook.duplicate_skipped', {
        orderId: payment.orderId,
        status: payment.status,
      });
      return;
    }

    // State machine: reject invalid transitions (e.g. failed → processed)
    if (!isValidTransition(existing.status, newStatus)) {
      this.logger.warn('webhook.invalid_transition', {
        orderId: payment.orderId,
        from: existing.status,
        to: newStatus,
      });
      return;
    }

    await this.repository.updateStatus(
      payment.orderId,
      newStatus,
      payment.statusDetail ?? undefined,
    );

    this.logger.info('webhook.processed', {
      type: event.type,
      resourceId: event.resourceId,
      status: payment.status,
    });
  }
}
