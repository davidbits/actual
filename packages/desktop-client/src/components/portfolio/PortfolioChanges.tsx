import { Trans, useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { portfolioChanges } from '@actual-app/finance';
import type { Portfolio } from '@actual-app/finance';

import { EmptyMessage } from '#components/common/EmptyMessage';

import { PortfolioChangeValues } from './PortfolioChangeValues';
import { PortfolioTable } from './PortfolioTable';

export function PortfolioChanges({
  portfolio,
  at,
}: {
  portfolio: Portfolio;
  at: number;
}) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const rows = portfolioChanges(portfolio, at);
  if (!rows.length) {
    return (
      <EmptyMessage>
        <Trans>No saved holdings to compare yet.</Trans>
      </EmptyMessage>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        <Trans>
          Earlier → latest. Earlier holdings use the last saved snapshot at or
          before one day before the valuation date; prices use that day's
          available rates. Observation times appear below each asset.
        </Trans>
      </Text>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        <Trans>
          Value changes include trades, transfers, debt and market moves. They
          are not investment returns. Net units include debt and unrealized
          profit or loss.
        </Trans>
      </Text>
      <PortfolioTable label={t('Asset changes')}>
        <thead>
          <tr>
            <th>
              <Trans>Asset / account</Trans>
            </th>
            {isNarrowWidth ? (
              <th className="number">
                <Trans>Changes</Trans>
              </th>
            ) : (
              <>
                <th className="number">
                  <Trans>Net units</Trans>
                </th>
                <th className="number">
                  <Trans>Rate (ZAR)</Trans>
                </th>
                <th className="number">
                  <Trans>Value (ZAR)</Trans>
                </th>
                <th className="number">
                  <Trans>Value change (ZAR)</Trans>
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td style={isNarrowWidth ? { width: '40%' } : undefined}>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontWeight: 600 }}>{row.asset}</Text>
                  <Text className="subdued">
                    {row.connection} / {row.account}
                  </Text>
                  <Text className="subdued">
                    {row.before.observedAt === undefined
                      ? t('No earlier snapshot')
                      : new Date(row.before.observedAt).toLocaleString()}{' '}
                    →{' '}
                    {row.after.observedAt === undefined
                      ? t('No current snapshot')
                      : new Date(row.after.observedAt).toLocaleString()}
                  </Text>
                  {(row.before.stale ||
                    row.after.stale ||
                    row.before.incomplete ||
                    row.after.incomplete) && (
                    <Text style={{ color: theme.warningText, fontSize: 12 }}>
                      <Trans>Stale or incomplete observations</Trans>
                    </Text>
                  )}
                </View>
              </td>
              <PortfolioChangeValues row={row} mobile={isNarrowWidth} />
            </tr>
          ))}
        </tbody>
      </PortfolioTable>
    </View>
  );
}
