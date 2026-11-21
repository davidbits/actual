import { Trans, useTranslation } from 'react-i18next';

import type { Portfolio } from '@actual-app/finance';

export function PortfolioPositions({ portfolio }: { portfolio: Portfolio }) {
  const { t } = useTranslation();
  const positions = Object.entries(portfolio.collections).flatMap(
    ([connectionId, c]) => c.positions.map(p => ({ ...p, connectionId })),
  );
  return (
    <section
      aria-label={t('Derivative positions')}
      style={{ overflowX: 'auto', flexShrink: 0 }}
    >
      <h2>
        <Trans>Derivative positions</Trans>
      </h2>
      <p>
        <Trans>
          Position notional is not added to net worth. Equity and
          settlement-asset profit are included once in holdings.
        </Trans>
      </p>
      {!positions.length && (
        <p>
          <Trans>
            No open positions reported. Check connection coverage for
            unavailable products.
          </Trans>
        </p>
      )}
      {!!positions.length && (
        <table
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
                <Trans>Instrument</Trans>
              </th>
              <th>
                <Trans>Side</Trans>
              </th>
              <th>
                <Trans>Quantity</Trans>
              </th>
              <th>
                <Trans>Entry price</Trans>
              </th>
              <th>
                <Trans>Mark price</Trans>
              </th>
              <th>
                <Trans>Unrealized P&amp;L</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map(p => (
              <tr key={`${p.connectionId}/${p.id}`}>
                <td>{p.symbol}</td>
                <td>{p.side}</td>
                <td>{p.quantity}</td>
                <td>{p.entryPrice}</td>
                <td>{p.markPrice ?? t('Unavailable')}</td>
                <td>
                  {p.unrealizedPnl} {p.settlementAsset}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
