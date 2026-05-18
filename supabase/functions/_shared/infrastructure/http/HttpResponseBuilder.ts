const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Permissions-Policy': 'payment=()',
};

export class HttpResponseBuilder {
  static ok(data: unknown, corsHeaders: Record<string, string>): Response {
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }

  static error(
    message: string,
    status: number,
    corsHeaders: Record<string, string>,
    extra?: Record<string, unknown>,
  ): Response {
    return new Response(JSON.stringify({ message, ...extra }), {
      status,
      headers: {
        ...corsHeaders,
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }

  static unauthorized(corsHeaders: Record<string, string>): Response {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        ...corsHeaders,
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }
}
