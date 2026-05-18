import { describe, it, expect } from 'vitest';
import { CardNumber } from './CardNumber';
import { ValidationError } from '../../../shared/errors/AppError';

describe('CardNumber.of', () => {
  it('acepta número de 16 dígitos', () => {
    const c = CardNumber.of('4111111111111111');
    expect(c.raw).toBe('4111111111111111');
    expect(c.bin).toBe('411111');
  });

  it('acepta número con espacios', () => {
    const c = CardNumber.of('4111 1111 1111 1111');
    expect(c.raw).toBe('4111111111111111');
  });

  it('formatea con espacios', () => {
    const c = CardNumber.of('4111111111111111');
    expect(c.formatted).toBe('4111 1111 1111 1111');
  });

  it('lanza error si menos de 13 dígitos', () => {
    expect(() => CardNumber.of('123456789012')).toThrow(ValidationError);
  });

  it('lanza error si más de 19 dígitos', () => {
    expect(() => CardNumber.of('12345678901234567890')).toThrow(ValidationError);
  });
});
