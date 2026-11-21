import { Trans, useTranslation } from 'react-i18next';

import { Exact, valueHoldings } from '@actual-app/finance';
import type { Portfolio } from '@actual-app/finance';

export function PortfolioHoldings({
  portfolio,
  at,
}: {
  portfolio: Portfolio;
  at: number;
}) {
  const { t } = useTranslation();
  const holdings = Object.entries(portfolio.collections).flatMap(
    ([connectionId, collection]) =>
      collection.holdings.map(h => ({
        ...h,
        accountId: `${connectionId}/${h.accountId}`,
      })),
  );
  const accountNames = new Map(
    Object.entries(portfolio.collections).flatMap(([id, collection]) =>
      collection.accounts.map(a => [
        `${id}/${a.id}`,
        `${portfolio.connections.find(c => c.id === id)?.name ?? id} / ${a.name}`,
      ]),
    ),
  );
  const valuation = valueHoldings(holdings, portfolio.prices, at);
  const missingHistory = Object.values(portfolio.collections).some(c =>
    c.coverage.some(
      row => row.stream === 'historical-holdings' && row.status === 'error',
    ),
  );
  const partial = Object.values(portfolio.collections).some(c =>
    c.coverage.some(row => row.status !== 'ok'),
  );
  const format = (value: string) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'ZAR',
    }).format(Number(new Exact(value).toFixed(2)));
  return (
    <section
      aria-label={t('Holdings')}
      style={{ overflowX: 'auto', flexShrink: 0 }}
    >
      <h2 style={{ fontVariantNumeric: 'tabular-nums' }}>
        {missingHistory ? t('Valuation unavailable') : format(valuation.total)}
      </h2>
      {partial && (
        <p role="status">
          <Trans>
            Partial coverage. Review connection details before relying on this
            total.
          </Trans>
        </p>
      )}
      <p>
        <Trans>
          Priced assets less liabilities. Unpriced holdings are excluded, not
          valued at zero.
        </Trans>
      </p>
      {valuation.unpriced > 0 && (
        <p role="status">
          <Trans count={valuation.unpriced}>
            {{ count: valuation.unpriced }} holdings need prices
          </Trans>
        </p>
      )}
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
              <Trans>Asset</Trans>
            </th>
            <th>
              <Trans>Account</Trans>
            </th>
            <th>
              <Trans>Quantity</Trans>
            </th>
            <th>
              <Trans>Debt</Trans>
            </th>
            <th>
              <Trans>Unrealized P&amp;L</Trans>
            </th>
            <th>
              <Trans>ZAR value</Trans>
            </th>
            <th>
              <Trans>Price source</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {valuation.values
            .filter(h => h.net !== '0')
            .map((h, index) => (
              <tr key={`${h.accountId}/${h.asset}/${index}`}>
                <td>{h.asset}</td>
                <td>{accountNames.get(h.accountId)}</td>
                <td>{h.quantity}</td>
                <td>{h.debt ?? '0'}</td>
                <td>{h.unrealizedPnl ?? '0'}</td>
                <td>{h.value === null ? t('Unpriced') : format(h.value)}</td>
                <td>
                  {h.price?.source ?? t('Unavailable')}
                  {h.stale && h.price ? ` · ${t('Stale')}` : ''}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
}
