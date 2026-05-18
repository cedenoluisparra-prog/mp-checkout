import { AppConfig } from '../_shared/infrastructure/config/AppConfig.ts';
import { StructuredLogger } from '../_shared/infrastructure/logging/StructuredLogger.ts';
import { MercadoPagoGateway } from '../_shared/infrastructure/gateways/mercadopago/MercadoPagoGateway.ts';
import { SupabasePaymentRepository } from '../_shared/infrastructure/repositories/SupabasePaymentRepository.ts';
import { ProcessWebhookUseCase } from '../_shared/application/use-cases/ProcessWebhookUseCase.ts';
import { WebhookEventDTO } from '../_shared/application/dtos/WebhookEventDTO.ts';
import { WebhookSignatureValidator } from '../_shared/infrastructure/http/WebhookSignatureValidator.ts';
import { CorsMiddleware } from '../_shared/presentation/CorsMiddleware.ts';
import { HttpResponseBuilder } from '../_shared/infrastructure/http/HttpResponseBuilder.ts';
import { ValidationError } from '../_shared/domain/errors/ValidationError.ts';

const WEBHOOK_RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

let kv: Deno.Kv | null = null;
try { kv = await Deno.openKv(); } catch { /* rate limiting disabled if KV unavailable */ }

async function isRateLimited(ip: string): Promise<boolean> {
  if (!kv) return false;
  const now = Date.now();
  const key = ['rl_webhook', ip];
  const entry = await kv.get<number[]>(key);
  const timestamps = (entry.value ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= WEBHOOK_RATE_LIMIT) return true;
  timestamps.push(now);
  await kv.set(key, timestamps, { expireIn: RATE_WINDOW_MS });
  return false;
}

// Always return 200 to Mercado Pago — retries on non-2xx responses
const ack = (cors: Record<string, string>) =>
  HttpResponseBuilder.ok({ received: true }, cors);

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const logger = new StructuredLogger(correlationId);
  const config = AppConfig.fromEnv();
  const cors = CorsMiddleware.headers(config.allowedOrigin);

  if (req.method === 'OPTIONS') return CorsMiddleware.preflight(config.allowedOrigin);

  if (req.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: { ...cors, Allow: 'POST, OPTIONS' },
    });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';

  if (await isRateLimited(ip)) {
    logger.warn('webhook.rate_limited', { ip });
    return ack(cors); // Ack to prevent MP retry storm even when rate limited
  }

  const xSignature = req.headers.get('x-signature') ?? '';
  const xRequestId = req.headers.get('x-request-id') ?? '';

  if (!config.mpWebhookSecret) {
    logger.error('webhook.misconfigured', { reason: 'MP_WEBHOOK_SECRET not set' });
    return HttpResponseBuilder.error('Webhook not configured', 500, cors);
  }

  if (!xSignature) {
    logger.warn('webhook.rejected.no_signature', { requestId: xRequestId });
    return HttpResponseBuilder.unauthorized(cors);
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    let event;
    try {
      event = WebhookEventDTO.fromRequest(body, xSignature, xRequestId);
    } catch (e) {
      if (e instanceof ValidationError) {
        logger.info('webhook.ignored', { reason: e.message });
        return ack(cors);
      }
      throw e;
    }

    // Always validate HMAC — secret is guaranteed non-empty by AppConfig.
    // Includes anti-replay: rejects if ts is outside ±5 minute window.
    const valid = await WebhookSignatureValidator.validate(
      xSignature,
      xRequestId,
      event.resourceId,
      config.mpWebhookSecret,
    );
    if (!valid) {
      logger.warn('webhook.rejected.invalid_signature', { requestId: xRequestId });
      return HttpResponseBuilder.unauthorized(cors);
    }

    const gateway = new MercadoPagoGateway(config, logger);
    const repository = new SupabasePaymentRepository(config, logger);
    const useCase = new ProcessWebhookUseCase(gateway, repository, logger);
    await useCase.execute(event);

    return ack(cors);
  } catch (err) {
    // Log internally, always ack to prevent MP retry storms
    logger.error('webhook.error', {
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    return ack(cors);
  }
});
