import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Collection } from '@actual-app/finance';
import { expect, it } from 'vitest';

import { getAccountDb } from '#account-db';

import { createFinanceRepository } from './repository';
import { createFinanceVault } from './vault';

it('persists encrypted state and prevents a finished job from restoring a deleted connection', () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'actual-finance-store-fixture-'),
  );
  const id = randomUUID();
  try {
    const repository = createFinanceRepository(createFinanceVault(directory));
    const entry = {
      id,
      provider: 'luno',
      name: 'Synthetic',
      fileId: 'synthetic-budget',
      userId: 'synthetic-owner',
      credentials: { key: 'fixture-key', secret: 'fixture-secret' },
      enabled: true,
      intervalMinutes: 15,
      historyStart: '2020-01-01',
      symbols: [],
    };
    repository.saveConnection(entry);
    expect(
      getAccountDb().first(
        'SELECT credentials FROM finance_connections WHERE id=?',
        [id],
      ).credentials,
    ).not.toContain('fixture-secret');
    expect(repository.connections('synthetic-budget')[0].credentials).toEqual(
      entry.credentials,
    );
    expect(repository.connections('unrelated-budget')).toEqual([]);
    const checkpoint: Collection = {
      timestamp: 1000,
      accounts: [{ id: 'spot', name: 'Synthetic spot', product: 'spot' }],
      holdings: [{ accountId: 'spot', asset: 'BTC', quantity: '1.23456789' }],
      positions: [],
      events: [],
      coverage: [{ stream: 'balances', status: 'ok' }],
      cursors: {},
    };
    repository.saveCollection(id, checkpoint);
    repository.saveCollection(id, {
      ...checkpoint,
      timestamp: 2000,
      holdings: [],
    });
    repository.savePrices(
      entry.fileId,
      [1000, 2000].map(timestamp => ({
        asset: 'BTC',
        quote: 'ZAR',
        price: String(timestamp),
        timestamp,
        source: 'synthetic',
      })),
    );
    // A fresh repository/vault instance reads both dated observations after restart.
    const reopened = createFinanceRepository(createFinanceVault(directory));
    expect(reopened.snapshots(id, 999)).toBeUndefined();
    expect(reopened.snapshots(id, 1500)?.holdings).toEqual(checkpoint.holdings);
    expect(reopened.collection(id)?.holdings).toEqual([]);
    expect(reopened.snapshotRange(id, 0, 2000).map(c => c.timestamp)).toEqual([
      2000,
    ]);
    expect(reopened.snapshotRange(id, 0, 1500).map(c => c.timestamp)).toEqual([
      1000,
    ]);
    const midnight = Date.parse('2026-01-01T22:00:00Z');
    for (const timestamp of [midnight - 2, midnight - 1, midnight]) {
      repository.saveSnapshot(id, { ...checkpoint, timestamp });
    }
    expect(
      reopened.snapshotRange(id, midnight - 10, midnight).map(c => c.timestamp),
    ).toEqual([midnight - 1, midnight]);
    expect(reopened.snapshotRange('unrelated', 0, midnight)).toEqual([]);
    expect(
      reopened
        .prices(entry.fileId)
        .map(p => p.timestamp)
        .sort((a, b) => a - b),
    ).toEqual([1000, 2000]);
    expect(
      getAccountDb().first(
        'SELECT payload FROM finance_snapshots WHERE connection_id=?',
        [id],
      ).payload,
    ).not.toContain('1.23456789');
    expect(repository.acquire(id, 1)).toBe(true);
    expect(repository.acquire(id, 2)).toBe(false);
    repository.release(id);
    expect(repository.acquire(id, 3)).toBe(true);
    repository.remove(id);
    repository.saveConnection(entry, true);
    expect(repository.connections('synthetic-budget')).toEqual([]);
  } finally {
    getAccountDb().mutate('DELETE FROM finance_connections WHERE id=?', [id]);
    getAccountDb().mutate('DELETE FROM finance_prices WHERE file_id=?', [
      'synthetic-budget',
    ]);
    rmSync(directory, { recursive: true, force: true });
  }
});
