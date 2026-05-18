import { AppConfig } from '../_shared/infrastructure/config/AppConfig.ts';
import { StructuredLogger } from '../_shared/infrastructure/logging/StructuredLogger.ts';
import { MercadoPagoGateway } from '../_shared/infrastructure/gateways/mercadopago/MercadoPagoGateway.ts';
import { SupabasePaymentRepository } from '../_shared/infrastructure/repositories/SupabasePaymentRepository.ts';
import { CreatePaymentUseCase } from '../_shared/application/use-cases/CreatePaymentUseCase.ts';
import { CreatePaymentDTO } from '../_shared/application/dtos/CreatePaymentDTO.ts';
import { CorsMiddleware } from '../_shared/presentation/CorsMiddleware.ts';
import { ErrorHandler } from '../_shared/presentation/ErrorHandler.ts';
import { HttpResponseBuilder } from '../_shared/infrastructure/http/HttpResponseBuilder.ts';

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

let kv: Deno.Kv | null = null;
try { kv = await Deno.openKv(); } catch { /* rate limiting disabled if KV unavailable */ }

async function isRateLimited(ip: string): Promise<boolean> {
  if (!kv) return false;
  const now = Date.now();
  const key = ['rl', ip];
  const entry = await kv.get<number[]>(key);
  const timestamps = (entry.value ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  await kv.set(key, timestamps, { expireIn: RATE_WINDOW_MS });
  return false;
}

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
    logger.warn('rate_limit.exceeded', { ip });
    return HttpResponseBuilder.error('Demasiadas solicitudes. Intenta en un minuto.', 429, {
      ...cors,
      'Retry-After': '60',
    });
  }

  if (!req.headers.get('content-type')?.includes('application/json')) {
    return HttpResponseBuilder.error('Content-Type debe ser application/json', 400, cors);
  }

  try {
    const body = await req.json() as Record<string, unknown>;
    const dto = CreatePaymentDTO.fromRequest(body);

    const gateway = new MercadoPagoGateway(config, logger);
    const repository = new SupabasePaymentRepository(config, logger);
    const useCase = new CreatePaymentUseCase(gateway, repository, logger);
    const result = await useCase.execute(dto);

    return HttpResponseBuilder.ok(result, cors);
  } catch (err) {
    return ErrorHandler.handle(err, cors, logger);
  }
});
