import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { Portfolio } from '@actual-app/finance';

import { EmptyMessage } from '#components/common/EmptyMessage';
import { FinancialText } from '#components/FinancialText';

import { displayQuantity } from './PortfolioMoney';
import { PortfolioTable } from './PortfolioTable';

export function PortfolioPositions({ portfolio }: { portfolio: Portfolio }) {
  const { t } = useTranslation();
  const positions = Object.entries(portfolio.collections).flatMap(
    ([connectionId, c]) => c.positions.map(p => ({ ...p, connectionId })),
  );
  if (!positions.length) {
    return (
      <EmptyMessage>
        <Trans>
          No open positions reported. Connection details show unavailable
          products.
        </Trans>
      </EmptyMessage>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        <Trans>
          Settlement equity is included in holdings. Position notional is shown
          separately.
        </Trans>
      </Text>
      <PortfolioTable label={t('Derivative positions')}>
        <thead>
          <tr>
            <th>
              <Trans>Instrument</Trans>
            </th>
            <th>
              <Trans>Account</Trans>
            </th>
            <th>
              <Trans>Side</Trans>
            </th>
            <th className="number">
              <Trans>Quantity</Trans>
            </th>
            <th className="number">
              <Trans>Entry price</Trans>
            </th>
            <th className="number">
              <Trans>Mark price</Trans>
            </th>
            <th className="number">
              <Trans>Unrealized P&amp;L</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map(p => (
            <tr key={`${p.connectionId}/${p.id}`}>
              <td>{p.symbol}</td>
              <td>
                {portfolio.connections.find(c => c.id === p.connectionId)?.name}
              </td>
              <td>{p.side}</td>
              <td className="number">
                <FinancialText>{displayQuantity(p.quantity)}</FinancialText>
              </td>
              <td className="number">
                <FinancialText>{displayQuantity(p.entryPrice)}</FinancialText>
              </td>
              <td className="number">
                <FinancialText>
                  {p.markPrice
                    ? displayQuantity(p.markPrice)
                    : t('Unavailable')}
                </FinancialText>
              </td>
              <td className="number">
                <FinancialText>
                  {displayQuantity(p.unrealizedPnl)} {p.settlementAsset}
                </FinancialText>
              </td>
            </tr>
          ))}
        </tbody>
      </PortfolioTable>
    </View>
  );
}
