import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { Money } from './Money.ts';
import { ValidationError } from '../errors/ValidationError.ts';

Deno.test('Money.of - crea instancia válida', () => {
  const m = Money.of(100);
  assertEquals(m.value, 100);
  assertEquals(m.currency, 'MXN');
  assertEquals(m.toFixed(), '100.00');
});

Deno.test('Money.of - lanza error si monto es menor al mínimo', () => {
  assertThrows(() => Money.of(9), ValidationError, 'mínimo');
});

Deno.test('Money.of - acepta exactamente el mínimo', () => {
  const m = Money.of(10);
  assertEquals(m.value, 10);
});

Deno.test('Money.of - lanza error si monto excede el máximo', () => {
  assertThrows(() => Money.of(1_000_000), ValidationError, 'máximo');
});

Deno.test('Money.of - lanza error si NaN', () => {
  assertThrows(() => Money.of(NaN), ValidationError);
});

Deno.test('Money.fromString - parsea string correctamente', () => {
  const m = Money.fromString('250.50');
  assertEquals(m.toFixed(), '250.50');
});

Deno.test('Money.equals - compara dos instancias', () => {
  assertEquals(Money.of(100).equals(Money.of(100)), true);
  assertEquals(Money.of(100).equals(Money.of(200)), false);
});
