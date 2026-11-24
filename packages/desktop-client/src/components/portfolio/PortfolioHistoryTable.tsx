import { Trans, useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Text } from '@actual-app/components/text';
import { View } from '@actual-app/components/view';
import type { TimelinePoint } from '@actual-app/finance';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { usePrivacyMode } from '#hooks/usePrivacyMode';

import { displayQuantity, PortfolioMoney } from './PortfolioMoney';
import { PortfolioTable } from './PortfolioTable';

export function PortfolioHistoryTable({
  points,
  asset,
}: {
  points: TimelinePoint[];
  asset: string;
}) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const privateMode = usePrivacyMode();
  return (
    <PortfolioTable label={t('Portfolio value history')}>
      <thead>
        <tr>
          <th>
            <Trans>Date</Trans>
          </th>
          <th className="number">
            <Trans>Priced value (ZAR)</Trans>
          </th>
          {!isNarrowWidth && (
            <>
              <th className="number">
                {asset} · <Trans>Net units</Trans>
              </th>
              <th className="number">
                {asset} · <Trans>Rate (ZAR)</Trans>
              </th>
              <th className="number">
                {asset} · <Trans>Value (ZAR)</Trans>
              </th>
              <th>
                <Trans>Coverage</Trans>
              </th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {[...points].reverse().map(point => {
          const observation = point.assets[asset];
          const status = !point.observedConnections
            ? t('No saved holdings')
            : [
                point.partial ? t('Partial') : t('Complete'),
                point.stale ? t('Stale') : null,
                `${point.observedConnections}/${point.totalConnections}`,
              ]
                .filter(Boolean)
                .join(' · ');
          const quantity = privateMode
            ? '•••'
            : observation?.quantity == null
              ? '—'
              : displayQuantity(observation.quantity);
          const rate = observation?.price
            ? displayQuantity(observation.price.price)
            : '—';
          const value = privateMode ? (
            '•••'
          ) : observation?.value == null ? (
            '—'
          ) : (
            <PortfolioMoney value={observation.value} />
          );
          return (
            <tr key={point.date}>
              <td>
                <View style={{ gap: 4 }}>
                  <Text>{point.date}</Text>
                  <Text className="subdued">
                    {point.observedAt
                      ? new Date(point.observedAt).toLocaleString()
                      : ''}
                  </Text>
                  {isNarrowWidth && <Text className="subdued">{status}</Text>}
                </View>
              </td>
              <td
                className="number"
                style={{ whiteSpace: isNarrowWidth ? 'normal' : undefined }}
              >
                {privateMode ? (
                  '•••'
                ) : point.value === null ? (
                  '—'
                ) : (
                  <PortfolioMoney value={point.value} />
                )}
                {isNarrowWidth && asset && (
                  <View style={{ gap: 5, marginTop: 8 }}>
                    <Text className="subdued">{asset}</Text>
                    <PrivacyFilter>
                      <FinancialText>
                        {quantity} <Trans>units</Trans>
                      </FinancialText>
                    </PrivacyFilter>
                    <FinancialText>{rate} ZAR</FinancialText>
                    <View style={{ display: 'block' }}>{value}</View>
                  </View>
                )}
              </td>
              {!isNarrowWidth && (
                <>
                  <td className="number">
                    <FinancialText>{quantity}</FinancialText>
                  </td>
                  <td className="number">
                    <FinancialText>{rate}</FinancialText>
                  </td>
                  <td className="number">{value}</td>
                  <td>{status}</td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </PortfolioTable>
  );
}
