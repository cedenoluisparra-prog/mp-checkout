import { ValidationError } from '../errors/ValidationError.ts';

const MIN_AMOUNT = 10;
const MAX_AMOUNT = 999_999;

export class Money {
  private constructor(
    private readonly _amount: number,
    readonly currency: string = 'MXN',
  ) {}

  static of(amount: number, currency = 'MXN'): Money {
    if (isNaN(amount) || !isFinite(amount)) {
      throw new ValidationError('El monto debe ser un número válido');
    }
    if (amount < MIN_AMOUNT) {
      throw new ValidationError(`El monto mínimo es $${MIN_AMOUNT} ${currency}`);
    }
    if (amount > MAX_AMOUNT) {
      throw new ValidationError(`El monto máximo es $${MAX_AMOUNT} ${currency}`);
    }
    return new Money(amount, currency);
  }

  static fromString(raw: string, currency = 'MXN'): Money {
    return Money.of(parseFloat(raw), currency);
  }

  toFixed(): string {
    return this._amount.toFixed(2);
  }

  get value(): number {
    return this._amount;
  }

  equals(other: Money): boolean {
    return this._amount === other._amount && this.currency === other.currency;
  }
}
