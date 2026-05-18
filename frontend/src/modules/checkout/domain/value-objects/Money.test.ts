import { describe, it, expect } from 'vitest';
import { Money } from './Money';
import { ValidationError } from '../../../shared/errors/AppError';

describe('Money.of', () => {
  it('crea instancia válida', () => {
    const m = Money.of(100);
    expect(m.value).toBe(100);
    expect(m.currency).toBe('MXN');
    expect(m.toFixed()).toBe('100.00');
  });

  it('lanza error si monto es menor al mínimo', () => {
    expect(() => Money.of(9)).toThrow(ValidationError);
  });

  it('acepta exactamente el mínimo', () => {
    expect(Money.of(10).value).toBe(10);
  });

  it('lanza error si monto excede el máximo', () => {
    expect(() => Money.of(1_000_000)).toThrow(ValidationError);
  });

  it('lanza error si NaN', () => {
    expect(() => Money.of(NaN)).toThrow(ValidationError);
  });
});

describe('Money.fromString', () => {
  it('parsea string correctamente', () => {
    expect(Money.fromString('250.50').toFixed()).toBe('250.50');
  });
});

describe('Money.equals', () => {
  it('compara dos instancias', () => {
    expect(Money.of(100).equals(Money.of(100))).toBe(true);
    expect(Money.of(100).equals(Money.of(200))).toBe(false);
  });
});
