import { IPaymentGateway } from '../../domain/interfaces/IPaymentGateway.ts';
import { IPaymentRepository } from '../../domain/interfaces/IPaymentRepository.ts';
import { ILogger } from '../../domain/interfaces/ILogger.ts';
import { CreatePaymentDTO } from '../dtos/CreatePaymentDTO.ts';
import { Payment } from '../../domain/entities/Payment.ts';
import { paymentStatusFromString } from '../../domain/value-objects/PaymentStatus.ts';

export interface CreatePaymentResult {
  orderId: string;
  paymentId: string;
  status: string;
  statusDetail: string | null;
}

export class CreatePaymentUseCase {
  constructor(
    private readonly gateway: IPaymentGateway,
    private readonly repository: IPaymentRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(dto: CreatePaymentDTO): Promise<CreatePaymentResult> {
    this.logger.info('payment.creating', {
      payerEmail: dto.payerEmail.value,
      amount: dto.amount.toFixed(),
      currency: dto.amount.currency,
    });

    const result = await this.gateway.createPayment({
      token: dto.token,
      amount: dto.amount,
      payerEmail: dto.payerEmail.value,
      payerFirstName: dto.payerFirstName,
      payerLastName: dto.payerLastName,
      identificationType: dto.identificationType,
      identificationNumber: dto.identificationNumber,
      paymentMethodId: dto.paymentMethodId,
      paymentMethodType: dto.paymentMethodType,
      installments: dto.installments,
      externalReference: dto.externalReference,
      issuerId: dto.issuerId,
    });

    const payerName = [dto.payerFirstName, dto.payerLastName].filter(Boolean).join(' ').trim() || undefined;

    const payment = new Payment(
      result.orderId,
      result.paymentId,
      dto.externalReference,
      dto.amount,
      paymentStatusFromString(result.status),
      result.statusDetail,
      dto.payerEmail.value,
      dto.paymentMethodId,
      dto.country,
      payerName,
    );

    await this.repository.save(payment);

    this.logger.info('payment.created', {
      orderId: result.orderId,
      paymentId: result.paymentId,
      status: result.status,
    });

    return result;
  }
}
