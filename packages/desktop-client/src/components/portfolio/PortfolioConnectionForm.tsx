import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';
import type { ConnectInput, ProviderDefinition } from '@actual-app/finance';

export function PortfolioConnectionForm({
  providers,
  busy,
  onConnect,
}: {
  providers: ProviderDefinition[];
  busy: boolean;
  onConnect: (input: ConnectInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState('luno');
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [historyStart, setHistoryStart] = useState('2010-01-01');
  const [symbols, setSymbols] = useState('');
  const [interval, setInterval] = useState(15);
  return (
    <form
      onSubmit={async event => {
        event.preventDefault();
        await onConnect({
          provider,
          name:
            name || providers.find(p => p.id === provider)?.name || provider,
          credentials: { key, secret, passphrase: passphrase || undefined },
          enabled: true,
          intervalMinutes: interval,
          historyStart,
          symbols: symbols
            .split(/[\s,]+/)
            .map(s => s.trim().toUpperCase())
            .filter(Boolean),
        });
        setKey('');
        setSecret('');
        setPassphrase('');
      }}
    >
      <View style={{ gap: 12, maxWidth: 560 }}>
        <h3>
          <Trans>Connect an exchange</Trans>
        </h3>
        <label>
          <Trans>Provider</Trans>
          <select
            aria-label={t('Provider')}
            value={provider}
            onChange={event => setProvider(event.target.value)}
            style={{ marginLeft: 12 }}
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Trans>Connection name</Trans>
          <input
            aria-label={t('Connection name')}
            value={name}
            onChange={event => setName(event.target.value)}
          />
        </label>
        <label>
          <Trans>API key</Trans>
          <input
            type="password"
            autoComplete="off"
            required
            aria-label={t('API key')}
            value={key}
            onChange={event => setKey(event.target.value)}
          />
        </label>
        <label>
          <Trans>API secret</Trans>
          <input
            type="password"
            autoComplete="off"
            required
            aria-label={t('API secret')}
            value={secret}
            onChange={event => setSecret(event.target.value)}
          />
        </label>
        {providers.find(p => p.id === provider)?.passphrase && (
          <label>
            <Trans>API passphrase</Trans>
            <input
              type="password"
              autoComplete="off"
              required
              aria-label={t('API passphrase')}
              value={passphrase}
              onChange={event => setPassphrase(event.target.value)}
            />
          </label>
        )}
        <label>
          <Trans>History start</Trans>
          <input
            type="date"
            required
            aria-label={t('History start')}
            value={historyStart}
            onChange={event => setHistoryStart(event.target.value)}
          />
        </label>
        <label>
          <Trans>Refresh interval in minutes</Trans>
          <input
            type="number"
            min={5}
            max={10080}
            aria-label={t('Refresh interval in minutes')}
            value={interval}
            onChange={event => setInterval(Number(event.target.value))}
          />
        </label>
        <label>
          <Trans>Historical trading symbols</Trans>
          <input
            aria-label={t('Historical trading symbols')}
            value={symbols}
            onChange={event => setSymbols(event.target.value)}
          />
        </label>
        <p>
          <Trans>
            Include sold and delisted trading pairs when collecting Binance
            history. Each connection reports any unavailable or incomplete data.
          </Trans>
        </p>
        <p>
          <Trans>
            Credentials are stored encrypted on your sync server. Collection
            continues while the browser is closed.
          </Trans>
        </p>
        <Button type="submit" isDisabled={busy || !providers.length}>
          <Trans>Save connection</Trans>
        </Button>
      </View>
    </form>
  );
}
