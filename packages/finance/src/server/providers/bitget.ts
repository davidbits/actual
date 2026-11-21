import { add } from '#decimal';
import { createCollector } from '#server/collector';
import type { AdapterRegistration, RequestParams } from '#server/contracts';
import { collectHistory } from '#server/history';
import { amount, array, asset, object, string, timestamp } from '#server/json';
import { ProviderError, signBitget } from '#server/transport';

export const bitget: AdapterRegistration = {
  definition: {
    id: 'bitget',
    name: 'Bitget',
    passphrase: true,
    products: [
      'spot',
      'funding',
      'margin',
      'futures',
      'earn',
      'bots',
      'subaccounts',
    ],
  },
  transport: {
    hosts: { spot: 'https://api.bitget.com' },
    signer: signBitget,
    clock: {
      resource: { path: '/api/v3/market/time', public: true },
      read: value => timestamp(object(object(value).data).serverTime),
    },
  },
  resources: [
    { path: '/api/v3/market/time', public: true },
    ...[
      '/api/v3/account/info',
      '/api/v3/account/assets',
      '/api/v3/account/funding-assets',
      '/api/v3/account/financial-records',
      '/api/v3/account/funding-financial-records',
      '/api/v3/position/current-position',
      '/api/v3/user/sub-list',
      '/api/v3/earn/elite-assets',
      '/api/v3/earn/elite-records',
      '/api/v2/spot/account/info',
      '/api/v2/spot/account/assets',
      '/api/v2/spot/account/bills',
      '/api/v2/mix/account/accounts',
      '/api/v2/mix/account/bill',
      '/api/v2/mix/position/all-position',
      '/api/v2/margin/crossed/account/assets',
      '/api/v2/margin/isolated/account/assets',
      '/api/v2/account/bot-assets',
      '/api/v2/spot/account/subaccount-assets',
      '/api/v2/earn/savings/assets',
      '/api/v2/earn/savings/records',
    ].map(path => ({ path })),
  ],
  create: ({ request }) => ({
    definition: bitget.definition,
    async collect(options) {
      const c = createCollector(options);
      const get = async (path: string, params?: RequestParams) =>
        object(await request({ path }, params)).data;
      let unified = false;
      await c.stream('account-mode', async () => {
        try {
          await get('/api/v3/account/info');
          unified = true;
        } catch (error) {
          // Only known version/mode failures permit a separately authenticated classic probe.
          if (
            !(error instanceof ProviderError) ||
            !['40084', '25245'].includes(error.code)
          ) {
            throw error;
          }
          await get('/api/v2/spot/account/info');
        }
      });
      if (c.data.coverage.some(row => row.status === 'error')) {
        return c.finish();
      }
      const account = (id: string, product = id) => {
        if (!c.data.accounts.some(a => a.id === id)) {
          c.data.accounts.push({ id, name: `Bitget ${product}`, product });
        }
      };
      if (unified) {
        await c.stream('unified', async () => {
          const rows = array(
            object(await get('/api/v3/account/assets')).assets,
          );
          account('unified');
          for (const row of rows) {
            c.data.holdings.push({
              accountId: 'unified',
              asset: asset(row.coin),
              quantity: amount(row.equity),
              available: amount(row.available, '0'),
            });
          }
        });
        await c.stream('funding', async () => {
          const rows = array(await get('/api/v3/account/funding-assets'));
          account('funding');
          for (const row of rows) {
            c.data.holdings.push({
              accountId: 'funding',
              asset: asset(row.coin),
              quantity: add(amount(row.available), amount(row.frozen, '0')),
            });
          }
        });
      } else {
        await c.stream('spot', async () => {
          const rows = array(
            await get('/api/v2/spot/account/assets', { assetType: 'all' }),
          );
          account('spot');
          for (const row of rows) {
            c.data.holdings.push({
              accountId: 'spot',
              asset: asset(row.coin),
              quantity: add(
                amount(row.available),
                amount(row.frozen, '0'),
                amount(row.locked, '0'),
              ),
              available: amount(row.available),
            });
          }
        });
        for (const productType of [
          'USDT-FUTURES',
          'USDC-FUTURES',
          'COIN-FUTURES',
        ]) {
          await c.stream(productType, async () => {
            const rows = array(
              await get('/api/v2/mix/account/accounts', { productType }),
            );
            account(productType, 'futures');
            for (const row of rows) {
              c.data.holdings.push({
                accountId: productType,
                asset: asset(row.marginCoin),
                quantity: amount(row.accountEquity),
                available: amount(row.available, '0'),
              });
            }
          });
        }
        await c.stream('cross-margin', async () => {
          const rows = array(
            await get('/api/v2/margin/crossed/account/assets'),
          );
          account('cross-margin', 'margin');
          for (const row of rows) {
            c.data.holdings.push({
              accountId: 'cross-margin',
              asset: asset(row.coin),
              quantity: add(amount(row.available), amount(row.frozen, '0')),
              debt: add(amount(row.borrow, '0'), amount(row.interest, '0')),
            });
          }
        });
        await c.stream('isolated-margin', async () => {
          const rows = array(
            await get('/api/v2/margin/isolated/account/assets'),
          );
          for (const row of rows) {
            const id = `isolated:${string(row.symbol)}`;
            account(id, 'isolated-margin');
            c.data.holdings.push({
              accountId: id,
              asset: asset(row.coin),
              quantity: add(amount(row.available), amount(row.frozen, '0')),
              debt: add(amount(row.borrow, '0'), amount(row.interest, '0')),
            });
          }
        });
        for (const periodType of ['flexible', 'fixed']) {
          await c.stream(`savings:${periodType}`, async () => {
            const response = object(
              await get('/api/v2/earn/savings/assets', {
                periodType,
                limit: 100,
              }),
            );
            const rows = array(response.resultList);
            account(`savings:${periodType}`, 'earn');
            for (const row of rows) {
              c.data.holdings.push({
                accountId: `savings:${periodType}`,
                asset: asset(row.coin),
                quantity: amount(row.holdAmount),
              });
            }
          });
        }
      }
      const categories = unified
        ? [
            'SPOT',
            'MARGIN',
            'USDT-FUTURES',
            'COIN-FUTURES',
            'USDC-FUTURES',
            'OTHER',
          ]
        : ['SPOT', 'USDT-FUTURES', 'COIN-FUTURES', 'USDC-FUTURES'];
      for (const category of categories) {
        const id = unified
          ? 'unified'
          : category === 'SPOT'
            ? 'spot'
            : category;
        const path = unified
          ? '/api/v3/account/financial-records'
          : category === 'SPOT'
            ? '/api/v2/spot/account/bills'
            : '/api/v2/mix/account/bill';
        await collectHistory(c, options, {
          id: `bills:${category}`,
          accountId: id,
          windowMs: 29 * 86400000,
          retentionMs: 89 * 86400000,
          fetch: async (startTime, endTime, cursor) => {
            const data = await get(path, {
              ...(unified
                ? { category, cursor }
                : {
                    productType: category === 'SPOT' ? undefined : category,
                    idLessThan: cursor,
                  }),
              startTime,
              endTime,
              limit: 100,
            });
            const rows = array(
              Array.isArray(data)
                ? data
                : object(data)[unified ? 'list' : 'bills'],
            );
            const end = Array.isArray(data)
              ? rows.at(-1)?.billId
              : object(data)[unified ? 'cursor' : 'endId'];
            return {
              events: rows.map(row => ({
                id: `${category}:${string(row.billId ?? row.id)}`,
                accountId: id,
                stream: `bills:${category}`,
                timestamp: timestamp(row.cTime ?? row.ts),
                type: string(row.businessType ?? row.type),
                status: 'booked' as const,
                postings: [
                  {
                    asset: asset(row.coin),
                    quantity: amount(row.size ?? row.amount),
                    role: 'principal' as const,
                  },
                ],
              })),
              next:
                rows.length === 100 && end != null ? string(end) : undefined,
            };
          },
        });
      }
      if (!unified) {
        for (const productType of [
          'USDT-FUTURES',
          'USDC-FUTURES',
          'COIN-FUTURES',
        ]) {
          await c.stream(
            `positions:${productType}`,
            async () => {
              for (const row of array(
                await get('/api/v2/mix/position/all-position', { productType }),
              )) {
                if (amount(row.total) === '0') continue;
                c.data.positions.push({
                  id: `${productType}:${string(row.symbol)}:${string(row.holdSide)}`,
                  accountId: productType,
                  symbol: string(row.symbol),
                  settlementAsset: asset(row.marginCoin),
                  quantity: amount(row.total),
                  entryPrice: amount(row.openPriceAvg),
                  markPrice:
                    row.markPrice === undefined
                      ? undefined
                      : amount(row.markPrice),
                  unrealizedPnl: amount(row.unrealizedPL),
                  side: string(row.holdSide),
                });
              }
            },
            { accountId: productType },
          );
        }
        await c.stream('subaccounts', async () => {
          let cursor: string | undefined;
          for (let page = 0; page < (options.maxPages ?? 10); page++) {
            const rows = array(
              await get('/api/v2/spot/account/subaccount-assets', {
                limit: 50,
                idLessThan: cursor,
              }),
            );
            for (const row of rows) {
              const id = `sub:${string(row.userId)}`;
              if (!c.data.accounts.some(a => a.id === id)) {
                c.data.accounts.push({
                  id,
                  name: 'Bitget subaccount',
                  parentId: 'spot',
                  product: 'subaccount',
                });
              }
              for (const balance of array(row.assetsList)) {
                c.data.holdings.push({
                  accountId: id,
                  asset: asset(balance.coin),
                  quantity: add(
                    amount(balance.available),
                    amount(balance.frozen, '0'),
                    amount(balance.locked, '0'),
                  ),
                });
              }
            }
            if (rows.length < 50) return;
            const next = string(rows[rows.length - 1].id);
            if (next === cursor) {
              throw new Error('Subaccount cursor did not advance');
            }
            cursor = next;
          }
          c.data.coverage.push({
            stream: 'subaccounts',
            status: 'partial',
            reason: 'More child-account pages remain',
          });
        });
        await c.stream('bot-assets', async () => {
          const rows = array(await get('/api/v2/account/bot-assets'));
          for (const row of rows) {
            const id = `bot:${string(row.botType)}`;
            account(id, 'bot');
            for (const balance of array(row.assetList ?? row.assetsList)) {
              c.data.holdings.push({
                accountId: id,
                asset: asset(balance.coin),
                quantity: amount(balance.equity ?? balance.totalAmount),
              });
            }
          }
        });
      }
      return c.finish();
    },
  }),
};
