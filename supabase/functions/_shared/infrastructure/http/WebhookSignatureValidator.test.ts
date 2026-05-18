import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { WebhookSignatureValidator } from './WebhookSignatureValidator.ts';

const SECRET = 'test-webhook-secret';
const DATA_ID = 'data-123';
const REQUEST_ID = 'req-456';

async function buildSignature(ts: number): Promise<string> {
  const message = `id:${DATA_ID};request-id:${REQUEST_ID};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `ts=${ts},v1=${hex}`;
}

Deno.test('WebhookSignatureValidator - acepta firma válida reciente', async () => {
  const ts = Math.floor(Date.now() / 1000);
  const xSig = await buildSignature(ts);
  const result = await WebhookSignatureValidator.validate(xSig, REQUEST_ID, DATA_ID, SECRET);
  assertEquals(result, true);
});

Deno.test('WebhookSignatureValidator - rechaza timestamp vencido (>5 min)', async () => {
  const ts = Math.floor(Date.now() / 1000) - 400; // 400s ago, exceeds 300s window
  const xSig = await buildSignature(ts);
  const result = await WebhookSignatureValidator.validate(xSig, REQUEST_ID, DATA_ID, SECRET);
  assertEquals(result, false);
});

Deno.test('WebhookSignatureValidator - rechaza firma HMAC incorrecta', async () => {
  const ts = Math.floor(Date.now() / 1000);
  const badSig = `ts=${ts},v1=${'aa'.repeat(32)}`;
  const result = await WebhookSignatureValidator.validate(badSig, REQUEST_ID, DATA_ID, SECRET);
  assertEquals(result, false);
});

Deno.test('WebhookSignatureValidator - rechaza header malformado sin ts= ni v1=', async () => {
  const result = await WebhookSignatureValidator.validate('invalid-header', REQUEST_ID, DATA_ID, SECRET);
  assertEquals(result, false);
});

Deno.test('WebhookSignatureValidator - rechaza timestamp no numérico', async () => {
  const result = await WebhookSignatureValidator.validate(
    'ts=notanumber,v1=aabbcc',
    REQUEST_ID,
    DATA_ID,
    SECRET,
  );
  assertEquals(result, false);
});
