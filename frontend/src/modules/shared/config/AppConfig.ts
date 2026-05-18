export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  mpPublicKey: string;
}

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const appConfig: AppConfig = {
  supabaseUrl: requireEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('VITE_SUPABASE_ANON_KEY'),
  mpPublicKey: requireEnv('VITE_MP_PUBLIC_KEY'),
};
