import { ValidationError } from '../../../shared/errors/AppError';

export class CardNumber {
  private constructor(readonly raw: string) {}

  static of(input: string): CardNumber {
    const digits = input.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      throw new ValidationError('Número de tarjeta inválido');
    }
    if (!luhn(digits)) {
      throw new ValidationError('Número de tarjeta inválido');
    }
    return new CardNumber(digits);
  }

  get formatted(): string {
    return this.raw.replace(/(.{4})/g, '$1 ').trim();
  }

  get bin(): string { return this.raw.slice(0, 6); }

  toString(): string { return this.raw; }
}

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}
