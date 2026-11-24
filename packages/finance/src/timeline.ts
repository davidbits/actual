import { add, Exact, negate } from './decimal';
import type {
  AssetObservation,
  Collection,
  PortfolioTimeline,
  Price,
  TimelinePoint,
} from './types';

export const TIMELINE_DAY = 86400000;
const zarOffset = 2 * 60 * 60000;

export function timelineDate(at: number) {
  return new Date(at + zarOffset).toISOString().slice(0, 10);
}

export function timelineStart(at: number, days: number) {
  return (
    Math.floor((at + zarOffset) / TIMELINE_DAY) * TIMELINE_DAY -
    zarOffset -
    (days - 1) * TIMELINE_DAY
  );
}

/** Daily observations use saved quantities and quotes available at that date, never future prices. */
export function buildPortfolioTimeline(
  snapshots: Record<string, Collection[]>,
  prices: Price[],
  from: number,
  through: number,
): PortfolioTimeline {
  // Index once: a year of daily points must not repeatedly scan/sort every saved quote.
  const indexed = new Map<string, Map<number, Price>>();
  for (const price of prices) {
    if (price.quote !== 'ZAR' || price.timestamp > through) continue;
    const entries = indexed.get(price.asset) ?? new Map<number, Price>();
    if (!entries.has(price.timestamp)) entries.set(price.timestamp, price);
    indexed.set(price.asset, entries);
  }
  const priceSeries = new Map(
    [...indexed].map(([asset, entries]) => [
      asset,
      [...entries.values()].sort((a, b) => a.timestamp - b.timestamp),
    ]),
  );
  const datedPrice = (asset: string, at: number): Price | undefined => {
    if (asset === 'ZAR') {
      return {
        asset,
        quote: 'ZAR',
        price: '1',
        timestamp: timelineStart(at, 1),
        source: 'identity',
      };
    }
    const series = priceSeries.get(asset) ?? [];
    let low = 0;
    let high = series.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (series[middle].timestamp <= at) low = middle + 1;
      else high = middle;
    }
    return series[low - 1];
  };
  const daily = Object.values(snapshots).map(collections => {
    const days = new Map<string, Collection>();
    for (const c of collections) {
      if (c.timestamp < from || c.timestamp > through) continue;
      const date = timelineDate(c.timestamp);
      if (c.timestamp > (days.get(date)?.timestamp ?? -1)) days.set(date, c);
    }
    return days;
  });
  const assets = [
    ...new Set(
      daily.flatMap(days =>
        [...days.values()].flatMap(c => c.holdings.map(h => h.asset)),
      ),
    ),
  ].sort();
  const points: TimelinePoint[] = [];
  for (let day = from; day <= through; day += TIMELINE_DAY) {
    const date = timelineDate(day);
    const at = Math.min(day + TIMELINE_DAY - 1, through);
    const collections = daily.flatMap(days => days.get(date) ?? []);
    const incomplete =
      collections.length !== daily.length ||
      collections.some(c =>
        c.coverage.some(coverage => coverage.status === 'error'),
      );
    const holdings = collections.flatMap(c =>
      c.holdings.map(h => ({ ...h, observedAt: h.observedAt ?? c.timestamp })),
    );
    const observations: Record<string, AssetObservation> = {};
    for (const asset of assets) {
      const rows = holdings.filter(h => h.asset === asset);
      const quantity =
        collections.length && (rows.length || !incomplete)
          ? add(
              ...rows.map(h =>
                add(h.quantity, negate(h.debt ?? '0'), h.unrealizedPnl ?? '0'),
              ),
            )
          : null;
      const price = collections.length ? datedPrice(asset, at) : undefined;
      observations[asset] = {
        quantity,
        price,
        value:
          quantity === null
            ? null
            : quantity === '0'
              ? '0'
              : price
                ? new Exact(quantity).times(price.price).toFixed()
                : null,
        partial:
          incomplete || (quantity !== null && quantity !== '0' && !price),
        stale:
          rows.some(h => at - h.observedAt > TIMELINE_DAY) ||
          (!!price && at - price.timestamp > TIMELINE_DAY),
      };
    }
    const values = Object.values(observations);
    const priced = values.flatMap(value =>
      value.value === null ? [] : [value.value],
    );
    const unpriced = values.some(
      value =>
        value.quantity !== null &&
        value.quantity !== '0' &&
        value.value === null,
    );
    points.push({
      date,
      value:
        !collections.length ||
        (incomplete && !priced.length) ||
        (unpriced && !values.some(v => v.value !== null && v.quantity !== '0'))
          ? null
          : add(...priced),
      assets: observations,
      observedAt: collections.length
        ? Math.min(...collections.map(c => c.timestamp))
        : undefined,
      observedConnections: collections.length,
      totalConnections: daily.length,
      partial: incomplete || values.some(value => value.partial),
      stale: values.some(
        value =>
          value.quantity !== null && value.quantity !== '0' && value.stale,
      ),
    });
  }
  return {
    from: timelineDate(from),
    through: timelineDate(through),
    asOf: through,
    assets,
    points,
  };
}
