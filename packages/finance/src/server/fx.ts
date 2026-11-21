import { Exact } from '#decimal';
import type { Price } from '#types';

/** ECB rates are reference observations, never assumed execution rates. */
export async function ecbPrices(
  assets: string[],
  at: number,
  historical: boolean,
  fetcher = globalThis.fetch,
): Promise<Price[]> {
  const fiat = new Set([
    'USD',
    'EUR',
    'GBP',
    'CHF',
    'AUD',
    'CAD',
    'JPY',
    'CNY',
    'NZD',
    'NOK',
    'SEK',
    'SGD',
    'HKD',
  ]);
  if (!assets.some(a => fiat.has(a))) return [];
  const response = await fetcher(
    `https://www.ecb.europa.eu/stats/eurofxref/${historical ? 'eurofxref-hist.xml' : 'eurofxref-daily.xml'}`,
    { redirect: 'error', signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) throw new Error('FX data unavailable');
  const xml = await response.text();
  if (xml.length > 32 * 1024 * 1024) throw new Error('FX response too large');
  for (const match of xml.matchAll(
    /<Cube time=['"](\d{4}-\d{2}-\d{2})['"]>([\s\S]*?)<\/Cube>/g,
  )) {
    const date = match[1];
    const noon = new Date(`${date}T12:00:00Z`);
    const offset = new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Berlin',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(noon)
      .find(p => p.type === 'timeZoneName')
      ?.value.match(/GMT\+(\d+)/)?.[1];
    const timestamp =
      Date.parse(`${date}T16:00:00Z`) - Number(offset ?? 1) * 3600000;
    if (timestamp > at) continue;
    const rates = new Map(
      [
        ...match[2].matchAll(
          /currency=['"]([A-Z]+)['"]\s+rate=['"]([\d.]+)['"]/g,
        ),
      ].map(row => [row[1], row[2]]),
    );
    const zar = rates.get('ZAR');
    if (!zar) continue;
    rates.set('EUR', '1');
    return [...new Set(assets)].flatMap(asset => {
      const rate = rates.get(asset);
      return rate && fiat.has(asset)
        ? [
            {
              asset,
              quote: 'ZAR',
              price: new Exact(zar).div(rate).toFixed(),
              timestamp,
              source: 'ECB daily reference via EUR',
            },
          ]
        : [];
    });
  }
  return [];
}
