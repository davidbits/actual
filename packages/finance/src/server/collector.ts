import type { Collection, Coverage, FinanceEvent } from '#types';

import type { CollectOptions, EventPage } from './contracts';
import { ProviderError } from './transport';

export function createCollector(options: CollectOptions) {
  const data: Collection = {
    timestamp: options.through,
    accounts: [],
    holdings: [],
    positions: [],
    events: [],
    coverage: [],
    cursors: { ...options.cursors },
  };
  async function stream(
    name: string,
    action: () => Promise<void>,
    details: Partial<Coverage> = {},
  ) {
    const checkpoint = {
      accounts: data.accounts.length,
      holdings: data.holdings.length,
      positions: data.positions.length,
      events: data.events.length,
      cursors: { ...data.cursors },
    };
    try {
      await action();
      for (const row of data.holdings.slice(checkpoint.holdings)) {
        row.stream ??= name;
      }
      for (const row of data.positions.slice(checkpoint.positions)) {
        row.stream ??= name;
      }
      if (
        !data.coverage.some(
          c =>
            c.stream === name &&
            (details.accountId === undefined ||
              c.accountId === details.accountId),
        )
      ) {
        data.coverage.push({ stream: name, status: 'ok', ...details });
      }
    } catch (error) {
      data.accounts.length = checkpoint.accounts;
      data.holdings.length = checkpoint.holdings;
      data.positions.length = checkpoint.positions;
      data.events.length = checkpoint.events;
      data.cursors = checkpoint.cursors;
      data.coverage.push({
        stream: name,
        ...details,
        status: 'error',
        reason:
          error instanceof ProviderError
            ? error.message
            : 'Unexpected provider data',
      });
    }
  }
  async function pages(
    name: string,
    fetch: (cursor: string | undefined) => Promise<EventPage>,
    accountId?: string,
    balanceHistory = false,
  ) {
    await stream(
      name,
      async () => {
        let cursor = data.cursors[name];
        const seen = new Set<string>();
        for (let page = 0; page < (options.maxPages ?? 20); page++) {
          const result = await fetch(cursor);
          data.events.push(...result.events);
          if (result.exhausted) {
            if (result.cursor !== undefined) data.cursors[name] = result.cursor;
            return;
          }
          if (!result.cursor || seen.has(result.cursor)) {
            throw new Error('Pagination did not advance');
          }
          seen.add(result.cursor);
          cursor = result.cursor;
          data.cursors[name] = cursor;
        }
        data.coverage.push({
          stream: name,
          accountId,
          status: 'partial',
          reason: 'Backfill continues on next sync',
          from: options.from,
          through: options.through,
        });
      },
      {
        accountId,
        balanceHistory,
        from: options.from,
        through: options.through,
      },
    );
  }
  function unsupported(stream: string, reason: string) {
    data.coverage.push({ stream, status: 'unsupported', reason });
  }
  function finish(): Collection {
    const events = new Map<string, FinanceEvent>();
    for (const event of data.events) events.set(event.id, event);
    return {
      ...data,
      holdings: data.holdings
        .map(holding => ({ ...holding, observedAt: data.timestamp }))
        .filter(
          h =>
            h.quantity !== '0' ||
            (h.debt && h.debt !== '0') ||
            (h.unrealizedPnl && h.unrealizedPnl !== '0'),
        ),
      events: [...events.values()],
    };
  }
  return { data, stream, pages, unsupported, finish };
}
