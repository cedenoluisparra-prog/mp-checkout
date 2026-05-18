interface PayerCost {
  installments: number;
  recommended_message: string;
  min_allowed_amount?: number;
  max_allowed_amount?: number;
}

interface MercadoPagoInstance {
  createCardToken(params: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }): Promise<{ id: string; [key: string]: unknown }>;

  getInstallments(params: {
    amount: string;
    bin: string;
    paymentTypeId?: string;
  }): Promise<Array<{
    payment_method_id: string;
    payment_type_id: string;
    payer_costs: PayerCost[];
  }>>;

  getPaymentMethods(params: { bin: string }): Promise<{
    results: Array<{
      id: string;
      name: string;
      thumbnail: string;
      payment_type_id?: string;
      additional_info_needed?: string[];
      issuer?: { id: number };
    }>;
  }>;

  getIssuers(params: {
    paymentMethodId: string;
    bin: string;
  }): Promise<Array<{ id: number; name: string }>>;
}

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

export type { PayerCost };
