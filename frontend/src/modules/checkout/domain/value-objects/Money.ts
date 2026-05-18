import { ValidationError } from '../../../shared/errors/AppError';

const MIN = 10;
const MAX = 999_999;

export class Money {
  private constructor(private readonly _amount: number, readonly currency: string = 'MXN') {}

  static of(amount: number, currency = 'MXN'): Money {
    if (isNaN(amount) || !isFinite(amount)) throw new ValidationError('El monto no es un número válido');
    if (amount < MIN) throw new ValidationError(`El monto mínimo es $${MIN} ${currency}`);
    if (amount >= MAX) throw new ValidationError(`El monto máximo es $${MAX.toLocaleString()} ${currency}`);
    return new Money(amount, currency);
  }

  static fromString(raw: string, currency = 'MXN'): Money {
    const parsed = parseFloat(raw.replace(/,/g, ''));
    return Money.of(parsed, currency);
  }

  get value(): number { return this._amount; }

  toFixed(): string { return this._amount.toFixed(2); }

  toLocaleString(): string {
    return this._amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  equals(other: Money): boolean {
    return this._amount === other._amount && this.currency === other.currency;
  }
}
