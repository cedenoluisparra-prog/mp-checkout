import { ValidationError } from '../errors/ValidationError.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      throw new ValidationError('El correo electrónico no es válido');
    }
    return new Email(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
