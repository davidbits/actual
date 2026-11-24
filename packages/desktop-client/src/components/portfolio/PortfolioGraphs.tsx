import { useId, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';

import { EmptyMessage } from '#components/common/EmptyMessage';
import { useMetadataPref } from '#hooks/useMetadataPref';

import { PortfolioField } from './PortfolioField';
import { PortfolioHistoryTable } from './PortfolioHistoryTable';
import { PortfolioTrendChart } from './PortfolioTrendChart';

export function PortfolioGraphs({
  connectionId,
  at,
}: {
  connectionId?: string;
  at?: number;
}) {
  const { t } = useTranslation();
  const prefix = useId();
  const [budgetId] = useMetadataPref('id');
  const [days, setDays] = useState('30');
  const [asset, setAsset] = useState('');
  const [metric, setMetric] = useState('value');
  const query = useQuery({
    queryKey: ['finance', budgetId, 'timeline', connectionId, days, at],
    enabled: !!budgetId,
    queryFn: () =>
      send('finance/timeline', { days: Number(days), connectionId, at }),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: false,
    networkMode: 'always',
  });
  const timeline = query.data?.timeline;
  // Trim only leading days before the first observation; interior gaps stay visible.
  const start =
    timeline?.points.findIndex(point => point.observedConnections > 0) ?? -1;
  const points = start < 0 ? [] : (timeline?.points.slice(start) ?? []);
  const firstPriced = timeline?.assets.find(a =>
    points.some(
      p => p.assets[a]?.value != null && p.assets[a]?.quantity !== '0',
    ),
  );
  const selected = timeline?.assets.includes(asset)
    ? asset
    : (firstPriced ?? timeline?.assets[0] ?? '');
  const labels = {
    value: t('Holding value (ZAR)'),
    price: t('Price / rate (ZAR)'),
    quantity: t('Net units'),
  };
  const metricLabel =
    metric === 'price'
      ? labels.price
      : metric === 'quantity'
        ? labels.quantity
        : labels.value;
  return (
    <View style={{ gap: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <PortfolioField id={prefix + 'range'} label={t('Graph range')}>
          <Select
            id={prefix + 'range'}
            value={days}
            onChange={setDays}
            options={[
              ['7', t('Last 7 days')],
              ['30', t('Last 30 days')],
              ['90', t('Last 90 days')],
              ['365', t('Last year')],
            ]}
          />
        </PortfolioField>
        <Button
          isDisabled={query.isFetching}
          onPress={() => void query.refetch()}
        >
          <Trans>Refresh graphs</Trans>
        </Button>
      </View>
      {query.isPending && (
        <Text role="status">
          <Trans>Loading graphs…</Trans>
        </Text>
      )}
      {(query.data?.offline || query.isError) && (
        <Text role="status" style={{ color: theme.warningText }}>
          <Trans>
            Server unavailable. Showing saved graph history where available.
          </Trans>
        </Text>
      )}
      {points.length ? (
        <>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>
              Daily observations in South African time. Gaps mean no saved
              holdings; prices use rates available on each date. Partial values
              exclude unavailable balances or prices. Value changes include
              trades and transfers, not just market returns.
            </Trans>
          </Text>
          {points.some(p => p.partial || p.stale) && (
            <Text role="status" style={{ color: theme.warningText }}>
              <Trans>
                Some observations are partial or stale. Check coverage in the
                history table.
              </Trans>
            </Text>
          )}
          <PortfolioTrendChart
            title={t('Priced portfolio value (ZAR)')}
            points={points}
          />
          {selected && (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <PortfolioField id={prefix + 'asset'} label={t('Graph asset')}>
                  <Select
                    id={prefix + 'asset'}
                    value={selected}
                    onChange={setAsset}
                    options={(timeline?.assets ?? []).map(a => [a, a])}
                  />
                </PortfolioField>
                <PortfolioField
                  id={prefix + 'metric'}
                  label={t('Asset metric')}
                >
                  <Select
                    id={prefix + 'metric'}
                    value={metric}
                    onChange={setMetric}
                    options={Object.entries(labels)}
                  />
                </PortfolioField>
              </View>
              <PortfolioTrendChart
                title={`${selected} · ${metricLabel}`}
                currency={metric === 'value'}
                points={points.map(point => ({
                  date: point.date,
                  value: !point.observedConnections
                    ? null
                    : metric === 'price'
                      ? (point.assets[selected]?.price?.price ?? null)
                      : metric === 'quantity'
                        ? (point.assets[selected]?.quantity ?? null)
                        : (point.assets[selected]?.value ?? null),
                  partial: point.assets[selected]?.partial ?? true,
                  stale: point.assets[selected]?.stale ?? false,
                }))}
              />
            </>
          )}
          <View
            role="region"
            aria-label={t('Daily graph observations')}
            tabIndex={0}
            style={{ maxHeight: 420, overflowY: 'auto' }}
          >
            <PortfolioHistoryTable points={points} asset={selected} />
          </View>
        </>
      ) : (
        !query.isPending && (
          <EmptyMessage>
            <Trans>
              No saved observations in this range. History builds as exchanges
              sync.
            </Trans>
          </EmptyMessage>
        )
      )}
    </View>
  );
}
