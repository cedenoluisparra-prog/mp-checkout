import { ITokenizer, CardData, PaymentMethodInfo } from '../../../domain/interfaces/ITokenizer';
import { mapSdkError } from './MercadoPagoErrorMapper';
import { PaymentError } from '../../../../shared/errors/AppError';

export class MercadoPagoTokenizer implements ITokenizer {
  constructor(private readonly mp: InstanceType<typeof window.MercadoPago>) {}

  async createToken(card: CardData): Promise<string> {
    try {
      const result = await this.mp.createCardToken({
        cardNumber: card.cardNumber.replace(/\D/g, ''),
        cardholderName: card.cardholderName,
        cardExpirationMonth: card.cardExpirationMonth.padStart(2, '0'),
        cardExpirationYear: card.cardExpirationYear.length === 4
          ? card.cardExpirationYear
          : `20${card.cardExpirationYear.slice(-2)}`,
        securityCode: card.securityCode,
        identificationType: card.identificationType,
        identificationNumber: card.identificationNumber,
      });
      return result.id;
    } catch (err) {
      throw new PaymentError(mapSdkError(err), 'TOKENIZATION_ERROR');
    }
  }

  async getPaymentMethod(bin: string): Promise<PaymentMethodInfo | null> {
    try {
      const methods = await this.mp.getPaymentMethods({ bin });
      const result = methods.results?.[0];
      if (!result?.id) return null;
      return {
        id: result.id,
        paymentTypeId: result.payment_type_id ?? 'credit_card',
        issuerId: result.issuer?.id,
      };
    } catch {
      return null;
    }
  }
}
