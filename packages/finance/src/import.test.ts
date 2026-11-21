import { expect, it } from 'vitest';

import { parseFinanceImport } from './import';

const archive = {
  version: 1,
  collection: {
    timestamp: 100,
    accounts: [{ id: 'a', name: 'Synthetic', product: 'spot' }],
    holdings: [{ accountId: 'a', asset: 'BTC', quantity: '0.00000001' }],
    events: [
      {
        id: 'e',
        accountId: 'a',
        timestamp: 99,
        stream: 'ledger',
        type: 'deposit',
        status: 'booked',
        postings: [{ asset: 'BTC', quantity: '0.00000001', role: 'principal' }],
      },
    ],
    positions: [],
  },
  prices: [],
};

it('validates precise archive values and rejects unknown accounts and duplicate IDs', () => {
  expect(parseFinanceImport(archive).collection.holdings[0].quantity).toBe(
    '0.00000001',
  );
  expect(() =>
    parseFinanceImport({
      ...archive,
      collection: { ...archive.collection, accounts: [] },
    }),
  ).toThrow('Unknown');
  expect(() =>
    parseFinanceImport({
      ...archive,
      collection: {
        ...archive.collection,
        events: [archive.collection.events[0], archive.collection.events[0]],
      },
    }),
  ).toThrow('Duplicate');
  expect(() =>
    parseFinanceImport({
      ...archive,
      collection: {
        ...archive.collection,
        holdings: [{ accountId: 'a', asset: 'BTC', quantity: 0.01 }],
      },
    }),
  ).toThrow('strings');
});

it('round-trips position checkpoints instead of dropping derivative state', () => {
  const position = {
    id: 'p',
    accountId: 'a',
    symbol: 'BTCUSDT',
    quantity: '0.01',
    settlementAsset: 'USDT',
    entryPrice: '50000',
    markPrice: '51000',
    unrealizedPnl: '10',
    side: 'long',
  };
  expect(
    parseFinanceImport({
      ...archive,
      collection: { ...archive.collection, positions: [position] },
    }).collection.positions,
  ).toEqual([position]);
  expect(() =>
    parseFinanceImport({
      ...archive,
      collection: {
        ...archive.collection,
        positions: [{ ...position, accountId: 'missing' }],
      },
    }),
  ).toThrow('Unknown');
  const holding = {
    ...archive.collection.holdings[0],
    debt: '0.01',
    unrealizedPnl: '-0.001',
    available: '0',
    observedAt: 100,
  };
  expect(
    parseFinanceImport({
      ...archive,
      collection: { ...archive.collection, holdings: [holding] },
    }).collection.holdings,
  ).toEqual([holding]);
});
