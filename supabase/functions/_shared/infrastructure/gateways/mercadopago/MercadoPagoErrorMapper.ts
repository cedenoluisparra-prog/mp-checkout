const STATUS_MESSAGES: Record<string, string> = {
  insufficient_amount: 'Fondos insuficientes',
  bad_filled_security_code: 'CVV inválido',
  bad_filled_card_data: 'Error en los datos de la tarjeta',
  bad_filled_date: 'Fecha de vencimiento incorrecta',
  bad_filled_other: 'Error en los datos de la tarjeta',
  other_reason: 'Pago rechazado por el banco',
  rejected_by_issuer: 'Pago rechazado por el banco emisor',
  call_for_authorize: 'Llama a tu banco para autorizar el pago',
  card_disabled: 'Tarjeta deshabilitada',
  duplicated_payment: 'Pago duplicado',
  high_risk: 'Pago rechazado por riesgo',
  invalid_transaction_amount: 'El monto está fuera del rango permitido',
  cc_rejected_insufficient_amount: 'Fondos insuficientes',
  cc_rejected_bad_filled_security_code: 'CVV inválido',
  cc_rejected_bad_filled_date: 'Fecha de vencimiento incorrecta',
  cc_rejected_other_reason: 'Pago rechazado por el banco',
};

export class MercadoPagoErrorMapper {
  static toMessage(apiResponse: Record<string, unknown>): string {
    const detailRaw = String(
      (apiResponse?.errors as Array<Record<string, unknown>>)?.[0]?.details?.[0] ?? '',
    );
    const statusDetail = detailRaw.includes(':')
      ? detailRaw.split(':').pop()?.trim() ?? ''
      : '';
    const apiCode = String(
      (apiResponse?.errors as Array<Record<string, unknown>>)?.[0]?.code ?? '',
    );
    const apiMessage = String(
      (apiResponse?.errors as Array<Record<string, unknown>>)?.[0]?.message ?? '',
    );

    return (
      (statusDetail && STATUS_MESSAGES[statusDetail]) ||
      (apiCode && STATUS_MESSAGES[apiCode]) ||
      apiMessage ||
      'Error al procesar el pago'
    );
  }

  static extractStatusDetail(apiResponse: Record<string, unknown>): string {
    const detailRaw = String(
      (apiResponse?.errors as Array<Record<string, unknown>>)?.[0]?.details?.[0] ?? '',
    );
    return detailRaw.includes(':') ? detailRaw.split(':').pop()?.trim() ?? '' : '';
  }
}
