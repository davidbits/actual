import type { PortfolioTimeline } from '@actual-app/finance';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import * as asyncStorage from '#platform/server/asyncStorage';
import { fetch as financeFetch } from '#platform/server/fetch';
import * as db from '#server/db';
import * as prefs from '#server/prefs';
import * as server from '#server/server-config';

import { app } from './app';

vi.mock('#platform/server/fetch', () => ({ fetch: vi.fn() }));

beforeEach(async () => {
  await global.emptyDatabase()();
});

afterEach(() => vi.restoreAllMocks());

it('caches graph history by connection/range, avoids clock-only writes and handles offline reads', async () => {
  vi.spyOn(prefs, 'getPrefs').mockReturnValue({
    id: 'fixture',
    budgetName: 'Fixture',
    cloudFileId: 'fixture-cloud',
  });
  vi.spyOn(server, 'getServer').mockReturnValue(
    server.getServer('http://finance.example.test'),
  );
  vi.spyOn(asyncStorage, 'getItem').mockResolvedValue('fixture-token');
  const timeline: PortfolioTimeline = {
    from: '2026-01-01',
    through: '2026-01-07',
    asOf: Date.parse('2026-01-07T10:00:00Z'),
    assets: [],
    points: [],
  };
  const fetcher = vi.mocked(financeFetch);
  const response = (value: PortfolioTimeline) =>
    new Response(JSON.stringify({ status: 'ok', data: value }));
  fetcher.mockResolvedValueOnce(response(timeline));
  expect(
    await app.handlers['finance/timeline']({ days: 7, connectionId: 'one' }),
  ).toEqual({ timeline, offline: false });
  fetcher.mockResolvedValueOnce(
    response({ ...timeline, asOf: timeline.asOf + 1000 }),
  );
  await app.handlers['finance/timeline']({ days: 7, connectionId: 'one' });
  fetcher.mockRejectedValue(new Error('offline'));
  expect(
    await app.handlers['finance/timeline']({ days: 7, connectionId: 'one' }),
  ).toEqual({ timeline, offline: true });
  expect(
    (await app.handlers['finance/timeline']({ days: 30, connectionId: 'one' }))
      .timeline,
  ).toBeUndefined();
  expect(
    (await app.handlers['finance/timeline']({ days: 7, connectionId: 'two' }))
      .timeline,
  ).toBeUndefined();
  expect(
    (
      await app.handlers['finance/timeline']({
        days: 7,
        connectionId: 'one',
        at: timeline.asOf - 1000,
      })
    ).timeline,
  ).toBeUndefined();
  fetcher
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' })))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'ok',
          data: {
            version: 1,
            collections: {},
            connections: [],
            prices: [],
            updatedAt: 0,
          },
        }),
      ),
    );
  await app.handlers['finance/remove']({ id: 'one' });
  expect(
    (await app.handlers['finance/timeline']({ days: 7, connectionId: 'one' }))
      .timeline,
  ).toBeUndefined();
});

it('returns an offline state for unavailable background reads instead of throwing', async () => {
  vi.spyOn(prefs, 'getPrefs').mockReturnValue({
    id: 'fixture',
    budgetName: 'Fixture',
  });
  const result = await app.handlers['finance/read']();
  expect(result.offline).toBe(true);
  expect(result.portfolio.connections).toEqual([]);
  expect(result.providers).toEqual([]);
});

it('does not rewrite the synced cache on unchanged background refreshes', async () => {
  vi.spyOn(prefs, 'getPrefs').mockReturnValue({
    id: 'fixture',
    budgetName: 'Fixture',
    cloudFileId: 'fixture-cloud',
  });
  vi.spyOn(server, 'getServer').mockReturnValue(
    server.getServer('http://finance.example.test'),
  );
  vi.spyOn(asyncStorage, 'getItem').mockResolvedValue('fixture-token');
  const portfolio = {
    version: 1,
    connections: [],
    collections: {},
    prices: [
      {
        asset: 'USD',
        quote: 'ZAR',
        price: '20',
        timestamp: 50,
        source: 'fixture',
      },
    ],
    comparison: { at: 50, collections: {} },
    updatedAt: 100,
  };
  const fetcher = vi.mocked(financeFetch);
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ status: 'ok', data: portfolio })),
  );
  await app.handlers['finance/pull']();
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        status: 'ok',
        data: {
          ...portfolio,
          updatedAt: 200,
          comparison: { at: 150, collections: {} },
        },
      }),
    ),
  );
  await app.handlers['finance/pull']();
  expect((await app.handlers['finance/get']()).updatedAt).toBe(100);
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        status: 'ok',
        data: { ...portfolio, prices: [], updatedAt: 300 },
      }),
    ),
  );
  await app.handlers['finance/pull']();
  expect((await app.handlers['finance/get']()).updatedAt).toBe(300);
});

it('ignores an incomplete synced cache row until its atomic payload arrives', async () => {
  db.runQuery("INSERT INTO finance_cache(id) VALUES('portfolio')");
  expect((await app.handlers['finance/get']()).connections).toEqual([]);
  const portfolio = {
    version: 1,
    connections: [],
    collections: {},
    prices: [],
    updatedAt: 123,
  };
  db.runQuery("UPDATE finance_cache SET payload=? WHERE id='portfolio'", [
    JSON.stringify(portfolio),
  ]);
  expect(await app.handlers['finance/get']()).toEqual(portfolio);
});
