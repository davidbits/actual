import { describe, expect, it, vi } from 'vitest';

import { portfolioChanges } from '#changes';
import type { Collection, ConnectInput, Price } from '#types';

import { createFinanceService } from './service';
import type { FinanceRepository, StoredConnection } from './service';

const day = 86400000;
const input: ConnectInput = {
  provider: 'fixture',
  name: 'Synthetic exchange',
  credentials: { key: 'fixture', secret: 'fixture' },
  enabled: true,
  intervalMinutes: 1440,
  historyStart: '2020-01-01',
  symbols: [],
};

function setup() {
  let now = Date.parse('2026-01-01T12:00:00Z');
  const entries = new Map<string, StoredConnection>();
  const data = new Map<string, Collection>();
  const snapshots = new Map<string, Collection[]>();
  const quotes: Price[] = [];
  const locks = new Set<string>();
  const repository: FinanceRepository = {
    connections: file =>
      [...entries.values()].filter(c => !file || c.fileId === file),
    saveConnection: c => {
      entries.set(c.id, c);
    },
    remove: id => {
      entries.delete(id);
    },
    collection: id => data.get(id),
    saveCollection: (id, c) => {
      data.set(id, c);
      snapshots.set(id, [...(snapshots.get(id) ?? []), structuredClone(c)]);
    },
    snapshots: (id, at) =>
      snapshots
        .get(id)
        ?.filter(c => c.timestamp <= at)
        .at(-1),
    saveSnapshot: (id, c) => {
      snapshots.set(id, [...(snapshots.get(id) ?? []), structuredClone(c)]);
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
  const collection = (): Collection => ({
    timestamp: now,
    accounts: [{ id: 'spot', name: 'Spot', product: 'spot' }],
    holdings: [
      { accountId: 'spot', asset: 'BTC', quantity: '2', stream: 'balances' },
    ],
    positions: [],
    events: [],
    coverage: [{ stream: 'balances', status: 'ok' }],
    cursors: {},
  });
  const collect = vi.fn(async () => collection());
  const prices = {
    current: vi.fn(async (): Promise<Price[]> => [
      {
        asset: 'BTC',
        quote: 'ZAR',
        price: '10',
        timestamp: now,
        source: 'fixture',
      },
    ]),
    historical: vi.fn(async () => []),
  };
  const service = createFinanceService({
    repository,
    now: () => now,
    prices,
    canRead: c => c.userId === 'owner',
    factory: {
      create: () => ({
        definition: {
          id: 'fixture',
          name: 'Fixture',
          products: [],
          passphrase: false,
        },
        collect,
      }),
    },
  });
  const connection = service.connect('budget', 'owner', input);
  return {
    service,
    repository,
    connection,
    collect,
    collection,
    prices,
    entries,
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('automatic exchange refresh', () => {
  it('collects once due, honors edits, pauses, and rejects intervals longer than a day', async () => {
    const s = setup();
    await s.service.tick();
    s.advance(day - 1);
    await s.service.tick();
    expect(s.collect).toHaveBeenCalledTimes(1);
    s.advance(1);
    await s.service.tick();
    expect(s.collect).toHaveBeenCalledTimes(2);
    expect(s.prices.current).toHaveBeenCalledTimes(2);
    expect(() =>
      s.service.connect('budget', 'owner', {
        ...input,
        id: s.connection.id,
        intervalMinutes: 1441,
      }),
    ).toThrow('Invalid connection settings');
    s.service.connect('budget', 'owner', {
      ...input,
      id: s.connection.id,
      intervalMinutes: 5,
      credentials: undefined,
    });
    s.advance(5 * 60000);
    await s.service.tick();
    expect(s.collect).toHaveBeenCalledTimes(3);
    s.service.connect('budget', 'owner', {
      ...input,
      id: s.connection.id,
      enabled: false,
    });
    s.advance(day * 2);
    await s.service.tick();
    expect(s.collect).toHaveBeenCalledTimes(3);
  });

  it('caps old weekly schedules at daily and excludes inaccessible budgets', async () => {
    const s = setup();
    const entry = s.entries.get(s.connection.id)!;
    s.entries.set(entry.id, {
      ...entry,
      intervalMinutes: 10080,
      lastAttempt: s.now(),
    });
    expect(s.service.portfolio('budget').connections[0].intervalMinutes).toBe(
      1440,
    );
    s.advance(day);
    await s.service.tick();
    expect(s.collect).toHaveBeenCalledTimes(1);
    s.entries.set(entry.id, { ...entry, userId: 'someone-else' });
    s.advance(day);
    await s.service.tick();
    expect(s.collect).toHaveBeenCalledTimes(1);
    expect(s.service.portfolio('budget').comparison?.collections).toEqual({});
  });

  it('preserves schedule edits made during collection, without leaking credentials', async () => {
    const s = setup();
    s.collect.mockImplementationOnce(async () => {
      s.service.connect('budget', 'owner', {
        ...input,
        id: s.connection.id,
        intervalMinutes: 60,
        enabled: false,
        credentials: undefined,
      });
      return s.collection();
    });
    await s.service.tick();
    expect(s.service.portfolio('budget').connections[0]).toMatchObject({
      intervalMinutes: 60,
      enabled: false,
      lastAttempt: s.now(),
    });
    expect(JSON.stringify(s.service.portfolio('budget'))).not.toContain(
      'credentials',
    );
  });

  it('keeps checkpoints and dated rates across daily changes and outages', async () => {
    const s = setup();
    await s.service.tick();
    const first = s.now();
    s.advance(day);
    s.collect.mockImplementationOnce(async () => ({
      ...s.collection(),
      holdings: [
        { accountId: 'spot', asset: 'BTC', quantity: '3', stream: 'balances' },
      ],
    }));
    s.prices.current.mockResolvedValueOnce([
      {
        asset: 'BTC',
        quote: 'ZAR',
        price: '12',
        timestamp: s.now(),
        source: 'fixture',
      },
    ]);
    await s.service.tick();
    const portfolio = s.service.portfolio('budget');
    expect(portfolio.comparison?.collections[s.connection.id].timestamp).toBe(
      first,
    );
    expect(portfolioChanges(portfolio, s.now())[0]).toMatchObject({
      quantityChange: '1',
      rateChange: '2',
      valueChange: '16',
      before: { value: '20' },
      after: { value: '36' },
    });
    expect(
      s.service.portfolio('budget', first).collections[s.connection.id]
        .holdings[0].quantity,
    ).toBe('2');
    s.advance(day);
    s.collect.mockRejectedValueOnce(new Error('offline'));
    s.prices.current.mockRejectedValueOnce(new Error('offline'));
    await s.service.tick();
    const failed = s.service.portfolio('budget');
    expect(failed.collections[s.connection.id].timestamp).toBe(first + day);
    expect(failed.prices).toHaveLength(2);
    expect(failed.connections[0]).toMatchObject({
      lastAttempt: s.now(),
      lastSuccess: first + day,
      error: 'Collection failed; previous data retained',
    });
    await s.service.tick();
    expect(s.collect).toHaveBeenCalledTimes(3);
  });
});
