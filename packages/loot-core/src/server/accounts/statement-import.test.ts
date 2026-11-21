import {
  statementFactory,
  statementTransactions,
} from '@actual-app/finance/statements';
import { beforeEach, expect, it } from 'vitest';

import * as db from '#server/db';
import { loadMappings } from '#server/db/mappings';
import { loadRules } from '#server/transactions/transaction-rules';

import { reconcileTransactions } from './sync';

const header =
  'Statement Enquiry :\nAccount Number : ,900000009\nAccount Description :,Synthetic Current\n';
const firstRow = '01Jan2025,Example receipt,100,100,\n';
const secondRow = '02Jan2025,Example expense,-20,80,\n';

beforeEach(async () => {
  await global.emptyDatabase()();
  await loadMappings();
  await loadRules();
  await db.insertAccount({
    id: 'synthetic-current',
    name: 'Synthetic current',
  });
});

it('previews without writes and imports repeated and overlapping Nedbank statements once', async () => {
  const rows = statementTransactions(
    statementFactory.parse(header + firstRow + secondRow),
  );
  await reconcileTransactions('synthetic-current', rows, { isPreview: true });
  expect(await db.all('SELECT id FROM v_transactions')).toHaveLength(0);
  const first = await reconcileTransactions('synthetic-current', rows);
  expect(first.added).toHaveLength(2);
  expect(
    (await reconcileTransactions('synthetic-current', rows)).added,
  ).toHaveLength(0);
  const overlap = statementTransactions(
    statementFactory.parse(header + secondRow),
  );
  expect(
    (await reconcileTransactions('synthetic-current', overlap)).added,
  ).toHaveLength(0);
  const stored = await db.all<{ amount: number }>(
    'SELECT amount FROM v_transactions',
  );
  expect(stored).toHaveLength(2);
  expect(stored.reduce((sum, row) => sum + row.amount, 0)).toBe(8000);
  await db.update('transactions', { id: first.added[0], tombstone: 1 });
  expect(
    (
      await reconcileTransactions('synthetic-current', rows, {
        reimportDeleted: false,
      })
    ).added,
  ).toHaveLength(0);
  expect(await db.all('SELECT id FROM v_transactions')).toHaveLength(1);
});

it('retains two genuine equal card purchases when imported and repeated', async () => {
  const cardHeader =
    'Statement Enquiry :\nAccount Number : ,9000000000000010\nAccount Description :,Credit Card\n';
  const row = '01-Jan-2025,02-Jan-2025,Example merchant,-12.50,\n';
  const transactions = statementTransactions(
    statementFactory.parse(cardHeader + row + row),
  );
  expect(
    (await reconcileTransactions('synthetic-current', transactions)).added,
  ).toHaveLength(2);
  expect(
    (await reconcileTransactions('synthetic-current', transactions)).added,
  ).toHaveLength(0);
  const stored = await db.all<{ amount: number }>(
    'SELECT amount FROM v_transactions',
  );
  expect(stored.map(t => t.amount)).toEqual([-1250, -1250]);
});

it('clears a finalized statement row without duplicating its provisional import', async () => {
  const provisional = statementTransactions(
    statementFactory.parse(
      header + '01Jan2025,PROVISIONAL STATEMENT,,\n' + firstRow,
    ),
  );
  await reconcileTransactions('synthetic-current', provisional);
  expect(await db.all('SELECT cleared FROM v_transactions')).toEqual([
    { cleared: 0 },
  ]);
  const final = statementTransactions(
    statementFactory.parse(header + firstRow),
  );
  const result = await reconcileTransactions('synthetic-current', final);
  expect(result.added).toHaveLength(0);
  expect(result.updated).toHaveLength(1);
  expect(await db.all('SELECT cleared FROM v_transactions')).toEqual([
    { cleared: 1 },
  ]);
});
