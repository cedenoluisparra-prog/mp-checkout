import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { CreatePaymentUseCase } from './CreatePaymentUseCase.ts';
import { CreatePaymentDTO } from '../dtos/CreatePaymentDTO.ts';
import { IPaymentGateway, PaymentResult, CreatePaymentParams } from '../../domain/interfaces/IPaymentGateway.ts';
import { IPaymentRepository } from '../../domain/interfaces/IPaymentRepository.ts';
import { ILogger } from '../../domain/interfaces/ILogger.ts';
import { Payment } from '../../domain/entities/Payment.ts';
import { PaymentStatus } from '../../domain/value-objects/PaymentStatus.ts';
import { Money } from '../../domain/value-objects/Money.ts';

const mockLogger: ILogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

class MockGateway implements IPaymentGateway {
  async createPayment(_params: CreatePaymentParams): Promise<PaymentResult> {
    return {
      orderId: 'ORDER-001',
      paymentId: 'PAY-001',
      status: 'processed',
      statusDetail: 'accredited',
    };
  }
  async fetchPayment(_id: string, _type: 'payment' | 'order'): Promise<Payment> {
    return new Payment('ORDER-001', 'PAY-001', 'ext-ref', Money.of(100), PaymentStatus.Processed, null, 'a@b.com', 'visa');
  }
}

class MockRepository implements IPaymentRepository {
  saved: Payment[] = [];
  async save(payment: Payment): Promise<void> { this.saved.push(payment); }
  async updateStatus(_orderId: string, _status: PaymentStatus, _detail?: string): Promise<void> {}
  async findByOrderId(_orderId: string): Promise<Payment | null> { return null; }
}

Deno.test('CreatePaymentUseCase - crea pago y persiste en repositorio', async () => {
  const gateway = new MockGateway();
  const repository = new MockRepository();
  const useCase = new CreatePaymentUseCase(gateway, repository, mockLogger);

  const dto = CreatePaymentDTO.fromRequest({
    token: 'tok_123',
    amount: 100,
    payerEmail: 'test@test.com',
    paymentMethodId: 'visa',
    paymentMethodType: 'credit_card',
    installments: 1,
  });

  const result = await useCase.execute(dto);

  assertEquals(result.orderId, 'ORDER-001');
  assertEquals(result.status, 'processed');
  assertEquals(repository.saved.length, 1);
  assertEquals(repository.saved[0].orderId, 'ORDER-001');
});
