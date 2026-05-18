export class CorsMiddleware {
  static headers(origin: string): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, content-type, x-signature, x-request-id',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
  }

  static preflight(origin: string): Response {
    return new Response('ok', { headers: CorsMiddleware.headers(origin) });
  }
}
