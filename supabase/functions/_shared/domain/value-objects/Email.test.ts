import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { Email } from './Email.ts';
import { ValidationError } from '../errors/ValidationError.ts';

Deno.test('Email.of - crea instancia válida', () => {
  const e = Email.of('Usuario@Ejemplo.COM');
  assertEquals(e.value, 'usuario@ejemplo.com');
});

Deno.test('Email.of - lanza error con email inválido', () => {
  assertThrows(() => Email.of('no-es-email'), ValidationError);
});

Deno.test('Email.of - lanza error con email sin dominio', () => {
  assertThrows(() => Email.of('user@'), ValidationError);
});

Deno.test('Email.of - lanza error con string vacío', () => {
  assertThrows(() => Email.of(''), ValidationError);
});

Deno.test('Email.toString - devuelve el valor', () => {
  assertEquals(Email.of('a@b.com').toString(), 'a@b.com');
});
