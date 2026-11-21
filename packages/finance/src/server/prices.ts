import { Exact } from '#decimal';
import type { Price } from '#types';

import { ecbPrices } from './fx';
import {
  amount,
  array,
  object,
  parseExactJson,
  string,
  timestamp,
} from './json';

export type PriceSource = {
  current(assets: string[], quote: string): Promise<Price[]>;
  historical(assets: string[], quote: string, at: number): Promise<Price[]>;
};

/** Public market data is independent of private account adapters and credentials. */
export function createPriceSource(fetcher = globalThis.fetch): PriceSource {
  async function get(url: string) {
    const response = await fetcher(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Market data unavailable');
    return parseExactJson(await response.text());
  }
  return {
    async current(assets, quote) {
      if (quote !== 'ZAR') throw new Error('No configured quote source');
      const now = Date.now();
      const rows = array(
        object(await get('https://api.luno.com/api/1/tickers')).tickers,
      );
      const direct = new Map<string, Price>();
      for (const row of rows) {
        const pair = string(row.pair);
        if (!pair.endsWith('ZAR')) continue;
        const symbol = pair.slice(0, -3) === 'XBT' ? 'BTC' : pair.slice(0, -3);
        const price = amount(row.last_trade);
        if (new Exact(price).greaterThan(0)) {
          direct.set(symbol, {
            asset: symbol,
            quote,
            price,
            timestamp: timestamp(row.timestamp),
            source: `Luno ${pair}`,
          });
        }
      }
      const prices: Price[] = [
        { asset: 'ZAR', quote, price: '1', timestamp: now, source: 'identity' },
      ];
      const usdt = direct.get('USDT');
      let binancePrices: Record<string, unknown>[] = [];
      if (usdt && assets.some(a => a !== 'ZAR' && !direct.has(a))) {
        binancePrices = array(
          await get('https://api.binance.com/api/v3/ticker/price'),
        );
      }
      for (const asset of new Set(assets)) {
        const local = direct.get(asset);
        if (local) {
          prices.push(local);
          continue;
        }
        const pair = binancePrices.find(row => row.symbol === asset + 'USDT');
        if (pair && usdt) {
          prices.push({
            asset,
            quote,
            price: new Exact(amount(pair.price)).times(usdt.price).toFixed(),
            timestamp: Math.min(now, usdt.timestamp),
            source: `Binance ${asset}USDT × ${usdt.source}`,
          });
        }
      }
      try {
        prices.push(...(await ecbPrices(assets, now, false, fetcher)));
      } catch {
        /* Unavailable FX stays unpriced. */
      }
      return prices;
    },
    async historical(assets, quote, at) {
      if (quote !== 'ZAR') throw new Error('No configured quote source');
      const prices: Price[] = [
        { asset: 'ZAR', quote, price: '1', timestamp: at, source: 'identity' },
      ];
      // Daily candles are explicitly timestamped at CLOSE, never at their opening time.
      const from = at - 7 * 86400000;
      for (const asset of new Set([...assets, 'USDT'])) {
        if (asset === 'ZAR') continue;
        const pair = (asset === 'BTC' ? 'XBT' : asset) + 'ZAR';
        try {
          const candles = array(
            object(
              await get(
                `https://api.luno.com/api/exchange/1/candles?pair=${encodeURIComponent(pair)}&since=${from}&duration=86400`,
              ),
            ).candles,
          );
          const candle = candles
            .filter(c => timestamp(c.timestamp) + 86400000 <= at)
            .at(-1);
          if (candle) {
            prices.push({
              asset,
              quote,
              price: amount(candle.close),
              timestamp: timestamp(candle.timestamp) + 86400000,
              source: `Luno ${pair} daily close`,
            });
          }
        } catch {
          /* A missing quote is explicit in valuation; never substitute today's price. */
        }
      }
      for (const asset of new Set([...assets, 'USDT'])) {
        if (
          prices.some(p => p.asset === asset) ||
          !/^[A-Z0-9]{1,30}$/.test(asset)
        ) {
          continue;
        }
        try {
          const candles = array(
            await get(
              `https://api.valr.com/v1/public/${asset}ZAR/buckets?periodSeconds=86400&startTime=${Math.floor(from / 1000)}&endTime=${Math.floor(at / 1000)}&limit=7&includeEmpty=true`,
            ),
          );
          const candle = candles
            .filter(c => timestamp(c.startTime) + 86400000 <= at)
            .at(-1);
          if (candle) {
            prices.push({
              asset,
              quote,
              price: amount(candle.close),
              timestamp: timestamp(candle.startTime) + 86400000,
              source: `VALR ${asset}ZAR daily close`,
            });
          }
        } catch {
          /* Unsupported local markets continue to the cross-rate source. */
        }
      }
      try {
        prices.push(...(await ecbPrices(assets, at, true, fetcher)));
      } catch {
        /* Historical FX remains unavailable. */
      }
      const usdt = prices.find(p => p.asset === 'USDT');
      if (usdt) {
        for (const asset of new Set(assets)) {
          if (
            prices.some(p => p.asset === asset) ||
            !/^[A-Z0-9]{1,30}$/.test(asset)
          ) {
            continue;
          }
          try {
            const response = await get(
              `https://api.binance.com/api/v3/klines?symbol=${asset}USDT&interval=1d&endTime=${at}&limit=2`,
            );
            if (!Array.isArray(response)) continue;
            const row = response
              .filter(
                (r): r is unknown[] =>
                  Array.isArray(r) && timestamp(r[6]) <= at,
              )
              .at(-1);
            if (row) {
              prices.push({
                asset,
                quote,
                price: new Exact(amount(row[4])).times(usdt.price).toFixed(),
                timestamp: Math.min(timestamp(row[6]), usdt.timestamp),
                source: `Binance ${asset}USDT daily close × ${usdt.source}`,
              });
            }
          } catch {
            /* Unavailable historical instruments remain unpriced. */
          }
        }
      }
      return prices;
    },
  };
}
