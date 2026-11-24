import { emptyPortfolio } from '@actual-app/finance';
import type {
  ConnectInput,
  Portfolio,
  ProviderDefinition,
} from '@actual-app/finance';

import * as asyncStorage from '#platform/server/asyncStorage';
import { fetch } from '#platform/server/fetch';
import { createApp } from '#server/app';
import * as db from '#server/db';
import { mutator } from '#server/mutators';
import { getPrefs } from '#server/prefs';
import { getServer } from '#server/server-config';

async function request<T>(path: string, body: unknown = {}): Promise<T> {
  const server = getServer()?.BASE_SERVER.replace(/\/$/, '');
  const fileId = getPrefs()?.cloudFileId;
  const token = await asyncStorage.getItem('user-token');
  if (!server || !fileId || !token) {
    throw new Error('A synced budget and server connection are required');
  }
  const response = await fetch(`${server}/finance/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ACTUAL-TOKEN': token,
      'X-Actual-File-Id': fileId,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10 * 60000),
  });
  if (!response.ok) throw new Error('Finance request failed');
  const result = (await response.json()) as { status: string; data: T };
  if (result.status !== 'ok') throw new Error('Finance request failed');
  return result.data;
}

async function save(portfolio: Portfolio) {
  if (
    portfolio.version !== 1 ||
    !Array.isArray(portfolio.connections) ||
    !portfolio.collections ||
    !Array.isArray(portfolio.prices)
  ) {
    throw new Error('Invalid portfolio response');
  }
  // Keep offline history useful without turning one CRDT cell into an unbounded archive.
  const cached: Portfolio = {
    ...portfolio,
    collections: Object.fromEntries(
      Object.entries(portfolio.collections).map(([id, value]) => [
        id,
        {
          ...value,
          events: [...value.events]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 2000),
          coverage:
            value.events.length <= 2000
              ? value.coverage
              : [
                  ...value.coverage.map(c => ({ ...c, balanceHistory: false })),
                  {
                    stream: 'offline-cache',
                    status: 'partial' as const,
                    reason:
                      'Only the latest 2,000 events are cached. Refresh saved data for full server history before exporting.',
                  },
                ],
        },
      ]),
    ),
  };
  const previous = await get();
  const content = (value: Portfolio) =>
    JSON.stringify({
      ...value,
      updatedAt: 0,
      comparison: value.comparison ? { ...value.comparison, at: 0 } : undefined,
    });
  // A background sidebar refresh must not write a new CRDT document just
  // because the server's response timestamp changed.
  if (content(cached) !== content(previous)) {
    await db.update('finance_cache', {
      id: 'portfolio',
      payload: JSON.stringify(cached),
      tombstone: 0,
    });
  }
  return portfolio;
}

async function get() {
  const row = await db.first<{ payload: string }>(
    'SELECT payload FROM finance_cache WHERE id=? AND tombstone=0 AND payload IS NOT NULL',
    ['portfolio'],
  );
  return row ? (JSON.parse(row.payload) as Portfolio) : emptyPortfolio();
}
async function pull() {
  return save(await request<Portfolio>('list'));
}
async function sync({ id }: { id?: string } = {}) {
  return save(await request<Portfolio>('sync', { id }));
}
async function connect(input: ConnectInput) {
  await request('connect', input);
  return pull();
}
async function remove({ id }: { id: string }) {
  await request('remove', { id });
  return pull();
}
async function history({ at }: { at: number }) {
  return request<Portfolio>('history', { at });
}
async function importData({ id, document }: { id: string; document: unknown }) {
  return save(await request<Portfolio>('import', { id, document }));
}
async function providers() {
  return request<ProviderDefinition[]>('providers');
}

async function read() {
  try {
    const portfolio = await pull();
    const definitions = await providers().catch(() => []);
    return { portfolio, providers: definitions, offline: false };
  } catch {
    // Network/auth availability is an expected UI state. Catch it within the
    // handler so background reads do not emit a global internal-error toast.
    return { portfolio: await get(), providers: [], offline: true };
  }
}

export type FinanceHandlers = {
  'finance/read': typeof read;
  'finance/get': typeof get;
  'finance/pull': typeof pull;
  'finance/sync': typeof sync;
  'finance/connect': typeof connect;
  'finance/remove': typeof remove;
  'finance/history': typeof history;
  'finance/providers': typeof providers;
  'finance/import': typeof importData;
};

export const app = createApp<FinanceHandlers>();
app.method('finance/get', get);
app.method('finance/read', mutator(read));
app.method('finance/providers', providers);
app.method('finance/pull', mutator(pull));
app.method('finance/sync', mutator(sync));
app.method('finance/connect', mutator(connect));
app.method('finance/remove', mutator(remove));
app.method('finance/history', history);

app.method('finance/import', mutator(importData));
