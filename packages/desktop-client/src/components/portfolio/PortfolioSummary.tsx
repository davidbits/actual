import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { valueHoldings } from '@actual-app/finance';
import type { Portfolio } from '@actual-app/finance';

import { PortfolioMoney } from './PortfolioMoney';

export function PortfolioSummary({
  portfolio,
  at,
  historical,
}: {
  portfolio: Portfolio;
  at: number;
  historical: boolean;
}) {
  const { t } = useTranslation();
  const collections = Object.values(portfolio.collections);
  const valuation = valueHoldings(
    collections.flatMap(c => c.holdings),
    portfolio.prices,
    at,
  );
  const unpriced = [
    ...new Set(
      valuation.values
        .filter(h => h.value === null && h.net !== '0')
        .map(h => h.asset),
    ),
  ];
  const unavailable = collections.some(c =>
    c.coverage.some(
      row => row.stream === 'historical-holdings' && row.status === 'error',
    ),
  );
  const pending = portfolio.connections.some(c => !portfolio.collections[c.id]);
  const incomplete = portfolio.connections.some(c => !!c.error);
  const observations = collections.map(c => c.timestamp);
  return (
    <View
      aria-label={t('Portfolio balance')}
      style={{ padding: '18px 0', gap: 8, flexShrink: 0 }}
    >
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {unpriced.length || incomplete
          ? t('Priced balance')
          : t('Portfolio value')}{' '}
        · ZAR
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {unavailable || (!collections.length && pending) ? (
          <Text style={{ fontSize: 24 }}>
            <Trans>Valuation unavailable</Trans>
          </Text>
        ) : (
          <PortfolioMoney
            value={valuation.total}
            style={{ fontSize: 28, fontWeight: 600 }}
          />
        )}
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          {valuation.values.filter(h => h.net !== '0').length === 1
            ? t('1 holding')
            : t('{{count}} holdings', {
                count: valuation.values.filter(h => h.net !== '0').length,
              })}
        </Text>
      </View>
      {observations.length > 0 && (
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>Holdings observed</Trans>{' '}
          {new Date(Math.min(...observations)).toLocaleString()}
        </Text>
      )}
      {unpriced.length > 0 && (
        <View
          role="status"
          style={{
            padding: '10px 12px',
            borderRadius: 4,
            backgroundColor: theme.warningBackground,
            color: theme.warningText,
          }}
        >
          <Trans>
            Missing prices: {{ assets: unpriced.join(', ') }}. Shown balance
            excludes these assets.
          </Trans>
        </View>
      )}
      {pending && (
        <Text role="status" style={{ color: theme.warningText }}>
          <Trans>Some connections have not finished collecting balances.</Trans>
        </Text>
      )}
      {incomplete && (
        <Text role="status" style={{ color: theme.warningText, fontSize: 12 }}>
          <Trans>
            Some exchange feeds need attention. Review Connections for details.
          </Trans>
        </Text>
      )}
      {historical && (
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>
            Historical value uses available holdings checkpoints and prices at
            the selected date.
          </Trans>
        </Text>
      )}
    </View>
  );
}
