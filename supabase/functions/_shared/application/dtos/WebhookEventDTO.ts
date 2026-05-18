import { WebhookEvent, WebhookType } from '../../domain/entities/WebhookEvent.ts';
import { ValidationError } from '../../domain/errors/ValidationError.ts';

export class WebhookEventDTO {
  static fromRequest(
    body: Record<string, unknown>,
    xSignature: string,
    xRequestId: string,
  ): WebhookEvent {
    const type = String(body.type ?? '');
    if (type !== 'payment' && type !== 'order') {
      throw new ValidationError(`Tipo de webhook no soportado: ${type}`);
    }
    const resourceId = String((body.data as Record<string, unknown>)?.id ?? '');
    if (!resourceId) {
      throw new ValidationError('El ID del recurso es requerido');
    }
    return new WebhookEvent(type as WebhookType, resourceId, xSignature, xRequestId);
  }
}
