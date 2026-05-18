import { ITokenizer, CardData } from '../../domain/interfaces/ITokenizer';
import { IPaymentService } from '../../domain/interfaces/IPaymentService';
import { Payment } from '../../domain/entities/Payment';
import { CreatePaymentDTO } from '../dtos/CreatePaymentDTO';
import { ILogger } from '../../../shared/logging/Logger';

export class CreatePaymentUseCase {
  constructor(
    private readonly tokenizer: ITokenizer,
    private readonly paymentService: IPaymentService,
    private readonly logger: ILogger,
  ) {}

  async execute(dto: CreatePaymentDTO, card: CardData): Promise<Payment> {
    const token = await this.tokenizer.createToken(card);
    this.logger.info('payment.tokenized');

    const paymentMethod = await this.tokenizer.getPaymentMethod(card.cardNumber.replace(/\D/g, '').slice(0, 6));

    const nameParts = card.cardholderName.trim().split(' ');
    const payerFirstName = nameParts[0] ?? '';
    const payerLastName = nameParts.slice(1).join(' ') || payerFirstName;

    const payment = await this.paymentService.process({
      token,
      amount: dto.amount.value,
      payerEmail: dto.payerEmail.value,
      payerFirstName,
      payerLastName,
      country: dto.country,
      identificationType: card.identificationType,
      identificationNumber: card.identificationNumber,
      paymentMethodId: paymentMethod?.id ?? 'visa',
      paymentMethodType: paymentMethod?.paymentTypeId ?? 'credit_card',
      issuerId: paymentMethod?.issuerId,
      installments: dto.installments,
    });

    this.logger.info('payment.created', { orderId: payment.orderId, status: payment.status });
    return payment;
  }
}
