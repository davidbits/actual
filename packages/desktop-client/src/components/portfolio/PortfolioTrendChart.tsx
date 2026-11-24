import { Trans } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { Exact } from '@actual-app/finance';
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyMessage } from '#components/common/EmptyMessage';
import { useRechartsAnimation } from '#components/reports/chart-theme';
import { Container } from '#components/reports/Container';
import { usePrivacyMode } from '#hooks/usePrivacyMode';

import { PortfolioTrendTooltip } from './PortfolioTrendTooltip';

export type PortfolioChartPoint = {
  date: string;
  value: string | null;
  partial: boolean;
  stale: boolean;
};

export function PortfolioTrendChart({
  title,
  points,
  currency = true,
}: {
  title: string;
  points: PortfolioChartPoint[];
  currency?: boolean;
}) {
  const privacyMode = usePrivacyMode();
  const animation = useRechartsAnimation({ isAnimationActive: false });
  const hasValues = points.some(point => point.value !== null);
  const data = points.map(point => ({
    ...point,
    plotted: point.value === null ? null : new Exact(point.value).toNumber(),
  }));
  return (
    <View
      role="region"
      aria-label={title}
      style={{
        backgroundColor: theme.tableBackground,
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 4,
        padding: 16,
        gap: 10,
      }}
    >
      <Text style={{ fontWeight: 600 }}>{title}</Text>
      {privacyMode ? (
        <EmptyMessage>
          <Trans>Graphs hidden while privacy mode is enabled.</Trans>
        </EmptyMessage>
      ) : !hasValues ? (
        <EmptyMessage>
          <Trans>No saved values in this range.</Trans>
        </EmptyMessage>
      ) : (
        <Container style={{ height: 240 }}>
          {(width, height) => (
            <LineChart
              width={width}
              height={height}
              data={data}
              accessibilityLayer
              margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid
                stroke={theme.tableBorder}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={value => String(value).slice(5)}
                tick={{ fill: theme.pageTextSubdued, fontSize: 11 }}
                minTickGap={32}
                axisLine={{ stroke: theme.tableBorder }}
                tickLine={false}
              />
              <YAxis
                width={62}
                tick={{ fill: theme.pageTextSubdued, fontSize: 11 }}
                tickFormatter={value =>
                  Number(value) !== 0 && Math.abs(Number(value)) < 0.01
                    ? Number(value).toExponential(1)
                    : new Intl.NumberFormat(undefined, {
                        notation: 'compact',
                        maximumFractionDigits: 2,
                      }).format(Number(value))
                }
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={
                  <PortfolioTrendTooltip points={points} currency={currency} />
                }
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="plotted"
                stroke={theme.chartQual1}
                strokeWidth={2}
                connectNulls={false}
                dot={{
                  r: points.length > 60 ? 1.5 : 3,
                  fill: theme.chartQual1,
                }}
                activeDot={{ r: 5 }}
                {...animation}
              />
            </LineChart>
          )}
        </Container>
      )}
    </View>
  );
}
