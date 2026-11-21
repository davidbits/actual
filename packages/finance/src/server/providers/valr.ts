import { negate } from '#decimal';
import { createCollector } from '#server/collector';
import type { AdapterRegistration } from '#server/contracts';
import { amount, array, asset, object, string, timestamp } from '#server/json';
import { signValr } from '#server/transport';
import type { Posting } from '#types';

export const valr: AdapterRegistration = {
  definition: {
    id: 'valr',
    name: 'VALR',
    passphrase: false,
    products: ['spot', 'earn', 'margin', 'futures', 'subaccounts'],
  },
  transport: {
    hosts: { spot: 'https://api.valr.com' },
    signer: signValr,
    clock: {
      resource: { path: '/v1/public/time', public: true },
      read: value => Number(object(value).epochTime) * 1000,
    },
  },
  resources: [
    { path: '/v1/public/time', public: true },
    { path: '/v1/account/subaccounts' },
    { path: '/v1/account/balances' },
    { path: '/v1/account/transactionhistory' },
    { path: '/v1/positions/open' },
    { path: '/v1/perps/positions' },
  ],
  create: ({ request }) => ({
    definition: valr.definition,
    async collect(options) {
      const c = createCollector(options);
      c.data.accounts.push({
        id: 'main',
        name: 'Main account',
        product: 'wallet',
      });
      await c.stream('subaccounts', async () => {
        for (const row of array(
          await request({ path: '/v1/account/subaccounts' }),
        )) {
          if (string(row.id) === '0') continue;
          c.data.accounts.push({
            id: string(row.id),
            name: typeof row.label === 'string' ? row.label : 'Subaccount',
            product: 'subaccount',
            parentId: 'main',
          });
        }
      });
      for (const account of c.data.accounts) {
        const subaccountId = account.id === 'main' ? undefined : account.id;
        await c.stream(
          `balances:${account.id}`,
          async () => {
            for (const row of array(
              await request(
                { path: '/v1/account/balances', subaccountId },
                { excludeZeroBalances: false },
              ),
            )) {
              c.data.holdings.push({
                accountId: account.id,
                asset: asset(row.currency),
                quantity: amount(row.total),
                debt: amount(row.borrowedAmount, '0'),
                available: amount(row.available, '0'),
              });
            }
          },
          { accountId: account.id },
        );
        // Refresh the latest page on every run, even while older history is being paged.
        const normalize = (rows: Record<string, unknown>[]) =>
          rows.map(row => {
            const postings: Posting[] = [];
            if (row.creditCurrency && row.creditValue) {
              postings.push({
                asset: asset(row.creditCurrency),
                quantity: amount(row.creditValue),
                role: 'principal',
              });
            }
            if (row.debitCurrency && row.debitValue) {
              postings.push({
                asset: asset(row.debitCurrency),
                quantity: negate(amount(row.debitValue)),
                role: 'principal',
              });
            }
            if (row.feeCurrency && row.feeValue) {
              postings.push({
                asset: asset(row.feeCurrency),
                quantity: negate(amount(row.feeValue)),
                role: 'fee',
              });
            }
            const type =
              typeof row.transactionType === 'object'
                ? string(object(row.transactionType).type)
                : string(row.transactionType);
            return {
              id: `${account.id}:${string(row.id)}`,
              accountId: account.id,
              stream: `ledger:${account.id}`,
              timestamp: timestamp(row.eventAt ?? row.createdAt),
              type,
              status: 'booked' as const,
              postings,
            };
          });
        const params = {
          startTime: new Date(options.from).toISOString(),
          endTime: new Date(options.through).toISOString(),
          limit: 200,
        };
        await c.stream(`recent:${account.id}`, async () => {
          c.data.events.push(
            ...normalize(
              array(
                await request(
                  { path: '/v1/account/transactionhistory', subaccountId },
                  params,
                ),
              ),
            ),
          );
        });
        await c.pages(
          `ledger:${account.id}`,
          async cursor => {
            const rows = array(
              await request(
                { path: '/v1/account/transactionhistory', subaccountId },
                { ...params, beforeId: cursor || undefined },
              ),
            );
            return {
              events: normalize(rows),
              cursor:
                rows.length === 200 ? string(rows[rows.length - 1].id) : '',
              exhausted: rows.length < 200,
            };
          },
          account.id,
        );
        for (const [kind, path] of [
          ['futures', '/v1/positions/open'],
          ['perps', '/v1/perps/positions'],
        ]) {
          await c.stream(
            `${kind}:${account.id}`,
            async () => {
              const rows = array(await request({ path, subaccountId }));
              for (const row of rows) {
                const symbol = string(
                  row.currencyPair ?? row.pair ?? row.symbol,
                );
                const settlement = asset(
                  row.quoteCurrency ?? row.settlementCurrency,
                );
                const pnl = amount(
                  row.unrealisedPnl ??
                    row.unrealizedPnl ??
                    row.unrealisedProfitLoss,
                );
                c.data.positions.push({
                  id: `${account.id}:${kind}:${symbol}`,
                  accountId: account.id,
                  symbol,
                  settlementAsset: settlement,
                  quantity: amount(row.quantity),
                  entryPrice: amount(row.averageEntryPrice ?? row.entryPrice),
                  markPrice:
                    row.markPrice === undefined
                      ? undefined
                      : amount(row.markPrice),
                  unrealizedPnl: pnl,
                  side: string(row.side),
                });
                c.data.holdings.push({
                  accountId: account.id,
                  asset: settlement,
                  quantity: '0',
                  unrealizedPnl: pnl,
                });
              }
            },
            { accountId: account.id },
          );
        }
      }
      return c.finish();
    },
  }),
};
