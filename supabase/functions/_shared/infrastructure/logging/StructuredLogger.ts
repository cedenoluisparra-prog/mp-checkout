import { ILogger } from '../../domain/interfaces/ILogger.ts';

export class StructuredLogger implements ILogger {
  constructor(private readonly correlationId: string) {}

  info(event: string, data?: Record<string, unknown>): void {
    this.log('info', event, data);
  }

  warn(event: string, data?: Record<string, unknown>): void {
    this.log('warn', event, data);
  }

  error(event: string, data?: Record<string, unknown>): void {
    this.log('error', event, data);
  }

  private log(level: string, event: string, data?: Record<string, unknown>): void {
    console.log(JSON.stringify({
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      level,
      event,
      ...(data ? { data } : {}),
    }));
  }
}
