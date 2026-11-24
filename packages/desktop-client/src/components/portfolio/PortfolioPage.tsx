import { useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import type { ConnectInput, Portfolio } from '@actual-app/finance';
import { css } from '@emotion/css';
import { useQueryClient } from '@tanstack/react-query';

import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page } from '#components/Page';
import { portfolioQuery, usePortfolio } from '#finance/queries';
import { useNavigate } from '#hooks/useNavigate';

import { PortfolioActivity } from './PortfolioActivity';
import { PortfolioChanges } from './PortfolioChanges';
import { PortfolioConnections } from './PortfolioConnections';
import { dateInputClassName } from './PortfolioField';
import { PortfolioHoldings } from './PortfolioHoldings';
import { PortfolioPositions } from './PortfolioPositions';
import { PortfolioPrices } from './PortfolioPrices';
import { PortfolioSummary } from './PortfolioSummary';

export function PortfolioPage() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const navigate = useNavigate();
  const { connectionId } = useParams<{ connectionId: string }>();
  const {
    portfolio: current,
    offline,
    budgetId,
    isPending,
    isFetching,
    refetch,
    providers,
  } = usePortfolio();
  const client = useQueryClient();
  const [history, setHistory] = useState<{
    portfolio: Portfolio;
    at: number;
  }>();
  const [date, setDate] = useState('');
  const [tab, setTab] = useState('holdings');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const source = history?.portfolio ?? current;
  const connections = source.connections.filter(
    c => !connectionId || c.id === connectionId,
  );
  const collections = Object.fromEntries(
    Object.entries(source.collections).filter(
      ([id]) => !connectionId || id === connectionId,
    ),
  );
  const assets = new Set([
    ...Object.values(collections).flatMap(c => c.holdings.map(h => h.asset)),
    ...connections.flatMap(
      c =>
        source.comparison?.collections[c.id]?.holdings.map(h => h.asset) ?? [],
    ),
    'USD',
    'USDT',
    'ZAR',
  ]);
  const portfolio = {
    ...source,
    connections,
    collections,
    prices: source.prices.filter(p => assets.has(p.asset)),
  };
  const at = history?.at ?? current.updatedAt;

  async function run(
    action: () => Promise<Portfolio>,
    historicalAt?: number,
  ): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      const result = await action();
      if (historicalAt !== undefined) {
        setHistory({ portfolio: result, at: historicalAt });
      } else {
        client.setQueryData(portfolioQuery(budgetId).queryKey, {
          portfolio: result,
          offline: false,
          providers,
        });
        setHistory(undefined);
        setDate('');
      }
      return true;
    } catch {
      setError(
        t(
          'Unable to complete request. Check connection settings and server status.',
        ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const onConnect = (input: ConnectInput) =>
    run(() => send('finance/connect', input));
  const tabs = [
    ['holdings', t('Holdings')],
    ['activity', t('Activity')],
    ['positions', t('Positions')],
    ['prices', t('Prices and rates')],
    ['changes', t('Changes')],
    ['connections', t('Connections')],
  ];
  return (
    <Page
      header={
        isNarrowWidth ? (
          <MobilePageHeader
            title={
              connectionId
                ? (connections[0]?.name ?? t('Exchange portfolio'))
                : t('Exchange portfolios')
            }
            leftContent={
              <MobileBackButton onPress={() => void navigate('/accounts')} />
            }
          />
        ) : connectionId ? (
          (connections[0]?.name ?? t('Exchange portfolio'))
        ) : (
          t('Exchange portfolios')
        )
      }
    >
      <View
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: isNarrowWidth ? 80 : 20,
        }}
      >
        <View style={{ flexShrink: 0, gap: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              paddingTop: 16,
            }}
          >
            <Select
              id="portfolio-exchange"
              options={[
                ['', t('All exchanges')],
                ...current.connections.map(c => [c.id, c.name] as const),
              ]}
              value={connectionId ?? ''}
              onChange={id =>
                void navigate(id ? `/portfolio/${id}` : '/portfolio')
              }
            />
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button
                isDisabled={busy || isFetching}
                onPress={async () => {
                  await refetch();
                  setHistory(undefined);
                  setDate('');
                }}
              >
                <Trans>Refresh saved data</Trans>
              </Button>
              <Button
                variant="primary"
                isDisabled={busy || offline || !current.connections.length}
                onPress={() =>
                  void run(() => send('finance/sync', { id: connectionId }))
                }
              >
                <Trans>Sync exchanges</Trans>
              </Button>
            </View>
          </View>
          {(offline || error) && (
            <View
              role={error ? 'alert' : 'status'}
              style={{
                padding: '10px 12px',
                borderRadius: 4,
                backgroundColor: theme.warningBackground,
                color: theme.warningText,
              }}
            >
              {error || t('Server unavailable. Showing last saved portfolio.')}
            </View>
          )}
          {(busy || isPending) && (
            <Text role="status" style={{ color: theme.pageTextSubdued }}>
              <Trans>Loading portfolio…</Trans>
            </Text>
          )}
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <PortfolioSummary
              portfolio={portfolio}
              at={at}
              historical={!!history}
            />
            <View style={{ gap: 6, paddingBottom: 18 }}>
              <label
                htmlFor="portfolio-date"
                className={css({ fontSize: 12, color: theme.pageTextSubdued })}
              >
                <Trans>Valuation date</Trans>
              </label>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <Input
                  id="portfolio-date"
                  type="date"
                  className={dateInputClassName}
                  value={date}
                  onChangeValue={setDate}
                  style={{ width: 150 }}
                />
                <Button
                  isDisabled={busy || offline || !date}
                  onPress={() => {
                    const instant = Math.min(
                      Date.now(),
                      Date.parse(`${date}T23:59:59+02:00`),
                    );
                    void run(
                      () => send('finance/history', { at: instant }),
                      instant,
                    );
                  }}
                >
                  <Trans>View history</Trans>
                </Button>
                {history && (
                  <Button
                    onPress={() => {
                      setHistory(undefined);
                      setDate('');
                    }}
                  >
                    <Trans>Latest</Trans>
                  </Button>
                )}
              </View>
            </View>
          </View>
          <Tabs
            selectedKey={current.connections.length ? tab : 'connections'}
            onSelectionChange={key => setTab(String(key))}
          >
            <TabList
              aria-label={t('Portfolio sections')}
              className={css({
                display: 'flex',
                gap: 4,
                borderBottom: `1px solid ${theme.tableBorder}`,
                overflowX: 'auto',
                marginBottom: 16,
              })}
            >
              {tabs.map(([id, label]) => (
                <Tab
                  key={id}
                  id={id}
                  className={css({
                    padding: '10px 14px',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    cursor: 'pointer',
                    outline: 'none',
                    color: theme.pageTextLight,
                    borderBottom: '2px solid transparent',
                    '&[data-selected]': {
                      color: theme.pageTextLink,
                      borderColor: theme.pageTextLink,
                      fontWeight: 600,
                    },
                    '&[data-focus-visible]': {
                      boxShadow: `inset 0 0 0 2px ${theme.formInputBorderSelected}`,
                      borderRadius: 4,
                    },
                  })}
                >
                  {label}
                </Tab>
              ))}
            </TabList>
            <TabPanel id="holdings">
              <PortfolioHoldings portfolio={portfolio} at={at} />
            </TabPanel>
            <TabPanel id="activity">
              <PortfolioActivity
                key={connectionId ?? 'all'}
                portfolio={portfolio}
              />
            </TabPanel>
            <TabPanel id="positions">
              <PortfolioPositions portfolio={portfolio} />
            </TabPanel>
            <TabPanel id="prices">
              <PortfolioPrices prices={portfolio.prices} at={at} />
            </TabPanel>
            <TabPanel id="changes">
              <PortfolioChanges portfolio={portfolio} at={at} />
            </TabPanel>
            <TabPanel id="connections">
              <PortfolioConnections
                portfolio={{
                  ...current,
                  connections: current.connections.filter(
                    c => !connectionId || c.id === connectionId,
                  ),
                }}
                providers={providers}
                busy={busy}
                onConnect={onConnect}
                onSync={id => run(() => send('finance/sync', { id }))}
                onRemove={async id => {
                  const removed = await run(() =>
                    send('finance/remove', { id }),
                  );
                  if (removed && id === connectionId) {
                    void navigate('/portfolio');
                  }
                  return removed;
                }}
                onImport={(id, document) =>
                  run(() => send('finance/import', { id, document }))
                }
              />
            </TabPanel>
          </Tabs>
        </View>
      </View>
    </Page>
  );
}
