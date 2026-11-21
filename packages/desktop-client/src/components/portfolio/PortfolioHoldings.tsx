import { Trans, useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { valueHoldings } from '@actual-app/finance';
import type { Portfolio } from '@actual-app/finance';

import { EmptyMessage } from '#components/common/EmptyMessage';
import { FinancialText } from '#components/FinancialText';

import { displayQuantity, PortfolioMoney } from './PortfolioMoney';
import { PortfolioTable } from './PortfolioTable';

export function PortfolioHoldings({
  portfolio,
  at,
}: {
  portfolio: Portfolio;
  at: number;
}) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const rows = Object.entries(portfolio.collections).flatMap(
    ([id, collection]) =>
      valueHoldings(collection.holdings, portfolio.prices, at).values.map(
        holding => ({
          ...holding,
          connectionId: id,
          accountName:
            collection.accounts.find(a => a.id === holding.accountId)?.name ??
            holding.accountId,
          connectionName: portfolio.connections.find(c => c.id === id)?.name,
        }),
      ),
  );
  const debt = rows.some(r => r.debt && r.debt !== '0');
  const pnl = rows.some(r => r.unrealizedPnl && r.unrealizedPnl !== '0');
  if (!rows.length) {
    return (
      <EmptyMessage>
        <Trans>No holdings available for this selection.</Trans>
      </EmptyMessage>
    );
  }
  if (isNarrowWidth) {
    return (
      <section aria-label={t('Holdings')}>
        <PortfolioTable label={t('Holdings')}>
          <thead>
            <tr>
              <th>
                <Trans>Asset</Trans>
              </th>
              <th className="number">
                <Trans>Value (ZAR)</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter(h => h.net !== '0')
              .map((h, index) => (
                <tr
                  key={`${h.connectionId}/${h.accountId}/${h.asset}/${index}`}
                >
                  <td>
                    <View style={{ gap: 5 }}>
                      <Text style={{ fontWeight: 600 }}>{h.asset}</Text>
                      <FinancialText>
                        {displayQuantity(h.quantity)} {h.asset}
                      </FinancialText>
                      <Text className="subdued">
                        {h.connectionName} · {h.accountName}
                      </Text>
                      {h.debt && h.debt !== '0' && (
                        <Text className="subdued">
                          <Trans>Debt</Trans>: {displayQuantity(h.debt)}
                        </Text>
                      )}
                      {h.unrealizedPnl && h.unrealizedPnl !== '0' && (
                        <Text className="subdued">
                          {t('Unrealized P&L')}:{' '}
                          {displayQuantity(h.unrealizedPnl)}
                        </Text>
                      )}
                    </View>
                  </td>
                  <td className="number">
                    {h.value === null ? (
                      <Text style={{ color: theme.warningText }}>
                        <Trans>Unpriced</Trans>
                      </Text>
                    ) : (
                      <PortfolioMoney
                        value={h.value}
                        style={{ fontSize: 15, fontWeight: 600 }}
                      />
                    )}
                    {h.stale && (
                      <div className="subdued">
                        <Trans>Older quote</Trans>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </PortfolioTable>
      </section>
    );
  }
  return (
    <section aria-label={t('Holdings')}>
      <PortfolioTable label={t('Holdings')}>
        <thead>
          <tr>
            <th>
              <Trans>Asset</Trans>
            </th>
            <th>
              <Trans>Account</Trans>
            </th>
            <th className="number">
              <Trans>Quantity</Trans>
            </th>
            {debt && (
              <th className="number">
                <Trans>Debt</Trans>
              </th>
            )}
            {pnl && (
              <th className="number">
                <Trans>Unrealized P&amp;L</Trans>
              </th>
            )}
            <th className="number">
              <Trans>Price (ZAR)</Trans>
            </th>
            <th className="number">
              <Trans>Value (ZAR)</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter(h => h.net !== '0')
            .map((h, index) => (
              <tr key={`${h.connectionId}/${h.accountId}/${h.asset}/${index}`}>
                <td>
                  <Text style={{ fontWeight: 600 }}>{h.asset}</Text>
                </td>
                <td>
                  <View style={{ gap: 3 }}>
                    <Text>{h.accountName}</Text>
                    <Text className="subdued">{h.connectionName}</Text>
                  </View>
                </td>
                <td className="number" title={h.quantity}>
                  <FinancialText>{displayQuantity(h.quantity)}</FinancialText>
                </td>
                {debt && (
                  <td className="number" title={h.debt}>
                    <FinancialText>
                      {displayQuantity(h.debt ?? '0')}
                    </FinancialText>
                  </td>
                )}
                {pnl && (
                  <td className="number" title={h.unrealizedPnl}>
                    <FinancialText>
                      {displayQuantity(h.unrealizedPnl ?? '0')}
                    </FinancialText>
                  </td>
                )}
                <td className="number" title={h.price?.source}>
                  {h.price ? (
                    <View style={{ alignItems: 'flex-end', gap: 3 }}>
                      <FinancialText>
                        {displayQuantity(h.price.price)}
                      </FinancialText>
                      {h.stale && (
                        <Text className="subdued">
                          <Trans>Older quote</Trans>
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={{ color: theme.warningText }}>
                      <Trans>No quote</Trans>
                    </Text>
                  )}
                </td>
                <td className="number">
                  {h.value === null ? (
                    <Text style={{ color: theme.warningText }}>
                      <Trans>Unpriced</Trans>
                    </Text>
                  ) : (
                    <PortfolioMoney
                      value={h.value}
                      style={{ fontWeight: 600 }}
                    />
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </PortfolioTable>
    </section>
  );
}
