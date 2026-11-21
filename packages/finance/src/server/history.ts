import type { FinanceEvent } from '#types';

import type { createCollector } from './collector';
import type { CollectOptions } from './contracts';

type WindowCursor = {
  start: number;
  end: number;
  page?: string;
  through?: number;
};

/** Durable bounded paging, shared by time-windowed account APIs. */
export async function collectHistory(
  collector: ReturnType<typeof createCollector>,
  options: CollectOptions,
  stream: {
    id: string;
    accountId: string;
    windowMs: number;
    retentionMs?: number;
    fetch(
      start: number,
      end: number,
      cursor?: string,
    ): Promise<{ events: FinanceEvent[]; next?: string }>;
  },
) {
  const floor = Math.max(
    options.from,
    stream.retentionMs ? options.through - stream.retentionMs : options.from,
  );
  await collector.stream(
    stream.id,
    async () => {
      const saved = options.cursors[stream.id];
      let cursor: WindowCursor = saved
        ? (JSON.parse(saved) as WindowCursor)
        : {
            start: floor,
            end: Math.min(options.through, floor + stream.windowMs - 1),
          };
      if (cursor.through !== undefined) {
        cursor = {
          start: Math.max(floor, cursor.through - 2 * 86400000),
          end: options.through,
        };
      }
      if (
        !Number.isSafeInteger(cursor.start) ||
        !Number.isSafeInteger(cursor.end) ||
        cursor.start < floor
      ) {
        cursor = {
          start: floor,
          end: Math.min(options.through, floor + stream.windowMs - 1),
        };
      }
      cursor.end = Math.min(
        cursor.end,
        cursor.start + stream.windowMs - 1,
        options.through,
      );
      for (let page = 0; page < (options.maxPages ?? 10); page++) {
        const result = await stream.fetch(
          cursor.start,
          cursor.end,
          cursor.page,
        );
        collector.data.events.push(...result.events);
        if (result.next) {
          if (result.next === cursor.page) {
            throw new Error('History cursor did not advance');
          }
          cursor.page = result.next;
        } else if (cursor.end >= options.through) {
          cursor.through = options.through;
          collector.data.cursors[stream.id] = JSON.stringify(cursor);
          collector.data.coverage.push({
            stream: stream.id,
            accountId: stream.accountId,
            status: floor > options.from ? 'partial' : 'ok',
            from: floor,
            through: options.through,
            reason:
              floor > options.from
                ? 'Older history exceeds provider retention; statement backfill required'
                : undefined,
          });
          return;
        } else {
          cursor = {
            start: cursor.end + 1,
            end: Math.min(options.through, cursor.end + stream.windowMs),
          };
        }
        collector.data.cursors[stream.id] = JSON.stringify(cursor);
      }
      collector.data.coverage.push({
        stream: stream.id,
        accountId: stream.accountId,
        status: 'partial',
        from: floor,
        through: cursor.start,
        reason: 'Historical backfill continues on next collection',
      });
    },
    { accountId: stream.accountId },
  );
}
