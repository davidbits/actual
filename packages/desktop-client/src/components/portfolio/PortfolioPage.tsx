import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import { emptyPortfolio } from '@actual-app/finance';
import type {
  ConnectInput,
  Portfolio,
  ProviderDefinition,
} from '@actual-app/finance';

import { Page } from '#components/Page';

import { PortfolioArchive } from './PortfolioArchive';
import { PortfolioConnectionForm } from './PortfolioConnectionForm';
import { PortfolioHoldings } from './PortfolioHoldings';
import { PortfolioPositions } from './PortfolioPositions';
import { PortfolioPrices } from './PortfolioPrices';

export function PortfolioPage() {
  const { t } = useTranslation();
  const [portfolio, setPortfolio] = useState<Portfolio>(emptyPortfolio);
  const [providers, setProviders] = useState<ProviderDefinition[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [at, setAt] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    void send('finance/get').then(data => {
      if (active) setPortfolio(data);
    });
    void Promise.all([send('finance/pull'), send('finance/providers')])
      .then(([data, definitions]) => {
        if (active) {
          setPortfolio(data);
          setAt(Date.now());
          setProviders(definitions);
        }
      })
      .catch(() => {
        if (active) {
          setError(t('Server unavailable. Showing last saved portfolio.'));
        }
      });
    return () => {
      active = false;
    };
  }, [t]);

  async function run(action: () => Promise<Portfolio>, valuationAt?: number) {
    setBusy(true);
    setError('');
    try {
      setPortfolio(await action());
      setAt(valuationAt ?? Date.now());
      if (valuationAt === undefined) setDate('');
    } catch {
      setError(
        t(
          'Unable to complete request. Check connection settings and server status.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function connect(input: ConnectInput) {
    await run(() => send('finance/connect', input));
  }
  const events = Object.entries(portfolio.collections)
    .flatMap(([id, c]) => c.events.map(e => ({ ...e, connectionId: id })))
    .sort((a, b) => b.timestamp - a.timestamp);
  return (
    <Page header={t('Portfolio')}>
      <View style={{ overflowY: 'auto', flex: 1 }}>
        <View style={{ padding: 20, gap: 20, flexShrink: 0 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Button
              isDisabled={busy}
              onPress={() => {
                setDate('');
                setAt(Date.now());
                void run(() => send('finance/sync', {}));
              }}
            >
              <Trans>Sync exchanges</Trans>
            </Button>
            <Button
              isDisabled={busy}
              onPress={() => {
                setDate('');
                setAt(Date.now());
                void run(() => send('finance/pull'));
              }}
            >
              <Trans>Refresh saved data</Trans>
            </Button>
            <label>
              <Trans>Valuation date</Trans>
              <input
                aria-label={t('Valuation date')}
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
              />
            </label>
            <Button
              isDisabled={busy || !date}
              onPress={() => {
                const instant = Math.min(
                  Date.now(),
                  Date.parse(`${date}T23:59:59+02:00`),
                );
                setAt(instant);
                void run(
                  () => send('finance/history', { at: instant }),
                  instant,
                );
              }}
            >
              <Trans>View history</Trans>
            </Button>
          </View>
          {busy && (
            <p role="status">
              <Trans>Collecting exchange data…</Trans>
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          {!!date && (
            <p>
              <Trans>
                Historical values use saved holdings checkpoints and prices
                available at the selected date. Dates without checkpoints remain
                unavailable.
              </Trans>
            </p>
          )}
          <PortfolioHoldings portfolio={portfolio} at={at} />
          <PortfolioPrices prices={portfolio.prices} at={at} />
          <PortfolioPositions portfolio={portfolio} />
          <section aria-label={t('Connections')}>
            <h2>
              <Trans>Connections</Trans>
            </h2>
            {portfolio.connections.map(connection => (
              <View key={connection.id} style={{ paddingBottom: 16, gap: 8 }}>
                <strong>{connection.name}</strong>
                <span>
                  {connection.lastSuccess
                    ? new Date(connection.lastSuccess).toLocaleString()
                    : t('Not yet synced')}
                </span>
                {connection.error && (
                  <span role="status">{connection.error}</span>
                )}
                <Button
                  isDisabled={busy}
                  onPress={() =>
                    void run(() => send('finance/sync', { id: connection.id }))
                  }
                >
                  <Trans>Sync connection</Trans>
                </Button>
                <Button
                  isDisabled={busy}
                  onPress={() =>
                    void run(() =>
                      send('finance/remove', { id: connection.id }),
                    )
                  }
                >
                  <Trans>Disconnect and remove collected data</Trans>
                </Button>
                <Button
                  isDisabled={busy}
                  onPress={() =>
                    void run(() =>
                      send('finance/connect', {
                        ...connection,
                        enabled: !connection.enabled,
                      }),
                    )
                  }
                >
                  {connection.enabled
                    ? t('Pause automatic collection')
                    : t('Resume automatic collection')}
                </Button>
                <PortfolioArchive
                  id={connection.id}
                  collection={portfolio.collections[connection.id]}
                  prices={portfolio.prices}
                  disabled={busy}
                  onImport={async (id, document) => {
                    await run(() => send('finance/import', { id, document }));
                  }}
                />
                <details>
                  <summary>
                    <Trans>Data coverage</Trans>
                  </summary>
                  <ul>
                    {portfolio.collections[connection.id]?.coverage.map(
                      (coverage, index) => (
                        <li key={index}>
                          {coverage.stream}: {coverage.status}
                          {coverage.reason ? ` — ${coverage.reason}` : ''}
                        </li>
                      ),
                    )}
                  </ul>
                </details>
              </View>
            ))}
            {!portfolio.connections.length && (
              <p>
                <Trans>
                  Connect an exchange to collect holdings and activity.
                </Trans>
              </p>
            )}
          </section>
          <PortfolioConnectionForm
            providers={providers}
            busy={busy}
            onConnect={connect}
          />
          <section aria-label={t('Exchange activity')}>
            <h2>
              <Trans>Exchange activity</Trans>
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  textAlign: 'left',
                  borderSpacing: '12px 8px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <thead>
                  <tr>
                    <th>
                      <Trans>Date</Trans>
                    </th>
                    <th>
                      <Trans>Type</Trans>
                    </th>
                    <th>
                      <Trans>Asset movements</Trans>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(0, 500).map(event => (
                    <tr key={`${event.connectionId}/${event.id}`}>
                      <td>{new Date(event.timestamp).toLocaleString()}</td>
                      <td>{event.type}</td>
                      <td>
                        {event.postings
                          .map(p => `${p.quantity} ${p.asset}`)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </View>
      </View>
    </Page>
  );
}
