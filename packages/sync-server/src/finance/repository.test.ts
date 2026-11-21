import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    expect(repository.acquire(id, 1)).toBe(true);
    expect(repository.acquire(id, 2)).toBe(false);
    repository.release(id);
    expect(repository.acquire(id, 3)).toBe(true);
    repository.remove(id);
    repository.saveConnection(entry, true);
    expect(repository.connections('synthetic-budget')).toEqual([]);
  } finally {
    getAccountDb().mutate('DELETE FROM finance_connections WHERE id=?', [id]);
    rmSync(directory, { recursive: true, force: true });
  }
});
