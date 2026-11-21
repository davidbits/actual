import { expect, it } from 'vitest';

import {
  bitgetSpotPrices,
  createMarketPriceRegistry,
  krakenTokenPrices,
} from './market-prices';

const fx = [
  {
    asset: 'USD',
    quote: 'ZAR',
    price: '20',
    timestamp: 100,
    source: 'synthetic FX',
  },
];
const stockMarket = {
  aclass_base: 'tokenized_asset',
  base: 'MSFTx',
  quote: 'ZUSD',
  altname: 'MSFTxUSD',
  wsname: 'MSFTx/USD',
};

it('discovers token markets and values xStocks without substituting their underlying shares', async () => {
  const urls: string[] = [];
  const get = async (url: string) => {
    urls.push(url);
    return {
      error: [],
      result: url.includes('AssetPairs')
        ? { MSFTSPVUSD: stockMarket, MSFTxUSD: stockMarket }
        : { MSFTxUSD: { c: ['12.5', '1'] }, MSFTSPVUSD: { c: ['99', '1'] } },
    };
  };
  const prices = await createMarketPriceRegistry([krakenTokenPrices])(
    ['MSFTX'],
    fx,
    get,
    200,
    false,
  );
  expect(prices.filter(p => p.asset === 'MSFTX')).toEqual([
    {
      asset: 'MSFTX',
      quote: 'ZAR',
      price: '250',
      timestamp: 100,
      source: 'Kraken xStocks MSFTx/USD × synthetic FX',
    },
  ]);
  expect(urls[1]).toContain('asset_class=tokenized_asset');
});

it('requires an observed USD/ZAR rate instead of treating USD as USDT', async () => {
  const provider = {
    id: 'fixture',
    current: async () => [
      {
        asset: 'TOKENX',
        quote: 'USD',
        price: '10',
        timestamp: 100,
        source: 'fixture',
      },
    ],
    historical: async () => [],
  };
  expect(
    await createMarketPriceRegistry([provider])(
      ['TOKENX'],
      [],
      async () => ({}),
      200,
      false,
    ),
  ).toEqual([]);
});

it('rejects unclosed stock candles and preserves exact historical FX observation', async () => {
  const at = 3 * 86400000;
  const get = async (url: string) => ({
    error: [],
    result: url.includes('AssetPairs')
      ? { MSFTxUSD: stockMarket }
      : {
          MSFTxUSD: [
            [86400, '0', '0', '0', '4'],
            [3 * 86400, '0', '0', '0', '999'],
          ],
        },
  });
  const prices = await createMarketPriceRegistry([krakenTokenPrices])(
    ['MSFTX'],
    fx,
    get,
    at,
    true,
  );
  expect(prices.find(p => p.asset === 'MSFTX')?.price).toBe('80');
  expect(prices.find(p => p.asset === 'MSFTX')?.timestamp).toBe(100);
});

it('falls back independently and uses Bitget-listed token prices with observed USDT/ZAR', async () => {
  const fail = {
    id: 'failed',
    current: async () => {
      throw new Error('source outage');
    },
    historical: async () => [],
  };
  const prices = await createMarketPriceRegistry([fail, bitgetSpotPrices])(
    ['BGB', 'UNKNOWN'],
    [{ ...fx[0], asset: 'USDT', price: '19' }],
    async () => ({
      code: '00000',
      data: [{ symbol: 'BGBUSDT', lastPr: '2', ts: '100' }],
    }),
    200,
    false,
  );
  expect(prices.find(p => p.asset === 'BGB')?.price).toBe('38');
  expect(prices.find(p => p.asset === 'UNKNOWN')).toBeUndefined();
});
