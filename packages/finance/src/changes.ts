import { add, Exact, negate } from './decimal';
import type { Collection, Holding, Portfolio, Price } from './types';
import { selectPrice } from './valuation';

function observation(
  collection: Collection | undefined,
  holdings: Holding[],
  prices: Price[],
  asset: string,
  at: number,
) {
  const rate = selectPrice(prices, asset, 'ZAR', at);
  const incomplete =
    collection?.coverage.some(c => c.status === 'error') ?? false;
  const net =
    collection && (holdings.length > 0 || !incomplete)
      ? add(
          ...holdings.map(h =>
            add(h.quantity, negate(h.debt ?? '0'), h.unrealizedPnl ?? '0'),
          ),
        )
      : null;
  const observedAt = collection
    ? Math.min(
        collection.timestamp,
        ...holdings.map(h => h.observedAt ?? collection.timestamp),
      )
    : undefined;
  return {
    net,
    rate,
    value:
      net === null
        ? null
        : net === '0'
          ? '0'
          : rate
            ? new Exact(net).times(rate.price).toFixed()
            : null,
    observedAt,
    stale:
      (observedAt !== undefined && at - observedAt > 86400000) ||
      (!!rate && at - rate.timestamp > 86400000),
    incomplete,
  };
}

function difference(
  after: string | null | undefined,
  before: string | null | undefined,
) {
  return after == null || before == null
    ? null
    : new Exact(after).minus(before).toFixed();
}

/** Value movement includes trades, transfers, debt and market moves; it is not investment return. */
export function portfolioChanges(portfolio: Portfolio, at: number) {
  return portfolio.connections.flatMap(connection => {
    const current = portfolio.collections[connection.id];
    const previous = portfolio.comparison?.collections[connection.id];
    const beforeAt = portfolio.comparison?.at ?? at - 86400000;
    const keys = new Map<string, Pick<Holding, 'accountId' | 'asset'>>();
    for (const h of [
      ...(previous?.holdings ?? []),
      ...(current?.holdings ?? []),
    ]) {
      keys.set(JSON.stringify([h.accountId, h.asset]), h);
    }
    return [...keys.entries()].map(([key, { accountId, asset }]) => {
      const matching = (c: Collection | undefined) =>
        c?.holdings.filter(
          h => h.accountId === accountId && h.asset === asset,
        ) ?? [];
      const before = observation(
        previous,
        matching(previous),
        portfolio.prices,
        asset,
        beforeAt,
      );
      const after = observation(
        current,
        matching(current),
        portfolio.prices,
        asset,
        at,
      );
      after.incomplete ||= !!connection.error;
      return {
        id: JSON.stringify([connection.id, key]),
        connection: connection.name,
        account:
          [...(current?.accounts ?? []), ...(previous?.accounts ?? [])].find(
            a => a.id === accountId,
          )?.name ?? accountId,
        asset,
        before,
        after,
        quantityChange: difference(after.net, before.net),
        rateChange: difference(after.rate?.price, before.rate?.price),
        valueChange: difference(after.value, before.value),
      };
    });
  });
}
