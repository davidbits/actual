import { expect, it } from 'vitest';

import {
  buildPortfolioTimeline,
  TIMELINE_DAY,
  timelineStart,
} from './timeline';
import type { Collection, Price } from './types';

const time = (date: string) => Date.parse(date + 'T12:00:00+02:00');
const snapshot = (date: string, quantity = '2'): Collection => ({
  timestamp: time(date),
  accounts: [{ id: 'spot', name: 'Synthetic', product: 'spot' }],
  holdings: [{ accountId: 'spot', asset: 'BTC', quantity }],
  positions: [],
  events: [],
  coverage: [{ stream: 'balances', status: 'ok' }],
  cursors: {},
});
const quote = (date: string, price: string, asset = 'BTC'): Price => ({
  asset,
  quote: 'ZAR',
  price,
  timestamp: time(date),
  source: 'Synthetic',
});

it('values daily snapshots precisely, nets debt, and never uses future rates', () => {
  const first = snapshot('2026-01-01', '0.000000000000000001');
  const second = snapshot('2026-01-02', '3');
  second.holdings[0].debt = '1';
  second.holdings[0].unrealizedPnl = '-0.5';
  const at = time('2026-01-02');
  const result = buildPortfolioTimeline(
    { one: [first, second] },
    [
      quote('2026-01-01', '10'),
      quote('2026-01-02', '12'),
      quote('2026-01-03', '999'),
    ],
    timelineStart(at, 2),
    at,
  );
  expect(result.points.map(p => p.value)).toEqual([
    '0.00000000000000001',
    '18',
  ]);
  expect(result.points[1].assets.BTC).toMatchObject({
    quantity: '1.5',
    value: '18',
    price: { price: '12' },
  });
});

it('keeps days with no snapshots as gaps and marks partial connection/price coverage', () => {
  const at = time('2026-01-03');
  const first = snapshot('2026-01-01');
  first.holdings.push({ accountId: 'spot', asset: 'UNKNOWN', quantity: '4' });
  const result = buildPortfolioTimeline(
    { one: [first, snapshot('2026-01-03')], two: [] },
    [quote('2026-01-01', '10')],
    timelineStart(at, 3),
    at,
  );
  expect(result.points[0]).toMatchObject({
    value: '20',
    partial: true,
    observedConnections: 1,
    totalConnections: 2,
  });
  expect(result.points[0].assets.UNKNOWN.value).toBeNull();
  expect(result.points[1]).toMatchObject({
    value: null,
    observedConnections: 0,
  });
  expect(result.points[1].assets.BTC.quantity).toBeNull();
  expect(result.points[2].stale).toBe(true);
});

it('does not present unpriced wealth or failed empty balance responses as zero', () => {
  const at = time('2026-01-02');
  const failed = snapshot('2026-01-02');
  failed.holdings = [];
  failed.coverage = [{ stream: 'balances', status: 'error' }];
  const result = buildPortfolioTimeline(
    { one: [snapshot('2026-01-01'), failed] },
    [],
    timelineStart(at, 2),
    at,
  );
  expect(result.points[0].value).toBeNull();
  expect(result.points[1].assets.BTC.quantity).toBeNull();
});

it('uses the last checkpoint per ZAR day and excludes observations after the requested time', () => {
  const early = snapshot('2026-01-01');
  const later = {
    ...early,
    timestamp: early.timestamp + 1000,
    holdings: [{ accountId: 'spot', asset: 'BTC', quantity: '3' }],
  };
  const midnight = { ...early, timestamp: Date.parse('2026-01-01T22:00:00Z') };
  const at = midnight.timestamp;
  const result = buildPortfolioTimeline(
    { one: [later, early, midnight, { ...later, timestamp: at + 1 }] },
    [quote('2026-01-01', '10')],
    timelineStart(at, 2),
    at,
  );
  expect(result.points.map(p => [p.date, p.value])).toEqual([
    ['2026-01-01', '30'],
    ['2026-01-02', '20'],
  ]);
  expect(timelineStart(at, 2)).toBe(at - TIMELINE_DAY);
});

it('retains exited assets as zero when complete snapshots confirm their absence', () => {
  const at = time('2026-01-02');
  const exited = snapshot('2026-01-02');
  exited.holdings = [];
  const result = buildPortfolioTimeline(
    { one: [snapshot('2026-01-01'), exited] },
    [quote('2026-01-01', '10')],
    timelineStart(at, 2),
    at,
  );
  expect(result.points[1]).toMatchObject({
    value: '0',
    assets: { BTC: { quantity: '0', value: '0' } },
  });
});
