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
    updatedAt: 100,
  };
  const fetcher = vi.mocked(financeFetch);
  fetcher.mockResolvedValueOnce(
    new Response(JSON.stringify({ status: 'ok', data: portfolio })),
  );
  await app.handlers['finance/pull']();
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ status: 'ok', data: { ...portfolio, updatedAt: 200 } }),
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
