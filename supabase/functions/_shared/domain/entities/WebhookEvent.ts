export type WebhookType = 'payment' | 'order';

export class WebhookEvent {
  constructor(
    readonly type: WebhookType,
    readonly resourceId: string,
    readonly xSignature: string,
    readonly xRequestId: string,
  ) {}
}
