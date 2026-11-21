import Decimal from 'decimal.js';

// Independent constructor: other packages cannot change accounting precision.
export const Exact = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export function quantity(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Invalid decimal');
  }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('Decimal values must be supplied as strings');
  }
  const text = String(value);
  if (
    text.length > 160 ||
    !/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d{1,3})?$/.test(text)
  ) {
    throw new Error('Invalid decimal');
  }
  const number = new Exact(text);
  if (!number.isFinite() || number.e > 100 || number.e < -100) {
    throw new Error('Decimal out of range');
  }
  return number.isZero() ? '0' : number.toFixed();
}

export function add(...values: string[]): string {
  return values
    .reduce((sum, value) => sum.plus(quantity(value)), new Exact(0))
    .toFixed();
}

export function negate(value: string): string {
  return new Exact(quantity(value)).negated().toFixed();
}

/** Only reporting projections use Actual's integer hundredths. */
export function toCents(value: string): number {
  const cents = new Exact(quantity(value)).times(100).toDecimalPlaces(0);
  if (cents.abs().greaterThan(2 ** 51 - 1)) {
    throw new Error('Amount exceeds Actual range');
  }
  return cents.toNumber();
}
