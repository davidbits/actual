import { add, Exact, negate, quantity } from './decimal';
import type { Collection, FinanceEvent, Holding, Price } from './types';

export function selectPrice(
  prices: Price[],
  asset: string,
  quote: string,
  at: number,
): Price | undefined {
  if (asset === quote) {
    return { asset, quote, price: '1', timestamp: at, source: 'identity' };
  }
  return prices
    .filter(
      price =>
        price.asset === asset && price.quote === quote && price.timestamp <= at,
    )
    .sort((a, b) => b.timestamp - a.timestamp)[0];
}

export function valueHoldings(
  holdings: Holding[],
  prices: Price[],
  at: number,
  quote = 'ZAR',
) {
  const values = holdings.map(holding => {
    const net = add(
      holding.quantity,
      negate(holding.debt ?? '0'),
      holding.unrealizedPnl ?? '0',
    );
    const price = selectPrice(prices, holding.asset, quote, at);
    return {
      ...holding,
      net,
      value: price
        ? new Exact(net).times(quantity(price.price)).toFixed()
        : null,
      price,
      stale:
        !price ||
        at - price.timestamp > 24 * 60 * 60 * 1000 ||
        (holding.observedAt !== undefined &&
          at - holding.observedAt > 60 * 60 * 1000),
    };
  });
  return {
    values,
    total: add(
      ...values.flatMap(row => (row.value == null ? [] : [row.value])),
    ),
    unpriced: values.filter(row => row.value == null && row.net !== '0').length,
  };
}

/** Replay backwards only when a complete movement interval is established. */
export function historicalHoldings(
  collection: Collection,
  events: FinanceEvent[],
  at: number,
): Holding[] {
  if (at > collection.timestamp) {
    throw new Error('No checkpoint at or after this date');
  }
  const relevant = events.filter(
    event =>
      event.status === 'booked' &&
      event.timestamp > at &&
      event.timestamp <= collection.timestamp,
  );
  const accounts = new Set([
    ...collection.accounts.map(account => account.id),
    ...relevant.map(event => event.accountId),
  ]);
  for (const account of accounts) {
    if (
      !collection.coverage.some(
        c =>
          c.accountId === account &&
          c.balanceHistory === true &&
          c.status === 'ok' &&
          c.from !== undefined &&
          c.from <= at &&
          (c.through ?? 0) >= collection.timestamp,
      )
    ) {
      throw new Error('Incomplete movement history for requested date');
    }
  }
  // Position/debt history cannot be inferred from spot balance movements.
  if (
    collection.positions.length ||
    events.some(event =>
      /FUTURES|PERP|MARGIN|BORROW|REPAY|LIQUIDATION/i.test(event.type),
    ) ||
    collection.holdings.some(h => h.debt && h.debt !== '0')
  ) {
    throw new Error('Historical debt and positions require a dated checkpoint');
  }
  const holdings = new Map(
    collection.holdings.map(h => [`${h.accountId}:${h.asset}`, { ...h }]),
  );
  for (const event of relevant) {
    for (const posting of event.postings) {
      const key = `${event.accountId}:${posting.asset}`;
      const holding = holdings.get(key) ?? {
        accountId: event.accountId,
        asset: posting.asset,
        quantity: '0',
      };
      holding.quantity = add(holding.quantity, negate(posting.quantity));
      delete holding.available;
      holdings.set(key, holding);
    }
  }
  return [...holdings.values()];
}
