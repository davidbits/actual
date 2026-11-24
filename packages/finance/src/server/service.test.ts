import { describe, expect, it } from 'vitest';

import type { Collection, Price } from '#types';

import { createFinanceService } from './service';
import type { FinanceRepository, StoredConnection } from './service';

describe('finance collection service', () => {
  it('keeps credentials private, deduplicates events and respects leases', async () => {
    const entries = new Map<string, StoredConnection>();
    const data = new Map<string, Collection>();
    const locks = new Set<string>();
    const quotes: Price[] = [];
    const repository: FinanceRepository = {
      connections: file =>
        [...entries.values()].filter(c => !file || c.fileId === file),
      saveConnection: connection => {
        entries.set(connection.id, connection);
      },
      remove: id => {
        entries.delete(id);
      },
      collection: id => data.get(id),
      saveCollection: (id, collection) => {
        data.set(id, collection);
      },
      snapshots: id => data.get(id),
      snapshotRange: id => (data.has(id) ? [data.get(id)!] : []),
      saveSnapshot: () => {
        /* empty */
      },
      prices: () => quotes,
      savePrices: (_file, prices) => {
        quotes.push(...prices);
      },
      acquire: id => {
        if (locks.has(id)) return false;
        locks.add(id);
        return true;
      },
      release: id => {
        locks.delete(id);
      },
    };
    let calls = 0;
    let mode = 'normal';
    const service = createFinanceService({
      repository,
      canRead: c => c.userId === 'owner',
      now: () => 1000,
      prices: { current: async () => [], historical: async () => [] },
      factory: {
        create: () => ({
          definition: {
            id: 'fixture',
            name: 'Fixture',
            products: [],
            passphrase: false,
          },
          collect: async () => {
            calls++;
            return {
              timestamp: 1000,
              accounts: [{ id: 'a', name: 'Wallet', product: 'spot' }],
              holdings:
                mode === 'empty'
                  ? []
                  : [
                      {
                        accountId: 'a',
                        asset: 'ZAR',
                        quantity: '1',
                        stream: 'balances',
                      },
                    ],
              positions:
                mode !== 'normal'
                  ? []
                  : [
                      {
                        id: 'p',
                        accountId: 'a',
                        symbol: 'BTCZAR',
                        settlementAsset: 'ZAR',
                        quantity: '1',
                        entryPrice: '1',
                        unrealizedPnl: '0',
                        side: 'long',
                        stream: 'positions',
                      },
                    ],
              coverage: [
                { stream: 'balances', status: 'ok' },
                {
                  stream: 'positions',
                  accountId: 'a',
                  status: mode === 'positions-fail' ? 'error' : 'ok',
                },
              ],
              cursors: {},
              events: [
                {
                  id: 'one',
                  accountId: 'a',
                  stream: 'ledger',
                  timestamp: 1000,
                  type: 'deposit',
                  status: 'booked',
                  postings: [
                    { asset: 'ZAR', quantity: '1', role: 'principal' },
                  ],
                },
              ],
            };
          },
        }),
      },
    });
    const connection = service.connect('budget', 'owner', {
      provider: 'fixture',
      name: 'Wallet',
      credentials: { key: 'synthetic-key', secret: 'synthetic-secret' },
      enabled: true,
      intervalMinutes: 15,
      historyStart: '1970-01-01',
      symbols: [],
    });
    await service.sync('budget');
    await service.sync('budget');
    expect(
      service.portfolio('budget').collections[connection.id].events,
    ).toHaveLength(1);
    expect(
      service.portfolio('budget').collections[connection.id].holdings,
    ).toHaveLength(1);
    expect(JSON.stringify(service.portfolio('budget'))).not.toContain(
      'synthetic-secret',
    );
    expect(service.portfolio('other').connections).toEqual([]);
    locks.add(connection.id);
    await service.sync('budget');
    expect(calls).toBe(2);
    locks.delete(connection.id);
    mode = 'positions-fail';
    await service.sync('budget');
    expect(
      service.portfolio('budget').collections[connection.id].positions,
    ).toHaveLength(1);
    expect(
      service.portfolio('budget').collections[connection.id].holdings,
    ).toHaveLength(1);
    mode = 'empty';
    await service.sync('budget');
    expect(
      service.portfolio('budget').collections[connection.id].holdings,
    ).toEqual([]);
    expect(
      service.portfolio('budget').collections[connection.id].positions,
    ).toEqual([]);
  });
});
