import { ValidationError } from '../../../shared/errors/AppError';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!normalized || !EMAIL_RE.test(normalized)) {
      throw new ValidationError('Correo electrónico inválido');
    }
    return new Email(normalized);
  }

  toString(): string { return this.value; }
}
