import { afterEach, expect, it, vi } from 'vitest';

import { scheduleFinanceSync } from './scheduler';

afterEach(() => vi.useRealTimers());

it('runs overdue work at startup, never overlaps a slow job, and stops cleanly', async () => {
  vi.useFakeTimers();
  let finish: (() => void) | undefined;
  const tick = vi.fn(
    () =>
      new Promise<void>(resolve => {
        finish = resolve;
      }),
  );
  const stop = scheduleFinanceSync(tick);
  expect(tick).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(180000);
  expect(tick).toHaveBeenCalledTimes(1);
  finish?.();
  await vi.advanceTimersByTimeAsync(60000);
  expect(tick).toHaveBeenCalledTimes(2);
  stop();
  finish?.();
  await vi.advanceTimersByTimeAsync(86400000);
  expect(tick).toHaveBeenCalledTimes(2);
});

it('retries a failed poll without waiting for a browser request', async () => {
  vi.useFakeTimers();
  const tick = vi
    .fn()
    .mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValue(undefined);
  const stop = scheduleFinanceSync(tick);
  await vi.advanceTimersByTimeAsync(60000);
  expect(tick).toHaveBeenCalledTimes(2);
  stop();
});
