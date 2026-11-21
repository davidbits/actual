import { add, negate } from '#decimal';
import { createCollector } from '#server/collector';
import type { AdapterRegistration } from '#server/contracts';
import { amount, array, asset, object, string, timestamp } from '#server/json';
import { signLuno } from '#server/transport';

export const luno: AdapterRegistration = {
  definition: {
    id: 'luno',
    name: 'Luno',
    passphrase: false,
    products: ['transactional', 'spot', 'staking', 'earn', 'bundles'],
  },
  transport: { hosts: { spot: 'https://api.luno.com' }, signer: signLuno },
  resources: [
    { path: '/api/1/balance' },
    { path: '/api/1/accounts/:id/transactions' },
    { path: '/api/1/accounts/:id/pending' },
  ],
  create: ({ request }) => ({
    definition: luno.definition,
    async collect(options) {
      const c = createCollector(options);
      await c.stream('balances', async () => {
        const wallets = array(
          object(await request({ path: '/api/1/balance' })).balance,
        );
        for (const wallet of wallets) {
          const id = string(wallet.account_id);
          c.data.accounts.push({
            id,
            name:
              typeof wallet.name === 'string'
                ? wallet.name
                : asset(wallet.asset),
            product:
              typeof wallet.account_type === 'string'
                ? wallet.account_type
                : 'wallet',
          });
          c.data.holdings.push({
            accountId: id,
            asset: asset(wallet.asset),
            quantity: amount(wallet.balance),
            available: add(
              amount(wallet.balance),
              negate(amount(wallet.reserved, '0')),
            ),
          });
        }
      });
      for (const account of c.data.accounts) {
        await c.pages(
          `ledger:${account.id}`,
          async cursor => {
            const start = Number(cursor ?? '1');
            if (!Number.isSafeInteger(start) || start < 1) {
              throw new Error('Invalid ledger cursor');
            }
            const data = nullableList(
              object(
                await request(
                  { path: `/api/1/accounts/${account.id}/transactions` },
                  { min_row: start, max_row: start + 1000 },
                ),
              ).transactions,
            );
            const events = data.map(row => ({
              id: `${account.id}:${string(row.row_index)}`,
              accountId: account.id,
              stream: `ledger:${account.id}`,
              timestamp: timestamp(row.timestamp),
              type: typeof row.kind === 'string' ? row.kind : 'movement',
              status: 'booked' as const,
              postings: [
                {
                  asset: asset(row.currency),
                  quantity: amount(row.balance_delta),
                  role: 'principal' as const,
                },
              ],
              description:
                typeof row.description === 'string'
                  ? row.description
                  : undefined,
            }));
            const end = data.length
              ? Math.max(...data.map(row => Number(string(row.row_index)))) + 1
              : start;
            return {
              events,
              cursor: String(end),
              exhausted: data.length < 1000,
            };
          },
          account.id,
          true,
        );
        await c.stream(`pending:${account.id}`, async () => {
          const pending = nullableList(
            object(
              await request({ path: `/api/1/accounts/${account.id}/pending` }),
            ).pending,
          );
          // Pending rows have no stable identity; report availability without inventing booked events.
          if (pending.length) {
            c.data.coverage.push({
              stream: `pending:${account.id}`,
              accountId: account.id,
              status: 'partial',
              reason: 'Pending wallet activity is excluded from booked history',
            });
          }
        });
      }
      return c.finish();
    },
  }),
};

function nullableList(value: unknown) {
  return value === null ? [] : array(value);
}
