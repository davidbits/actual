import { Exact } from '#decimal';
import type { Price } from '#types';

import { amount, array, object, string, timestamp } from './json';

type Get = (url: string) => Promise<unknown>;
export type MarketPriceProvider = {
  id: string;
  current(assets: string[], get: Get, at: number): Promise<Price[]>;
  historical(assets: string[], get: Get, at: number): Promise<Price[]>;
};

function krakenResult(value: unknown) {
  const response = object(value);
  if (!Array.isArray(response.error) || response.error.length) {
    throw new Error('Kraken market data unavailable');
  }
  return object(response.result);
}

async function stockMarkets(assets: string[], get: Get) {
  const markets = krakenResult(
    await get(
      'https://api.kraken.com/0/public/AssetPairs?aclass_base=tokenized_asset',
    ),
  );
  return Object.entries(markets).flatMap(([key, value]) => {
    const row = object(value);
    const base = string(row.base).toUpperCase();
    const pair = string(row.altname);
    // Use the canonical token market, not a similarly named underlying stock or legacy SPV.
    if (
      row.aclass_base !== 'tokenized_asset' ||
      row.quote !== 'ZUSD' ||
      !assets.includes(base) ||
      (key !== pair && pair in markets)
    ) {
      return [];
    }
    return [{ asset: base, pair, key, label: string(row.wsname) }];
  });
}

export const krakenTokenPrices: MarketPriceProvider = {
  id: 'kraken-tokenized-assets',
  async current(assets, get, at) {
    if (!assets.some(asset => asset.endsWith('X'))) return [];
    const markets = await stockMarkets(assets, get);
    if (!markets.length) return [];
    const tickers = krakenResult(
      await get(
        'https://api.kraken.com/0/public/Ticker?asset_class=tokenized_asset',
      ),
    );
    return markets.flatMap(market => {
      const ticker = tickers[market.pair] ?? tickers[market.key];
      if (!ticker) return [];
      const close = object(ticker).c;
      if (!Array.isArray(close)) return [];
      const price = amount(close[0]);
      return new Exact(price).greaterThan(0)
        ? [
            {
              asset: market.asset,
              quote: 'USD',
              price,
              timestamp: at,
              source: `Kraken xStocks ${market.label}`,
            },
          ]
        : [];
    });
  },
  async historical(assets, get, at) {
    if (!assets.some(asset => asset.endsWith('X'))) return [];
    const markets = await stockMarkets(assets, get);
    const prices: Price[] = [];
    for (const market of markets) {
      try {
        const result = krakenResult(
          await get(
            `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(market.pair)}&asset_class=tokenized_asset&interval=1440&since=${Math.floor((at - 7 * 86400000) / 1000)}`,
          ),
        );
        const rows = result[market.pair] ?? result[market.key];
        if (!Array.isArray(rows)) continue;
        const candle = rows
          .filter(
            (row): row is unknown[] =>
              Array.isArray(row) && timestamp(row[0]) * 1000 + 86400000 <= at,
          )
          .sort((a, b) => timestamp(a[0]) - timestamp(b[0]))
          .at(-1);
        if (candle && new Exact(amount(candle[4])).greaterThan(0)) {
          prices.push({
            asset: market.asset,
            quote: 'USD',
            price: amount(candle[4]),
            timestamp: timestamp(candle[0]) * 1000 + 86400000,
            source: `Kraken xStocks ${market.label} daily close`,
          });
        }
      } catch {
        /* One unavailable token must not hide other historical quotes. */
      }
    }
    return prices;
  },
};

export const bitgetSpotPrices: MarketPriceProvider = {
  id: 'bitget-spot',
  async current(assets, get) {
    const response = object(
      await get('https://api.bitget.com/api/v2/spot/market/tickers'),
    );
    if (response.code !== '00000') {
      throw new Error('Bitget market data unavailable');
    }
    return array(response.data).flatMap(row => {
      const symbol = string(row.symbol);
      const asset = symbol.endsWith('USDT') ? symbol.slice(0, -4) : '';
      if (
        !assets.includes(asset) ||
        !new Exact(amount(row.lastPr)).greaterThan(0)
      ) {
        return [];
      }
      return [
        {
          asset,
          quote: 'USDT',
          price: amount(row.lastPr),
          timestamp: timestamp(row.ts),
          source: `Bitget ${symbol}`,
        },
      ];
    });
  },
  async historical(assets, get, at) {
    const prices: Price[] = [];
    for (const asset of assets.filter(a => /^[A-Z0-9]{1,30}$/.test(a))) {
      try {
        const response = object(
          await get(
            `https://api.bitget.com/api/v2/spot/market/history-candles?symbol=${asset}USDT&granularity=1Dutc&endTime=${at}&limit=7`,
          ),
        );
        if (response.code !== '00000' || !Array.isArray(response.data)) {
          continue;
        }
        const candle = response.data
          .filter(
            (row): row is unknown[] =>
              Array.isArray(row) && timestamp(row[0]) + 86400000 <= at,
          )
          .sort((a, b) => timestamp(a[0]) - timestamp(b[0]))
          .at(-1);
        if (candle && new Exact(amount(candle[4])).greaterThan(0)) {
          prices.push({
            asset,
            quote: 'USDT',
            price: amount(candle[4]),
            timestamp: timestamp(candle[0]) + 86400000,
            source: `Bitget ${asset}USDT daily close`,
          });
        }
      } catch {
        /* Unsupported and delisted assets remain unpriced. */
      }
    }
    return prices;
  },
};

export function createMarketPriceRegistry(providers: MarketPriceProvider[]) {
  if (new Set(providers.map(p => p.id)).size !== providers.length) {
    throw new Error('Duplicate market price provider');
  }
  return async (
    assets: string[],
    existing: Price[],
    get: Get,
    at: number,
    historical: boolean,
  ) => {
    const result = [...existing];
    for (const provider of providers) {
      const missing = assets.filter(
        asset =>
          !result.some(price => price.asset === asset && price.quote === 'ZAR'),
      );
      if (!missing.length) break;
      try {
        const native = await (historical
          ? provider.historical(missing, get, at)
          : provider.current(missing, get, at));
        for (const price of native) {
          const fx = result
            .filter(
              p =>
                p.asset === price.quote &&
                p.quote === 'ZAR' &&
                p.timestamp <= at,
            )
            .sort((a, b) => b.timestamp - a.timestamp)[0];
          const observedAt = historical ? at : Date.now();
          if (
            !fx ||
            price.timestamp > observedAt ||
            !new Exact(price.price).greaterThan(0) ||
            !new Exact(fx.price).greaterThan(0)
          ) {
            continue;
          }
          result.push({
            ...price,
            quote: 'ZAR',
            price: new Exact(price.price).times(fx.price).toFixed(),
            timestamp: Math.min(price.timestamp, fx.timestamp),
            source: `${price.source} × ${fx.source}`,
          });
        }
      } catch {
        /* Each source fails independently; missing prices remain explicit. */
      }
    }
    return result;
  };
}
