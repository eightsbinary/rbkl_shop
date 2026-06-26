// Non-enumerable order numbers: Crockford base32 (no I/L/O/U) payload + 2 check chars.
// Payload length 10 → 32^10 ≈ 10^15 combinations. Two check digits catch
// single-char swaps and most two-char transpositions.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PAYLOAD_LEN = 10;

function checkChar(input: string): string {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const v = ALPHABET.indexOf(input[i] ?? '');
    if (v < 0) throw new Error(`Invalid Crockford char: ${input[i]}`);
    sum = (sum + v * (i + 1)) % ALPHABET.length;
  }
  return ALPHABET[sum] ?? '0';
}

export function generateOrderNumber(): string {
  let payload = '';
  for (let i = 0; i < PAYLOAD_LEN; i++) {
    payload += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  const c1 = checkChar(payload);
  const c2 = checkChar(payload + c1);
  return `${payload}${c1}${c2}`;
}

export function isValidOrderNumber(input: string): boolean {
  if (!/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/.test(input)) return false;
  const payload = input.slice(0, PAYLOAD_LEN);
  const d1 = input[PAYLOAD_LEN];
  const d2 = input[PAYLOAD_LEN + 1];
  const expected1 = checkChar(payload);
  if (d1 !== expected1) return false;
  const expected2 = checkChar(payload + expected1);
  return d2 === expected2;
}
