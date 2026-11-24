import { randomUUID } from 'node:crypto';

import { parseFinanceImport } from '#import';
import { refreshInterval } from '#schedule';
import type {
  Collection,
  ConnectInput,
  ConnectionSummary,
  Credentials,
  Portfolio,
  Price,
} from '#types';
import { historicalHoldings } from '#valuation';

import type { ExchangeAdapter } from './contracts';
import type { PriceSource } from './prices';

export type StoredConnection = ConnectionSummary & {
  fileId: string;
  userId: string;
  credentials: Credentials;
};

export type FinanceRepository = {
  connections(fileId?: string): StoredConnection[];
  saveConnection(connection: StoredConnection, updateOnly?: boolean): void;
  remove(connectionId: string): void;
  collection(connectionId: string): Collection | undefined;
  saveCollection(connectionId: string, collection: Collection): void;
  snapshots(connectionId: string, at: number): Collection | undefined;
  saveSnapshot(connectionId: string, collection: Collection): void;
  prices(fileId: string): Price[];
  savePrices(fileId: string, prices: Price[]): void;
  acquire(connectionId: string, now: number): boolean;
  release(connectionId: string): void;
};

type Factory = {
  create(provider: string, credentials: Credentials): ExchangeAdapter;
};

export function createFinanceService(dependencies: {
  repository: FinanceRepository;
  factory: Factory;
  prices: PriceSource;
  canRead: (connection: StoredConnection) => boolean;
  now?: () => number;
}) {
  const { repository, factory, prices, canRead } = dependencies;
  const now = dependencies.now ?? Date.now;
  const summary = ({
    credentials: _credentials,
    fileId: _fileId,
    userId: _userId,
    ...connection
  }: StoredConnection): ConnectionSummary => ({
    ...connection,
    intervalMinutes: refreshInterval(connection.intervalMinutes),
  });
  const connections = (fileId: string) =>
    repository.connections(fileId).filter(connection => canRead(connection));
  function saveStatus(
    entry: StoredConnection,
    status: Partial<ConnectionSummary>,
  ) {
    // Settings may have changed while the provider requests were in flight.
    const latest = connections(entry.fileId).find(c => c.id === entry.id);
    if (latest) repository.saveConnection({ ...latest, ...status }, true);
  }
  function portfolio(fileId: string, at?: number): Portfolio {
    const entries = connections(fileId);
    const comparisonAt = Math.max(0, (at ?? now()) - 86400000);
    const comparisonCollections: Record<string, Collection> = {};
    const collections: Record<string, Collection> = {};
    for (const connection of entries) {
      const before = repository.snapshots(connection.id, comparisonAt);
      if (before) {
        comparisonCollections[connection.id] = { ...before, events: [] };
      }
      const data =
        at === undefined
          ? repository.collection(connection.id)
          : repository.snapshots(connection.id, at);
      if (data) {
        collections[connection.id] = data;
      } else if (at !== undefined) {
        const current = repository.collection(connection.id);
        if (current) {
          try {
            collections[connection.id] = {
              ...current,
              timestamp: at,
              holdings: historicalHoldings(current, current.events, at),
              events: current.events.filter(e => e.timestamp <= at),
            };
          } catch {
            collections[connection.id] = {
              ...current,
              holdings: [],
              positions: [],
              events: [],
              coverage: [
                {
                  stream: 'historical-holdings',
                  status: 'error',
                  reason:
                    'No complete holdings or position history for this date',
                },
              ],
            };
          }
        }
      }
    }
    return {
      version: 1,
      connections: entries.map(summary),
      collections,
      prices: repository.prices(fileId),
      comparison: { at: comparisonAt, collections: comparisonCollections },
      updatedAt: now(),
    };
  }
  async function sync(fileId: string, onlyId?: string) {
    for (const entry of connections(fileId).filter(
      c => c.enabled && (!onlyId || c.id === onlyId),
    )) {
      if (!repository.acquire(entry.id, now())) continue;
      try {
        const previous = repository.collection(entry.id);
        const fresh = await factory
          .create(entry.provider, entry.credentials)
          .collect({
            from: Date.parse(entry.historyStart),
            through: now(),
            symbols: entry.symbols,
            cursors: previous?.cursors ?? {},
            maxPages: 10,
          });
        const freshAccounts = new Set(
          fresh.accounts
            .filter(
              account =>
                !fresh.coverage.some(
                  coverage =>
                    coverage.status === 'error' &&
                    (coverage.stream === 'balances' ||
                      coverage.stream === `balances:${account.id}` ||
                      coverage.stream === account.id),
                ),
            )
            .map(account => account.id),
        );
        const events = new Map(
          (previous?.events ?? []).map(event => [event.id, event]),
        );
        for (const event of fresh.events) events.set(event.id, event);
        const completeStreams = new Set(
          fresh.coverage.filter(c => c.status === 'ok').map(c => c.stream),
        );
        const holdingKey = (h: Collection['holdings'][number]) =>
          `${h.stream ?? ''}:${h.accountId}:${h.asset}`;
        const freshKeys = new Set(fresh.holdings.map(holdingKey));
        const retained = (previous?.holdings ?? [])
          .filter(h =>
            h.stream
              ? !completeStreams.has(h.stream) && !freshKeys.has(holdingKey(h))
              : !freshAccounts.has(h.accountId),
          )
          .map(h => ({
            ...h,
            observedAt: h.observedAt ?? previous?.timestamp,
          }));
        const accounts = new Map(
          (previous?.accounts ?? []).map(a => [a.id, a]),
        );
        fresh.accounts.forEach(a => accounts.set(a.id, a));
        const merged = {
          ...fresh,
          accounts: [...accounts.values()],
          holdings: [...retained, ...fresh.holdings],
          positions: [
            ...(previous?.positions ?? []).filter(
              p =>
                !fresh.positions.some(f => f.id === p.id) &&
                (p.stream
                  ? !completeStreams.has(p.stream)
                  : !freshAccounts.has(p.accountId)),
            ),
            ...fresh.positions,
          ],
          events: [...events.values()],
        };
        if (
          !connections(fileId).some(connection => connection.id === entry.id)
        ) {
          continue;
        }
        repository.saveCollection(entry.id, merged);
        const errorCount = fresh.coverage.filter(
          c => c.status === 'error',
        ).length;
        saveStatus(entry, {
          lastAttempt: now(),
          lastSuccess: fresh.accounts.length ? now() : entry.lastSuccess,
          error: errorCount
            ? `${errorCount} provider streams need attention`
            : undefined,
        });
      } catch {
        saveStatus(entry, {
          lastAttempt: now(),
          error: 'Collection failed; previous data retained',
        });
      } finally {
        repository.release(entry.id);
      }
    }
    const current = portfolio(fileId);
    const assets = [
      ...new Set(
        Object.values(current.collections).flatMap(c =>
          c.holdings
            .filter(
              h =>
                h.quantity !== '0' ||
                (h.debt && h.debt !== '0') ||
                (h.unrealizedPnl && h.unrealizedPnl !== '0'),
            )
            .map(h => h.asset),
        ),
      ),
    ];
    try {
      repository.savePrices(fileId, await prices.current(assets, 'ZAR'));
    } catch {
      /* Previous quotes retain their timestamps. */
    }
    return portfolio(fileId);
  }
  return {
    portfolio,
    sync,
    connect(fileId: string, userId: string, input: ConnectInput) {
      const existing = input.id
        ? connections(fileId).find(c => c.id === input.id)
        : undefined;
      if (input.id && !existing) throw new Error('Connection not found');
      if (existing && input.provider !== existing.provider) {
        throw new Error('Cannot change an existing connection provider');
      }
      const credentials = input.credentials ?? existing?.credentials;
      if (!credentials) throw new Error('Credentials required');
      factory.create(input.provider, credentials);
      if (
        !input.name.trim() ||
        input.name.length > 100 ||
        !Number.isInteger(input.intervalMinutes) ||
        input.intervalMinutes !== refreshInterval(input.intervalMinutes) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(input.historyStart) ||
        !Number.isFinite(Date.parse(input.historyStart)) ||
        Date.parse(input.historyStart) > now() ||
        input.symbols.length > 100 ||
        input.symbols.some(s => !/^[A-Z0-9_-]{2,40}$/.test(s))
      ) {
        throw new Error('Invalid connection settings');
      }
      const connection: StoredConnection = {
        ...existing,
        id: existing?.id ?? randomUUID(),
        provider: input.provider,
        name: input.name.trim(),
        enabled: input.enabled,
        intervalMinutes: input.intervalMinutes,
        historyStart: input.historyStart,
        symbols: input.symbols,
        credentials,
        fileId,
        userId,
      };
      repository.saveConnection(connection);
      return summary(connection);
    },
    remove(fileId: string, id: string) {
      if (!connections(fileId).some(c => c.id === id)) {
        throw new Error('Connection not found');
      }
      repository.remove(id);
    },
    async historical(fileId: string, at: number) {
      if (!Number.isSafeInteger(at) || at < 0 || at > now()) {
        throw new Error('Invalid valuation date');
      }
      const historical = portfolio(fileId, at);
      const assets = [
        ...new Set(
          Object.values(historical.collections).flatMap(c =>
            c.holdings
              .filter(
                h =>
                  h.quantity !== '0' ||
                  (h.debt && h.debt !== '0') ||
                  (h.unrealizedPnl && h.unrealizedPnl !== '0'),
              )
              .map(h => h.asset),
          ),
        ),
      ];
      const quotes = await prices.historical(assets, 'ZAR', at);
      repository.savePrices(fileId, quotes);
      return portfolio(fileId, at);
    },
    importData(fileId: string, connectionId: string, input: unknown) {
      if (!connections(fileId).some(c => c.id === connectionId)) {
        throw new Error('Connection not found');
      }
      const imported = parseFinanceImport(input);
      const previous = repository.collection(connectionId);
      const events = new Map((previous?.events ?? []).map(e => [e.id, e]));
      imported.collection.events.forEach(e => events.set(e.id, e));
      const accounts = new Map((previous?.accounts ?? []).map(a => [a.id, a]));
      imported.collection.accounts.forEach(a => accounts.set(a.id, a));
      const current = previous ?? imported.collection;
      repository.saveCollection(connectionId, {
        ...current,
        accounts: [...accounts.values()],
        events: [...events.values()],
      });
      if (imported.collection.holdings.length) {
        repository.saveSnapshot(connectionId, imported.collection);
      }
      repository.savePrices(fileId, imported.prices);
      return portfolio(fileId);
    },
    async tick() {
      const due = repository
        .connections()
        .filter(
          c =>
            canRead(c) &&
            c.enabled &&
            (c.lastAttempt === undefined ||
              now() - c.lastAttempt >=
                refreshInterval(c.intervalMinutes) * 60000),
        );
      for (const connection of due) {
        await sync(connection.fileId, connection.id);
      }
    },
  };
}
