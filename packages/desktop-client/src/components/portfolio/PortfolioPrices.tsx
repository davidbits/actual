import { Trans, useTranslation } from 'react-i18next';

import type { Price } from '@actual-app/finance';

export function PortfolioPrices({
  prices,
  at,
}: {
  prices: Price[];
  at: number;
}) {
  const { t } = useTranslation();
  const latest = new Map<string, Price>();
  for (const price of prices) {
    if (
      price.timestamp <= at &&
      price.timestamp > (latest.get(price.asset)?.timestamp ?? -1)
    ) {
      latest.set(price.asset, price);
    }
  }
  return (
    <details>
      <summary>
        <Trans>Prices and exchange rates</Trans>
      </summary>
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label={t('Prices and exchange rates')}
          style={{
            width: '100%',
            textAlign: 'left',
            borderSpacing: '12px 8px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <thead>
            <tr>
              <th>
                <Trans>Asset</Trans>
              </th>
              <th>
                <Trans>Price</Trans>
              </th>
              <th>
                <Trans>Quote currency</Trans>
              </th>
              <th>
                <Trans>As of</Trans>
              </th>
              <th>
                <Trans>Source</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...latest.values()].map(p => (
              <tr key={p.asset}>
                <td>{p.asset}</td>
                <td>{p.price}</td>
                <td>{p.quote}</td>
                <td>{new Date(p.timestamp).toLocaleString()}</td>
                <td>{p.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
