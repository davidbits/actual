import { Trans, useTranslation } from 'react-i18next';

import type { Price } from '@actual-app/finance';

import { EmptyMessage } from '#components/common/EmptyMessage';
import { FinancialText } from '#components/FinancialText';

import { displayQuantity } from './PortfolioMoney';
import { PortfolioTable } from './PortfolioTable';

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
      price.quote === 'ZAR' &&
      price.timestamp <= at &&
      price.timestamp > (latest.get(price.asset)?.timestamp ?? -1)
    ) {
      latest.set(price.asset, price);
    }
  }
  if (!latest.size) {
    return (
      <EmptyMessage>
        <Trans>No prices available for this date.</Trans>
      </EmptyMessage>
    );
  }
  return (
    <PortfolioTable label={t('Prices and exchange rates')}>
      <thead>
        <tr>
          <th>
            <Trans>Asset</Trans>
          </th>
          <th className="number">
            <Trans>Price (ZAR)</Trans>
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
        {[...latest.values()]
          .sort((a, b) => a.asset.localeCompare(b.asset))
          .map(p => (
            <tr key={p.asset}>
              <td>{p.asset}</td>
              <td className="number" title={p.price}>
                <FinancialText>{displayQuantity(p.price)}</FinancialText>
              </td>
              <td>{new Date(p.timestamp).toLocaleString()}</td>
              <td className="subdued">{p.source}</td>
            </tr>
          ))}
      </tbody>
    </PortfolioTable>
  );
}
