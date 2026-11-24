import { Trans } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { TooltipContentProps } from 'recharts';

import { FinancialText } from '#components/FinancialText';

import { displayQuantity, PortfolioMoney } from './PortfolioMoney';
import type { PortfolioChartPoint } from './PortfolioTrendChart';

export function PortfolioTrendTooltip({
  active,
  label,
  points,
  currency,
}: Partial<TooltipContentProps> & {
  points: PortfolioChartPoint[];
  currency: boolean;
}) {
  const point = points.find(p => p.date === String(label));
  if (!active || !point) return null;
  return (
    <View
      style={{
        backgroundColor: theme.menuBackground,
        color: theme.menuItemText,
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 4,
        padding: 10,
        gap: 6,
      }}
    >
      <strong>{point.date}</strong>
      {point.value === null ? (
        <Trans>No saved value</Trans>
      ) : currency ? (
        <PortfolioMoney value={point.value} />
      ) : (
        <FinancialText>{displayQuantity(point.value)}</FinancialText>
      )}
      {point.partial && (
        <span>
          <Trans>Partial valuation</Trans>
        </span>
      )}
      {point.stale && (
        <span>
          <Trans>Stale observations</Trans>
        </span>
      )}
    </View>
  );
}
