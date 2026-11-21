import { describe, expect, it } from 'vitest';

import { add, quantity, toCents } from './decimal';
import type { Collection } from './types';
import { historicalHoldings, selectPrice, valueHoldings } from './valuation';

describe('exact portfolio accounting', () => {
  it('preserves fractional rewards and integers above JS precision', () => {
    expect(add('9007199254740993', '0.000000000000000001')).toBe(
      '9007199254740993.000000000000000001',
    );
    expect(quantity('1e-18')).toBe('0.000000000000000001');
    expect(() => quantity(0.1)).toThrow();
    expect(() => quantity('Infinity')).toThrow();
    expect(() => quantity('1e999')).toThrow();
  });
  it('rounds cents only at the reporting boundary', () => {
    expect(toCents('14814.8136')).toBe(1481481);
    expect(toCents('0.005')).toBe(0);
    expect(() => toCents('9007199254740993')).toThrow();
  });
  it('nets debt, includes unrealized settlement P&L once and leaves missing prices unknown', () => {
    const result = valueHoldings(
      [
        {
          accountId: 'margin',
          asset: 'USDT',
          quantity: '1100',
          debt: '1000',
          unrealizedPnl: '50',
        },
        { accountId: 'spot', asset: 'UNKNOWN', quantity: '1' },
      ],
      [
        {
          asset: 'USDT',
          quote: 'ZAR',
          price: '18.25',
          timestamp: 10,
          source: 'fixture',
        },
      ],
      20,
    );
    expect(result.total).toBe('2737.5');
    expect(result.unpriced).toBe(1);
    expect(result.values[1].value).toBeNull();
  });
  it('never uses a future price for historical valuation', () => {
    expect(
      selectPrice(
        [
          {
            asset: 'BTC',
            quote: 'ZAR',
            price: '20',
            timestamp: 21,
            source: 'fixture',
          },
        ],
        'BTC',
        'ZAR',
        20,
      ),
    ).toBeUndefined();
  });
  it('does not invent old holdings when there are no events and history is incomplete', () => {
    const collection: Collection = {
      timestamp: 100,
      accounts: [{ id: 'a', name: 'a', product: 'spot' }],
      holdings: [{ accountId: 'a', asset: 'BTC', quantity: '1' }],
      events: [],
      positions: [],
      coverage: [],
      cursors: {},
    };
    expect(() => historicalHoldings(collection, [], 50)).toThrow('Incomplete');
    collection.coverage.push({
      stream: 'deposits',
      accountId: 'a',
      status: 'ok',
      from: 0,
      through: 100,
    });
    expect(() => historicalHoldings(collection, [], 50)).toThrow('Incomplete');
    collection.coverage[0].balanceHistory = true;
    expect(historicalHoldings(collection, [], 50)[0].quantity).toBe('1');
    collection.accounts.push({
      id: 'sold',
      name: 'Empty wallet',
      product: 'spot',
    });
    expect(() => historicalHoldings(collection, [], 50)).toThrow('Incomplete');
  });
});
