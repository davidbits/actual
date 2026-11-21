import { beforeEach, expect, it } from 'vitest';

import * as db from '#server/db';

import { app } from './app';

beforeEach(async () => {
  await global.emptyDatabase()();
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
