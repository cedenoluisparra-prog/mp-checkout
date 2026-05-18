import { ILogger } from '../domain/interfaces/ILogger.ts';
import { DomainError } from '../domain/errors/DomainError.ts';
import { ValidationError } from '../domain/errors/ValidationError.ts';
import { PaymentError } from '../domain/errors/PaymentError.ts';
import { HttpResponseBuilder } from '../infrastructure/http/HttpResponseBuilder.ts';

export class ErrorHandler {
  static handle(
    err: unknown,
    corsHeaders: Record<string, string>,
    logger: ILogger,
  ): Response {
    if (err instanceof ValidationError) {
      logger.warn('request.validation.failed', { message: err.message });
      return HttpResponseBuilder.error(err.message, 400, corsHeaders);
    }

    if (err instanceof PaymentError) {
      logger.warn('payment.error', { code: err.code, message: err.message });
      return HttpResponseBuilder.error(err.message, 422, corsHeaders, { code: err.code });
    }

    if (err instanceof DomainError) {
      logger.error('domain.error', { code: err.code, message: err.message });
      return HttpResponseBuilder.error(err.message, 400, corsHeaders);
    }

    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    logger.error('unexpected.error', { message });
    return HttpResponseBuilder.error('Error interno del servidor', 500, corsHeaders);
  }
}
