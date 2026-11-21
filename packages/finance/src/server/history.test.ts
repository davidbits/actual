import { expect, it } from 'vitest';

import { createCollector } from './collector';
import { collectHistory } from './history';

it('resumes time windows without gaps and reports provider retention honestly', async () => {
  const options = {
    from: 0,
    through: 100,
    symbols: [],
    cursors: {},
    maxPages: 1,
  };
  const first = createCollector(options);
  const windows: [number, number][] = [];
  const stream = {
    id: 'ledger',
    accountId: 'account',
    windowMs: 20,
    retentionMs: 60,
    fetch: async (start: number, end: number) => {
      windows.push([start, end]);
      return { events: [] };
    },
  };
  await collectHistory(first, options, stream);
  expect(first.data.coverage[0].status).toBe('partial');
  const nextOptions = { ...options, cursors: first.data.cursors, maxPages: 10 };
  const next = createCollector(nextOptions);
  await collectHistory(next, nextOptions, stream);
  expect(windows).toEqual([
    [40, 59],
    [60, 79],
    [80, 99],
    [100, 100],
  ]);
  expect(next.data.coverage[0]).toMatchObject({
    status: 'partial',
    from: 40,
    through: 100,
  });
});

it('rolls back page data and cursor on a malformed provider page', async () => {
  const options = {
    from: 0,
    through: 100,
    symbols: [],
    cursors: { ledger: '1' },
    maxPages: 2,
  };
  const c = createCollector(options);
  let calls = 0;
  await c.pages('ledger', async () => {
    if (calls++) throw new Error('Invalid provider data');
    return {
      events: [
        {
          id: 'synthetic',
          accountId: 'a',
          timestamp: 1,
          type: 'deposit',
          status: 'booked',
          stream: 'ledger',
          postings: [],
        },
      ],
      cursor: '2',
      exhausted: false,
    };
  });
  expect(c.data.cursors.ledger).toBe('1');
  expect(c.data.events).toEqual([]);
  expect(c.data.coverage[0].status).toBe('error');
});
