import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ProcessWebhookUseCase } from './ProcessWebhookUseCase.ts';
import { IPaymentGateway, PaymentResult, CreatePaymentParams } from '../../domain/interfaces/IPaymentGateway.ts';
import { IPaymentRepository } from '../../domain/interfaces/IPaymentRepository.ts';
import { ILogger } from '../../domain/interfaces/ILogger.ts';
import { Payment } from '../../domain/entities/Payment.ts';
import { PaymentStatus } from '../../domain/value-objects/PaymentStatus.ts';
import { Money } from '../../domain/value-objects/Money.ts';
import { WebhookEvent } from '../../domain/entities/WebhookEvent.ts';

const mockLogger: ILogger = { info: () => {}, warn: () => {}, error: () => {} };

// Gateway always returns a payment with Processed status
class MockGateway implements IPaymentGateway {
  async createPayment(_p: CreatePaymentParams): Promise<PaymentResult> {
    return { orderId: '', paymentId: '', status: 'processed', statusDetail: null };
  }
  async fetchPayment(_id: string, _type: 'payment' | 'order'): Promise<Payment> {
    return new Payment(
      'ORDER-001', 'PAY-001', 'ext-ref',
      Money.of(100), PaymentStatus.Processed, 'accredited', 'a@b.com', 'visa',
    );
  }
}

class MockRepository implements IPaymentRepository {
  updated: Array<{ orderId: string; status: PaymentStatus }> = [];
  existingPayment: Payment | null = null;

  async save(_p: Payment): Promise<void> {}
  async updateStatus(orderId: string, status: PaymentStatus): Promise<void> {
    this.updated.push({ orderId, status });
  }
  async findByOrderId(_id: string): Promise<Payment | null> {
    return this.existingPayment;
  }
}

function makeEvent(): WebhookEvent {
  return new WebhookEvent('order', 'ORDER-001', '', '');
}

Deno.test('ProcessWebhookUseCase - actualiza estado en repositorio', async () => {
  const repository = new MockRepository();
  repository.existingPayment = new Payment(
    'ORDER-001', 'PAY-001', 'ext-ref',
    Money.of(100), PaymentStatus.Pending, null, 'a@b.com', 'visa',
  );

  const useCase = new ProcessWebhookUseCase(new MockGateway(), repository, mockLogger);
  await useCase.execute(makeEvent());

  assertEquals(repository.updated.length, 1);
  assertEquals(repository.updated[0].orderId, 'ORDER-001');
  assertEquals(repository.updated[0].status, PaymentStatus.Processed);
});

Deno.test('ProcessWebhookUseCase - no actualiza si la orden no existe en BD', async () => {
  const repository = new MockRepository();
  // existingPayment is null by default → order not found

  const useCase = new ProcessWebhookUseCase(new MockGateway(), repository, mockLogger);
  await useCase.execute(makeEvent());

  assertEquals(repository.updated.length, 0);
});

Deno.test('ProcessWebhookUseCase - idempotencia: no actualiza si el estado ya es el mismo', async () => {
  const repository = new MockRepository();
  // Existing status matches the gateway result (Processed)
  repository.existingPayment = new Payment(
    'ORDER-001', 'PAY-001', 'ext-ref',
    Money.of(100), PaymentStatus.Processed, 'accredited', 'a@b.com', 'visa',
  );

  const useCase = new ProcessWebhookUseCase(new MockGateway(), repository, mockLogger);
  await useCase.execute(makeEvent());

  assertEquals(repository.updated.length, 0);
});

Deno.test('ProcessWebhookUseCase - rechaza transición inválida (Failed → Processed)', async () => {
  const repository = new MockRepository();
  // Existing status is terminal (Failed); gateway returns Processed → invalid transition
  repository.existingPayment = new Payment(
    'ORDER-001', 'PAY-001', 'ext-ref',
    Money.of(100), PaymentStatus.Failed, null, 'a@b.com', 'visa',
  );

  const useCase = new ProcessWebhookUseCase(new MockGateway(), repository, mockLogger);
  await useCase.execute(makeEvent());

  assertEquals(repository.updated.length, 0);
});
