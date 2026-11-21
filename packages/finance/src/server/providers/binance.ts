import { add, negate } from '#decimal';
import { createCollector } from '#server/collector';
import type { AdapterRegistration, Resource } from '#server/contracts';
import { collectHistory } from '#server/history';
import { amount, array, asset, object, string, timestamp } from '#server/json';
import { signBinance } from '#server/transport';

const spot = (path: string): Resource => ({ path });
const futures = (path: string): Resource => ({ path, host: 'futures' });

export const binance: AdapterRegistration = {
  definition: {
    id: 'binance',
    name: 'Binance',
    passphrase: false,
    products: [
      'spot',
      'funding',
      'margin',
      'isolated-margin',
      'futures',
      'earn',
      'staking',
      'subaccounts',
    ],
  },
  transport: {
    hosts: {
      spot: 'https://api.binance.com',
      futures: 'https://fapi.binance.com',
      'coin-futures': 'https://dapi.binance.com',
    },
    signer: signBinance,
    clock: {
      resource: { path: '/api/v3/time', public: true },
      read: value => timestamp(object(value).serverTime),
    },
  },
  resources: [
    { path: '/api/v3/ticker/price', public: true },
    { path: '/api/v3/exchangeInfo', public: true },
    { path: '/api/v3/time', public: true },
    spot('/api/v3/account'),
    spot('/api/v3/myTrades'),
    { path: '/sapi/v1/asset/get-funding-asset', method: 'POST' },
    spot('/sapi/v1/margin/account'),
    spot('/sapi/v1/margin/isolated/account'),
    spot('/sapi/v1/margin/interestHistory'),
    spot('/sapi/v1/margin/borrow-repay'),
    futures('/fapi/v3/account'),
    futures('/fapi/v1/income'),
    futures('/fapi/v1/userTrades'),
    { path: '/dapi/v1/account', host: 'coin-futures' },
    { path: '/dapi/v1/income', host: 'coin-futures' },
    spot('/sapi/v1/simple-earn/flexible/position'),
    spot('/sapi/v1/simple-earn/locked/position'),
    spot('/sapi/v1/simple-earn/flexible/history/rewardsRecord'),
    spot('/sapi/v1/simple-earn/locked/history/rewardsRecord'),
    spot('/sapi/v1/capital/deposit/hisrec'),
    spot('/sapi/v1/capital/withdraw/history'),
    spot('/sapi/v1/asset/transfer'),
    spot('/sapi/v1/convert/tradeFlow'),
    spot('/sapi/v1/sub-account/list'),
    spot('/sapi/v3/sub-account/assets'),
    spot('/sapi/v1/pay/transactions'),
    spot('/sapi/v1/fiat/orders'),
  ],
  create: ({ request }) => ({
    definition: binance.definition,
    async collect(options) {
      const c = createCollector(options);
      const account = (id: string, product = id) => {
        if (!c.data.accounts.some(a => a.id === id)) {
          c.data.accounts.push({ id, name: `Binance ${product}`, product });
        }
      };
      await c.stream('spot', async () => {
        const data = object(await request(spot('/api/v3/account')));
        account('spot');
        for (const row of array(data.balances)) {
          c.data.holdings.push({
            accountId: 'spot',
            asset: asset(row.asset),
            quantity: add(amount(row.free), amount(row.locked)),
            available: amount(row.free),
          });
        }
      });
      await c.stream('funding', async () => {
        const data = array(
          await request({
            path: '/sapi/v1/asset/get-funding-asset',
            method: 'POST',
          }),
        );
        account('funding');
        for (const row of data) {
          c.data.holdings.push({
            accountId: 'funding',
            asset: asset(row.asset),
            quantity: add(
              amount(row.free),
              amount(row.locked, '0'),
              amount(row.freeze, '0'),
              amount(row.withdrawing, '0'),
            ),
            available: amount(row.free),
          });
        }
      });
      const marginHolding = (id: string, row: Record<string, unknown>) =>
        c.data.holdings.push({
          accountId: id,
          asset: asset(row.asset),
          quantity: add(amount(row.free), amount(row.locked)),
          available: amount(row.free),
          debt: add(amount(row.borrowed), amount(row.interest)),
        });
      await c.stream('margin', async () => {
        const rows = array(
          object(await request(spot('/sapi/v1/margin/account'))).userAssets,
        );
        account('margin');
        rows.forEach(row => marginHolding('margin', row));
      });
      await c.stream('isolated-margin', async () => {
        const rows = array(
          object(await request(spot('/sapi/v1/margin/isolated/account')))
            .assets,
        );
        for (const row of rows) {
          const id = `isolated:${string(row.symbol)}`;
          account(id, 'isolated-margin');
          marginHolding(id, object(row.baseAsset));
          marginHolding(id, object(row.quoteAsset));
        }
      });
      for (const [id, resource] of [
        ['futures', futures('/fapi/v3/account')],
        ['coin-futures', { path: '/dapi/v1/account', host: 'coin-futures' }],
      ] as const) {
        await c.stream(id, async () => {
          const data = object(await request(resource));
          account(id);
          for (const row of array(data.assets)) {
            c.data.holdings.push({
              accountId: id,
              asset: asset(row.asset),
              quantity: amount(row.walletBalance),
              unrealizedPnl: amount(row.unrealizedProfit, '0'),
            });
          }
          for (const row of array(data.positions)) {
            if (amount(row.positionAmt) !== '0') {
              c.data.positions.push({
                id: `${id}:${string(row.symbol)}:${string(row.positionSide)}`,
                accountId: id,
                symbol: string(row.symbol),
                settlementAsset:
                  typeof row.marginAsset === 'string'
                    ? asset(row.marginAsset)
                    : id === 'futures'
                      ? 'USDT'
                      : 'UNKNOWN',
                quantity: amount(row.positionAmt),
                entryPrice: amount(row.entryPrice, '0'),
                unrealizedPnl: amount(row.unrealizedProfit, '0'),
                side: string(row.positionSide),
              });
            }
          }
        });
        const path = id === 'futures' ? '/fapi/v1/income' : '/dapi/v1/income';
        await c.stream(`${id}:income`, async () => {
          const rows = array(
            await request(
              { path, host: resource.host },
              {
                startTime: Math.max(
                  options.from,
                  options.through - 89 * 86400000,
                ),
                endTime: options.through,
                limit: 1000,
              },
            ),
          );
          c.data.events.push(
            ...rows.map(row => ({
              id: `${id}:${string(row.incomeType)}:${string(row.tranId)}`,
              accountId: id,
              stream: `${id}:income`,
              timestamp: timestamp(row.time),
              type: string(row.incomeType),
              status: 'booked' as const,
              postings: [
                {
                  asset: asset(row.asset),
                  quantity: amount(row.income),
                  role: 'pnl' as const,
                },
              ],
            })),
          );
          c.data.coverage.push({
            stream: `${id}:income`,
            accountId: id,
            status: 'partial',
            reason:
              'Provider retention and page limits apply; import older statements',
            from: Math.max(options.from, options.through - 89 * 86400000),
            through: options.through,
          });
        });
      }
      for (const kind of ['flexible', 'locked']) {
        await c.stream(`earn:${kind}`, async () => {
          const rows = array(
            object(
              await request(spot(`/sapi/v1/simple-earn/${kind}/position`), {
                size: 100,
              }),
            ).rows,
          );
          account(`earn:${kind}`, 'earn');
          for (const row of rows) {
            c.data.holdings.push({
              accountId: `earn:${kind}`,
              asset: asset(row.asset),
              quantity: amount(row.totalAmount ?? row.amount),
            });
          }
          if (rows.length === 100) {
            c.data.coverage.push({
              stream: `earn:${kind}`,
              status: 'partial',
              reason: 'Additional Earn position pages require backfill',
            });
          }
        });
      }
      // LD receipts represent Earn positions, not an additional independently owned asset.
      const earnAssets = new Set(
        c.data.holdings
          .filter(h => h.accountId.startsWith('earn:'))
          .map(h => 'LD' + h.asset),
      );
      c.data.holdings = c.data.holdings.filter(
        h => h.accountId !== 'spot' || !earnAssets.has(h.asset),
      );
      for (const kind of ['flexible', 'locked'] as const) {
        await collectHistory(c, options, {
          id: `rewards:${kind}`,
          accountId: `earn:${kind}`,
          windowMs: 29 * 86400000,
          fetch: async (startTime, endTime, cursor) => {
            const current = Number(cursor ?? 1);
            const data = object(
              await request(
                {
                  path: `/sapi/v1/simple-earn/${kind}/history/rewardsRecord`,
                  minIntervalMs: 2000,
                },
                {
                  startTime,
                  endTime,
                  current,
                  size: 100,
                  type: kind === 'flexible' ? 'ALL' : undefined,
                },
              ),
            );
            const rows = array(data.rows);
            return {
              events: rows.map(row => ({
                id: `reward:${kind}:${string(row.positionId ?? row.projectId ?? row.asset)}:${string(row.time)}:${string(row.type)}`,
                accountId: `earn:${kind}`,
                stream: `rewards:${kind}`,
                timestamp: timestamp(row.time),
                type: 'staking-reward',
                status: 'booked' as const,
                postings: [
                  {
                    asset: asset(row.asset),
                    quantity: amount(row.rewards ?? row.amount),
                    role: 'reward' as const,
                  },
                ],
              })),
              next: rows.length === 100 ? String(current + 1) : undefined,
            };
          },
        });
      }
      const markets = new Map<string, { base: string; quote: string }>();
      const discovered: string[] = [];
      await c.stream('market-discovery', async () => {
        const catalog = array(
          await request({ path: '/api/v3/ticker/price', public: true }),
        );
        const offset = Number(options.cursors['market-discovery'] ?? '0');
        if (!Number.isSafeInteger(offset) || offset < 0) {
          throw new Error('Invalid discovery cursor');
        }
        discovered.push(
          ...catalog.slice(offset, offset + 50).map(row => string(row.symbol)),
        );
        c.data.cursors['market-discovery'] = String(
          offset + 50 >= catalog.length ? 0 : offset + 50,
        );
      });
      const known = Object.keys(options.cursors)
        .filter(key => key.startsWith('trades:'))
        .map(key => key.slice(7));
      const candidates = [
        ...new Set([
          ...options.symbols,
          ...known,
          ...c.data.holdings
            .filter(
              h =>
                h.quantity !== '0' &&
                h.asset !== 'USDT' &&
                /^[A-Z0-9]{1,30}$/.test(h.asset),
            )
            .map(h => h.asset + 'USDT'),
          ...discovered,
        ]),
      ];
      for (const symbol of candidates) {
        await c.stream(`market:${symbol}`, async () => {
          for (const row of array(
            object(
              await request(
                { path: '/api/v3/exchangeInfo', public: true },
                { symbol, showPermissionSets: false },
              ),
            ).symbols,
          )) {
            markets.set(string(row.symbol), {
              base: asset(row.baseAsset),
              quote: asset(row.quoteAsset),
            });
          }
        });
      }
      const symbols = [...markets.keys()];
      for (const symbol of symbols) {
        await c.pages(
          `trades:${symbol}`,
          async cursor => {
            const market = markets.get(symbol);
            if (!market) {
              throw new Error('Historical instrument metadata is unavailable');
            }
            const rows = array(
              await request(spot('/api/v3/myTrades'), {
                symbol,
                fromId: cursor ?? '0',
                limit: 1000,
              }),
            );
            return {
              events: rows.map(row => ({
                id: `trade:${symbol}:${string(row.id)}`,
                accountId: 'spot',
                stream: `trades:${symbol}`,
                timestamp: timestamp(row.time),
                type: 'trade',
                status: 'booked' as const,
                reference: string(row.orderId),
                description: symbol,
                postings: [
                  {
                    asset: market.base,
                    quantity:
                      row.isBuyer === true
                        ? amount(row.qty)
                        : negate(amount(row.qty)),
                    role: 'principal' as const,
                  },
                  {
                    asset: market.quote,
                    quantity:
                      row.isBuyer === true
                        ? negate(amount(row.quoteQty))
                        : amount(row.quoteQty),
                    role: 'principal' as const,
                  },
                  {
                    asset: asset(row.commissionAsset),
                    quantity: negate(amount(row.commission)),
                    role: 'fee' as const,
                  },
                ],
              })),
              cursor: rows.length
                ? String(BigInt(string(rows[rows.length - 1].id)) + 1n)
                : cursor,
              exhausted: rows.length < 1000,
            };
          },
          'spot',
        );
      }
      c.data.coverage.push({
        stream: 'symbol-inventory',
        status: 'partial',
        reason:
          'Available markets are scanned in bounded batches, including sold assets. Delisted pairs still require statement or explicit symbol backfill.',
      });
      for (const kind of ['deposit', 'withdraw'] as const) {
        const path =
          kind === 'deposit'
            ? '/sapi/v1/capital/deposit/hisrec'
            : '/sapi/v1/capital/withdraw/history';
        await collectHistory(c, options, {
          id: `capital:${kind}`,
          accountId: 'spot',
          windowMs: 89 * 86400000,
          fetch: async (startTime, endTime, cursor) => {
            const offset = Number(cursor ?? 0);
            const rows = array(
              await request(spot(path), {
                startTime,
                endTime,
                offset,
                limit: 1000,
              }),
            );
            return {
              events: rows
                .filter(row =>
                  kind === 'deposit'
                    ? ['1', '6'].includes(string(row.status))
                    : string(row.status) === '6',
                )
                .map(row => ({
                  id: `${kind}:${string(row.id)}`,
                  accountId: row.walletType === '1' ? 'funding' : 'spot',
                  stream: `capital:${kind}`,
                  timestamp: timestamp(
                    row.insertTime ?? row.completeTime ?? row.applyTime,
                  ),
                  type: kind,
                  status: 'booked' as const,
                  transactionHash:
                    typeof row.txId === 'string' ? row.txId : undefined,
                  postings: [
                    {
                      asset: asset(row.coin),
                      quantity:
                        kind === 'deposit'
                          ? amount(row.amount)
                          : negate(amount(row.amount)),
                      role: 'principal' as const,
                    },
                    ...(kind === 'withdraw'
                      ? [
                          {
                            asset: asset(row.coin),
                            quantity: negate(amount(row.transactionFee, '0')),
                            role: 'fee' as const,
                          },
                        ]
                      : []),
                  ],
                })),
              next:
                rows.length === 1000 ? String(offset + rows.length) : undefined,
            };
          },
        });
      }
      await c.stream('subaccounts', async () => {
        const rows = array(
          object(
            await request(spot('/sapi/v1/sub-account/list'), { limit: 200 }),
          ).subAccounts,
        );
        for (const row of rows) {
          const email = string(row.email);
          const id = `sub:${email}`;
          c.data.accounts.push({
            id,
            name: 'Binance subaccount',
            product: 'subaccount',
            parentId: 'spot',
          });
          await c.stream(
            `assets:${id}`,
            async () => {
              for (const balance of array(
                object(
                  await request(spot('/sapi/v3/sub-account/assets'), { email }),
                ).balances,
              )) {
                c.data.holdings.push({
                  accountId: id,
                  asset: asset(balance.asset),
                  quantity: add(amount(balance.free), amount(balance.locked)),
                });
              }
            },
            { accountId: id },
          );
        }
        if (rows.length) {
          c.unsupported(
            'subaccount-history',
            'Add read-only child credentials for complete product history; master balances do not include child ledgers',
          );
        }
      });
      return c.finish();
    },
  }),
};
