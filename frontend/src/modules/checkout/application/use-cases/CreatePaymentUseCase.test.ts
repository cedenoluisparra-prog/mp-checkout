import { describe, it, expect, vi } from 'vitest';
import { CreatePaymentUseCase } from './CreatePaymentUseCase';
import { ITokenizer, CardData, PaymentMethodInfo } from '../../domain/interfaces/ITokenizer';
import { IPaymentService, CreatePaymentRequest } from '../../domain/interfaces/IPaymentService';
import { Payment } from '../../domain/entities/Payment';
import { ILogger } from '../../../shared/logging/Logger';
import { buildCreatePaymentDTO } from '../dtos/CreatePaymentDTO';

const mockLogger: ILogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mockPayment: Payment = {
  orderId: 'ORDER-001',
  paymentId: 'PAY-001',
  status: 'processed',
  statusDetail: 'accredited',
  amount: 100,
  currency: 'MXN',
};

const mockCard: CardData = {
  cardNumber: '4111111111111111',
  cardholderName: 'JUAN PEREZ',
  cardExpirationMonth: '12',
  cardExpirationYear: '30',
  securityCode: '123',
  identificationType: 'RFC',
  identificationNumber: 'ABCD123456EFG',
};

class MockTokenizer implements ITokenizer {
  async createToken(_card: CardData): Promise<string> { return 'tok_test_123'; }
  async getPaymentMethod(_bin: string): Promise<PaymentMethodInfo | null> {
    return { id: 'visa', paymentTypeId: 'credit_card' };
  }
}

class MockPaymentService implements IPaymentService {
  processed: CreatePaymentRequest[] = [];
  async process(req: CreatePaymentRequest): Promise<Payment> {
    this.processed.push(req);
    return mockPayment;
  }
}

describe('CreatePaymentUseCase', () => {
  it('tokeniza y procesa el pago', async () => {
    const service = new MockPaymentService();
    const useCase = new CreatePaymentUseCase(new MockTokenizer(), service, mockLogger);

    const dto = buildCreatePaymentDTO({
      token: '', amount: 100, payerEmail: 'test@example.com',
      payerFirstName: '', payerLastName: '', country: 'MX',
      identificationType: 'RFC', identificationNumber: 'ABCD123456EFG',
      paymentMethodId: 'visa', paymentMethodType: 'credit_card', installments: 1,
    });

    const result = await useCase.execute(dto, mockCard);

    expect(result.orderId).toBe('ORDER-001');
    expect(result.status).toBe('processed');
    expect(service.processed.length).toBe(1);
    expect(service.processed[0].token).toBe('tok_test_123');
    expect(service.processed[0].paymentMethodId).toBe('visa');
  });

  it('llama al logger al crear el pago', async () => {
    const service = new MockPaymentService();
    const useCase = new CreatePaymentUseCase(new MockTokenizer(), service, mockLogger);

    const dto = buildCreatePaymentDTO({
      token: '', amount: 100, payerEmail: 'test@example.com',
      payerFirstName: '', payerLastName: '', country: 'MX',
      identificationType: 'RFC', identificationNumber: 'ABCD123456EFG',
      paymentMethodId: 'visa', paymentMethodType: 'credit_card', installments: 1,
    });

    await useCase.execute(dto, mockCard);
    expect(mockLogger.info).toHaveBeenCalledWith('payment.created', expect.objectContaining({ orderId: 'ORDER-001' }));
  });
});
