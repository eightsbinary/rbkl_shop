import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return key;
}

function digest(input: string): string {
  return createHmac('sha256', secret()).update(input).digest('base64url');
}

/** HMAC-sign a token bound to (orderId, email). Email is lowercased. */
export function signOrderToken(orderId: string, email: string): string {
  const payload = `${orderId}|${email.toLowerCase()}`;
  return `${Buffer.from(payload).toString('base64url')}.${digest(payload)}`;
}

export function verifyOrderToken(token: string, orderId: string, email: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return false;
  let payload: string;
  try {
    payload = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return false;
  }
  const [tokenOrderId, tokenEmail] = payload.split('|');
  if (tokenOrderId !== orderId) return false;
  if (tokenEmail !== email.toLowerCase()) return false;
  const expected = digest(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
