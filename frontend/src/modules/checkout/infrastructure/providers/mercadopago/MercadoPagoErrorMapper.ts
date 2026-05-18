const SDK_ERROR_CODES: Record<string, string> = {
  '205': 'Ingresa el nombre del titular',
  '208': 'Mes de vencimiento inválido',
  '209': 'Año de vencimiento inválido',
  '212': 'Tipo de documento inválido',
  '214': 'Número de documento inválido',
  '221': 'Ingresa el nombre del titular',
  '224': 'CVV inválido',
  'E301': 'Número de tarjeta inválido',
  'E302': 'CVV inválido',
  '316': 'Nombre del titular inválido',
  '325': 'Mes de vencimiento inválido',
  '326': 'Año de vencimiento inválido',
};

export function mapSdkError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (Array.isArray(e.cause) && e.cause.length > 0) {
      const c = e.cause[0] as Record<string, unknown>;
      const code = String(c.code ?? '');
      const desc = String(c.description ?? '');
      return SDK_ERROR_CODES[code] ?? (desc || 'Error de tokenización');
    }
    return String(e.message ?? e.error ?? 'Error desconocido');
  }
  return 'Error desconocido';
}

export function mapApiError(data: Record<string, unknown>): string {
  return String(data.message ?? 'Error al procesar el pago');
}
