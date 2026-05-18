const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

export class WebhookSignatureValidator {
  static async validate(
    xSignature: string,
    xRequestId: string,
    dataId: string,
    secret: string,
  ): Promise<boolean> {
    const parts = xSignature.split(',');
    const ts = parts.find((p) => p.startsWith('ts='))?.slice(3);
    const v1 = parts.find((p) => p.startsWith('v1='))?.slice(3);
    if (!ts || !v1) return false;

    // Anti-replay: reject if timestamp is outside the tolerance window
    const tsNum = parseInt(ts, 10);
    if (isNaN(tsNum)) return false;
    const ageSecs = Math.abs(Date.now() / 1000 - tsNum);
    if (ageSecs > TIMESTAMP_TOLERANCE_SECONDS) return false;

    const message = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return constantTimeEqual(expected, v1);
  }
}

// Prevents timing-based attacks on HMAC comparison
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
