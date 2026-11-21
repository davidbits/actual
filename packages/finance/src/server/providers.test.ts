import { describe, expect, it } from 'vitest';

import { binance } from './providers/binance';
import { bitget } from './providers/bitget';
import { luno } from './providers/luno';
import { valr } from './providers/valr';
import { ProviderError } from './transport';

const options = {
  from: 0,
  through: 1000,
  cursors: {},
  symbols: [],
  maxPages: 2,
};

describe('provider account and paging contracts', () => {
  it('discovers sold Binance symbols and preserves the three legs of spot fills', async () => {
    const adapter = binance.create({
      request: async (resource, params) => {
        if (resource.path === '/api/v3/ticker/price') {
          return [{ symbol: 'SOLDUSDT' }];
        }
        if (resource.path === '/api/v3/exchangeInfo') {
          return {
            symbols: [
              { symbol: params?.symbol, baseAsset: 'SOLD', quoteAsset: 'USDT' },
            ],
          };
        }
        if (resource.path === '/api/v3/myTrades') {
          return [
            {
              id: '9007199254740995',
              orderId: 'order',
              time: '1',
              isBuyer: false,
              qty: '0.001',
              quoteQty: '10',
              commission: '0.01',
              commissionAsset: 'USDT',
            },
          ];
        }
        if (resource.path === '/api/v3/account') return { balances: [] };
        throw new ProviderError('unavailable', 403);
      },
    });
    const data = await adapter.collect(options);
    expect(data.events[0].postings.map(p => p.quantity)).toEqual([
      '-0.001',
      '10',
      '-0.01',
    ]);
    expect(data.cursors['trades:SOLDUSDT']).toBe('9007199254740996');
    expect(data.cursors['market-discovery']).toBe('0');
  });
  it('keeps same-currency Luno wallets distinct and handles empty nullable lists', async () => {
    const adapter = luno.create({
      request: async resource => {
        if (resource.path === '/api/1/balance') {
          return {
            balance: [
              {
                account_id: '1',
                asset: 'XBT',
                balance: '0.1',
                reserved: '0',
                account_type: 'SPOT',
              },
              {
                account_id: '2',
                asset: 'XBT',
                balance: '0.2',
                reserved: '0',
                account_type: 'STAKING',
              },
            ],
          };
        }
        if (resource.path.endsWith('/pending')) return { pending: null };
        return { transactions: null };
      },
    });
    const data = await adapter.collect(options);
    expect(data.holdings.map(h => [h.accountId, h.asset, h.quantity])).toEqual([
      ['1', 'BTC', '0.1'],
      ['2', 'BTC', '0.2'],
    ]);
    expect(data.coverage.every(c => c.status === 'ok')).toBe(true);
  });
  it('never marks a truncated Luno page complete or advances past missing rows', async () => {
    const adapter = luno.create({
      request: async resource => {
        if (resource.path.endsWith('/balance')) {
          return {
            balance: [
              { account_id: '1', asset: 'ZAR', balance: '1000', reserved: '0' },
            ],
          };
        }
        if (resource.path.endsWith('/pending')) return { pending: null };
        return {
          transactions: Array.from({ length: 1000 }, (_, i) => ({
            row_index: String(i + 1),
            timestamp: '1',
            currency: 'ZAR',
            balance_delta: '1',
          })),
        };
      },
    });
    const data = await adapter.collect({ ...options, maxPages: 1 });
    expect(data.cursors['ledger:1']).toBe('1001');
    expect(data.coverage.find(c => c.stream === 'ledger:1')?.status).toBe(
      'partial',
    );
  });
  it('does not duplicate VALR primary account returned by discovery', async () => {
    const adapter = valr.create({
      request: async resource => {
        if (resource.path.endsWith('/subaccounts')) {
          return [{ id: '0' }, { id: 'child', label: 'Synthetic child' }];
        }
        if (resource.path.endsWith('/balances')) {
          return [{ currency: 'ZAR', total: '1', available: '1' }];
        }
        return [];
      },
    });
    const data = await adapter.collect(options);
    expect(data.accounts.map(a => a.id)).toEqual(['main', 'child']);
    expect(data.holdings).toHaveLength(2);
  });
  it('does not downgrade Bitget mode after an authentication or network error', async () => {
    const paths: string[] = [];
    const adapter = bitget.create({
      request: async resource => {
        paths.push(resource.path);
        throw new ProviderError('40009', 400);
      },
    });
    const data = await adapter.collect(options);
    expect(paths).toEqual(['/api/v3/account/info']);
    expect(data.coverage[0].status).toBe('error');
  });
});
