import { quantity } from '#decimal';

/** Preserve JSON numeric lexemes, including IDs beyond Number.MAX_SAFE_INTEGER. */
export function parseExactJson(text: string): unknown {
  return JSON.parse(
    text.replace(
      /"(?:[^"\\]|\\.)*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (token, number: string | undefined) =>
        number === undefined ? token : JSON.stringify(number),
    ),
  );
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Unexpected provider object');
  }
  return value as Record<string, unknown>;
}

export function array(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Unexpected provider list');
  return value.map(object);
}

export function string(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }
  throw new Error('Missing provider field');
}

export function amount(value: unknown, fallback?: string): string {
  return quantity(
    value === undefined || value === null || value === '' ? fallback : value,
  );
}

export function timestamp(value: unknown): number {
  const n = Number(string(value));
  const parsed = Number.isFinite(n) ? n : Date.parse(string(value));
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Invalid provider timestamp');
  }
  return parsed;
}

export function asset(value: unknown): string {
  const code = string(value);
  if (!/^[^\p{C}\s/\\]{1,80}$/u.test(code)) {
    throw new Error('Invalid asset identifier');
  }
  return code === 'XBT' ? 'BTC' : code.toUpperCase();
}
