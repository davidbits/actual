import { expect, it, vi } from 'vitest';

import { ecbPrices } from './fx';
import { createPriceSource } from './prices';

it('uses actual stablecoin/ZAR quotes and never assumes a USD peg', async () => {
  const fetcher = vi.fn<typeof fetch>(
    async url =>
      new Response(
        String(url).includes('luno')
          ? JSON.stringify({
              tickers: [
                { pair: 'USDTZAR', last_trade: '17.5', timestamp: 100 },
              ],
            })
          : JSON.stringify([{ symbol: 'ETHUSDT', price: '3000' }]),
      ),
  );
  const quotes = await createPriceSource(fetcher).current(['ETH'], 'ZAR');
  expect(quotes.find(p => p.asset === 'ETH')?.price).toBe('52500');
});

it('uses a completed historical local candle when Luno denies anonymous candles', async () => {
  const at = Date.parse('2025-01-03T21:59:59Z');
  const fetcher = vi.fn<typeof fetch>(async url =>
    String(url).includes('luno')
      ? new Response('{}', { status: 401 })
      : new Response(
          JSON.stringify([
            { startTime: '2025-01-02T00:00:00Z', close: '100' },
            { startTime: '2025-01-03T00:00:00Z', close: '200' },
          ]),
        ),
  );
  const prices = await createPriceSource(fetcher).historical(
    ['BTC'],
    'ZAR',
    at,
  );
  expect(prices.find(p => p.asset === 'BTC')?.price).toBe('100');
  expect(prices.find(p => p.asset === 'BTC')?.source).toContain('VALR');
});

it('derives fiat cross rates from the same dated ECB observation', async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(
        `<Cube time='2025-01-02'><Cube currency='USD' rate='1.2'/><Cube currency='ZAR' rate='24'/></Cube>`,
      ),
  );
  const prices = await ecbPrices(
    ['USD', 'EUR'],
    Date.parse('2025-01-03'),
    true,
    fetcher,
  );
  expect(prices.map(p => p.price)).toEqual(['20', '24']);
  expect(
    await ecbPrices(['USD'], Date.parse('2025-01-01'), true, fetcher),
  ).toEqual([]);
});
