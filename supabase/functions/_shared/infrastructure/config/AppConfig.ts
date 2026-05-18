function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export class AppConfig {
  private constructor(
    readonly mpAccessToken: string,
    readonly allowedOrigin: string,
    readonly mpWebhookSecret: string,
    readonly supabaseUrl: string,
    readonly supabaseServiceRoleKey: string,
  ) {}

  static fromEnv(): AppConfig {
    return new AppConfig(
      requireEnv('MP_ACCESS_TOKEN'),
      requireEnv('ALLOWED_ORIGIN'),
      Deno.env.get('MP_WEBHOOK_SECRET') ?? '',  // validated at webhook runtime, not required by create-payment
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }
}
