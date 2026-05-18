export interface CardData {
  cardNumber: string;
  cardholderName: string;
  cardExpirationMonth: string;
  cardExpirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
}

export interface PaymentMethodInfo {
  id: string;
  paymentTypeId: string;
  issuerId?: number;
}

export interface ITokenizer {
  createToken(card: CardData): Promise<string>;
  getPaymentMethod(bin: string): Promise<PaymentMethodInfo | null>;
}
