import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  ConnectInput,
  Portfolio,
  ProviderDefinition,
} from '@actual-app/finance';
import { css } from '@emotion/css';

import { PortfolioArchive } from './PortfolioArchive';
import { PortfolioConnectionForm } from './PortfolioConnectionForm';
import { PortfolioSchedule } from './PortfolioSchedule';
import { PortfolioTable } from './PortfolioTable';

export function PortfolioConnections({
  portfolio,
  providers,
  busy,
  onConnect,
  onSync,
  onRemove,
  onImport,
}: {
  portfolio: Portfolio;
  providers: ProviderDefinition[];
  busy: boolean;
  onConnect: (input: ConnectInput) => Promise<boolean>;
  onSync: (id: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onImport: (id: string, document: unknown) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [removeId, setRemoveId] = useState<string>();
  return (
    <View style={{ gap: 20 }}>
      {portfolio.connections.map(connection => {
        const data = portfolio.collections[connection.id];
        const issues = data?.coverage.filter(c => c.status !== 'ok') ?? [];
        return (
          <View
            key={connection.id}
            style={{
              backgroundColor: theme.tableBackground,
              border: `1px solid ${theme.tableBorder}`,
              borderRadius: 4,
              padding: 16,
              gap: 14,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ gap: 5 }}>
                <Text style={{ fontWeight: 600, fontSize: 15 }}>
                  {connection.name}
                </Text>
                <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                  {connection.enabled
                    ? t('Automatic sync every {{minutes}} minutes', {
                        minutes: connection.intervalMinutes,
                      })
                    : t('Automatic sync paused')}
                </Text>
                <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                  {connection.lastSuccess
                    ? t('Last synced {{date}}', {
                        date: new Date(connection.lastSuccess).toLocaleString(),
                      })
                    : t('Not yet synced')}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  isDisabled={busy}
                  onPress={() => void onSync(connection.id)}
                >
                  <Trans>Sync connection</Trans>
                </Button>
                <Button
                  isDisabled={busy}
                  onPress={() =>
                    void onConnect({
                      ...connection,
                      enabled: !connection.enabled,
                    })
                  }
                >
                  {connection.enabled ? t('Pause') : t('Resume')}
                </Button>
              </View>
            </View>
            <PortfolioSchedule
              key={`${connection.id}:${connection.intervalMinutes}`}
              connection={connection}
              busy={busy}
              onSave={onConnect}
            />
            {connection.error && (
              <Text role="status" style={{ color: theme.warningText }}>
                {connection.error}
              </Text>
            )}
            <details
              className={css({
                fontSize: 13,
                '& summary': {
                  cursor: 'pointer',
                  color: theme.pageTextLink,
                  padding: '4px 0',
                },
                '&[open] summary': { marginBottom: 10 },
              })}
            >
              <summary>
                {issues.length
                  ? t('Data coverage · {{count}} streams need attention', {
                      count: issues.length,
                    })
                  : t('Data coverage')}
              </summary>
              <PortfolioTable label={t('Connection coverage')}>
                <thead>
                  <tr>
                    <th>
                      <Trans>Source</Trans>
                    </th>
                    <th>
                      <Trans>Status</Trans>
                    </th>
                    <th>
                      <Trans>Details</Trans>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.coverage.map((coverage, index) => (
                    <tr key={index}>
                      <td>{coverage.stream}</td>
                      <td>{coverage.status}</td>
                      <td>{coverage.reason ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </PortfolioTable>
            </details>
            <PortfolioArchive
              id={connection.id}
              collection={data}
              prices={portfolio.prices}
              disabled={busy}
              onImport={onImport}
            />
            <View style={{ alignItems: 'flex-start', gap: 8 }}>
              {removeId === connection.id ? (
                <View style={{ gap: 8 }}>
                  <Text>
                    <Trans>
                      Remove this connection and its saved exchange data?
                    </Trans>
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      isDisabled={busy}
                      onPress={async () => {
                        if (await onRemove(connection.id)) {
                          setRemoveId(undefined);
                        }
                      }}
                    >
                      <Trans>Remove saved data</Trans>
                    </Button>
                    <Button onPress={() => setRemoveId(undefined)}>
                      <Trans>Cancel</Trans>
                    </Button>
                  </View>
                </View>
              ) : (
                <Button
                  variant="bare"
                  isDisabled={busy}
                  style={{ color: theme.errorText }}
                  onPress={() => setRemoveId(connection.id)}
                >
                  <Trans>Disconnect exchange</Trans>
                </Button>
              )}
            </View>
          </View>
        );
      })}
      {!portfolio.connections.length || adding ? (
        <View
          style={{
            backgroundColor: theme.tableBackground,
            border: `1px solid ${theme.tableBorder}`,
            borderRadius: 4,
            padding: 20,
          }}
        >
          <PortfolioConnectionForm
            providers={providers}
            busy={busy}
            onConnect={async input => {
              const result = await onConnect(input);
              if (result) setAdding(false);
              return result;
            }}
          />
        </View>
      ) : (
        <View style={{ alignItems: 'flex-start' }}>
          <Button onPress={() => setAdding(true)}>
            <Trans>Add exchange</Trans>
          </Button>
        </View>
      )}
    </View>
  );
}
