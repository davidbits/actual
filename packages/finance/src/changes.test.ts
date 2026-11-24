import { expect, it } from 'vitest';

import { portfolioChanges } from './changes';
import { emptyPortfolio } from './types';
import type { Collection, Portfolio } from './types';

const at = Date.parse('2026-01-02T12:00:00Z');
const before = at - 86400000;
const collection = (timestamp: number): Collection => ({
  timestamp,
  accounts: [{ id: 'spot', name: 'Spot', product: 'spot' }],
  holdings: [
    { accountId: 'spot', asset: 'BTC', quantity: '0.000000000000000001' },
  ],
  positions: [],
  events: [],
  coverage: [{ stream: 'balances', status: 'ok' }],
  cursors: {},
});
function portfolio(): Portfolio {
  return {
    ...emptyPortfolio(),
    updatedAt: at,
    connections: [
      {
        id: 'one',
        provider: 'fixture',
        name: 'Synthetic',
        enabled: true,
        intervalMinutes: 15,
        historyStart: '2020-01-01',
        symbols: [],
      },
    ],
    collections: { one: collection(at) },
    comparison: { at: before, collections: { one: collection(before) } },
    prices: [
      {
        asset: 'BTC',
        quote: 'ZAR',
        price: '10',
        timestamp: before,
        source: 'fixture',
      },
      {
        asset: 'BTC',
        quote: 'ZAR',
        price: '20',
        timestamp: at,
        source: 'fixture',
      },
      {
        asset: 'BTC',
        quote: 'ZAR',
        price: '1000',
        timestamp: at + 1,
        source: 'future must be ignored',
      },
    ],
  };
}

it('keeps precision and separates rate changes from quantity changes without using future rates', () => {
  const rows = portfolioChanges(portfolio(), at);
  expect(rows[0]).toMatchObject({
    quantityChange: '0',
    rateChange: '10',
    valueChange: '0.00000000000000001',
  });
});

it('does not invent a zero baseline or value when snapshots or prices are missing', () => {
  const p = portfolio();
  delete p.comparison;
  expect(portfolioChanges(p, at)[0]).toMatchObject({
    before: { net: null, value: null },
    quantityChange: null,
    valueChange: null,
  });
  p.prices = [];
  expect(portfolioChanges(p, at)[0].after.value).toBeNull();
});

it('includes exited assets and nets liabilities across streams within the same account', () => {
  const p = portfolio();
  p.collections.one.holdings = [];
  expect(portfolioChanges(p, at)[0]).toMatchObject({
    after: { net: '0', value: '0' },
    valueChange: '-0.00000000000000001',
  });
  p.collections.one.holdings = [
    {
      accountId: 'spot',
      asset: 'BTC',
      quantity: '3',
      debt: '1',
      unrealizedPnl: '-0.5',
    },
    { accountId: 'spot', asset: 'BTC', quantity: '2' },
    { accountId: 'margin', asset: 'BTC', quantity: '1' },
  ];
  const rows = portfolioChanges(p, at);
  expect(rows).toHaveLength(2);
  expect(rows[0].after).toMatchObject({ net: '3.5', value: '70' });
});

it('flags retained stale and incomplete observations instead of reporting fresh data', () => {
  const p = portfolio();
  p.collections.one.holdings[0].observedAt = before - 1;
  p.collections.one.coverage = [{ stream: 'balances', status: 'error' }];
  expect(portfolioChanges(p, at)[0].after).toMatchObject({
    stale: true,
    incomplete: true,
  });
  p.collections.one.holdings = [];
  expect(portfolioChanges(p, at)[0]).toMatchObject({
    after: { net: null, value: null },
    valueChange: null,
  });
});
