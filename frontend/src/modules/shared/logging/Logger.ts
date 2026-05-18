export interface ILogger {
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

const noop = () => {};

// Only emit logs in development. In production the console stays silent
// to avoid leaking payment context (amounts, emails, error detail) to DevTools.
const isDev = import.meta.env.DEV;

export const logger: ILogger = {
  info: isDev ? (event, data) => console.info(`[INFO] ${event}`, data ?? {}) : noop,
  warn: isDev ? (event, data) => console.warn(`[WARN] ${event}`, data ?? {}) : noop,
  error: isDev ? (event, data) => console.error(`[ERROR] ${event}`, data ?? {}) : noop,
};
