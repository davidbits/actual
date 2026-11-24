import { useId, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { ConnectInput, ProviderDefinition } from '@actual-app/finance';
import {
  DEFAULT_REFRESH_MINUTES,
  MAX_REFRESH_MINUTES,
  MIN_REFRESH_MINUTES,
} from '@actual-app/finance';
import { css } from '@emotion/css';

import { dateInputClassName, PortfolioField } from './PortfolioField';

export function PortfolioConnectionForm({
  providers,
  busy,
  onConnect,
}: {
  providers: ProviderDefinition[];
  busy: boolean;
  onConnect: (input: ConnectInput) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const prefix = useId();
  const [provider, setProvider] = useState('luno');
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [historyStart, setHistoryStart] = useState('2010-01-01');
  const [symbols, setSymbols] = useState('');
  const [interval, setInterval] = useState(String(DEFAULT_REFRESH_MINUTES));
  return (
    <form
      onSubmit={async event => {
        event.preventDefault();
        const saved = await onConnect({
          provider,
          name:
            name || providers.find(p => p.id === provider)?.name || provider,
          credentials: { key, secret, passphrase: passphrase || undefined },
          enabled: true,
          intervalMinutes: Number(interval),
          historyStart,
          symbols: symbols
            .split(/[\s,]+/)
            .map(s => s.trim().toUpperCase())
            .filter(Boolean),
        });
        if (saved) {
          setKey('');
          setSecret('');
          setPassphrase('');
          setName('');
        }
      }}
    >
      <View style={{ gap: 16, maxWidth: 680 }}>
        <Text style={{ fontSize: 16, fontWeight: 600 }}>
          <Trans>Connect an exchange</Trans>
        </Text>
        <View
          className={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 16,
            '@media (max-width: 650px)': { gridTemplateColumns: '1fr' },
          })}
        >
          <PortfolioField id={prefix + 'provider'} label={t('Provider')}>
            <Select
              id={prefix + 'provider'}
              options={providers.map(p => [p.id, p.name])}
              value={provider}
              onChange={setProvider}
              disabled={busy || !providers.length}
            />
          </PortfolioField>
          <PortfolioField id={prefix + 'name'} label={t('Connection name')}>
            <Input
              id={prefix + 'name'}
              value={name}
              onChangeValue={setName}
              placeholder={t('Optional name')}
            />
          </PortfolioField>
          <PortfolioField id={prefix + 'key'} label={t('API key')}>
            <Input
              id={prefix + 'key'}
              type="password"
              autoComplete="off"
              required
              value={key}
              onChangeValue={setKey}
            />
          </PortfolioField>
          <PortfolioField id={prefix + 'secret'} label={t('API secret')}>
            <Input
              id={prefix + 'secret'}
              type="password"
              autoComplete="off"
              required
              value={secret}
              onChangeValue={setSecret}
            />
          </PortfolioField>
          {providers.find(p => p.id === provider)?.passphrase && (
            <PortfolioField
              id={prefix + 'passphrase'}
              label={t('API passphrase')}
            >
              <Input
                id={prefix + 'passphrase'}
                type="password"
                autoComplete="off"
                required
                value={passphrase}
                onChangeValue={setPassphrase}
              />
            </PortfolioField>
          )}
          <PortfolioField id={prefix + 'history'} label={t('History start')}>
            <Input
              id={prefix + 'history'}
              type="date"
              className={dateInputClassName}
              required
              value={historyStart}
              onChangeValue={setHistoryStart}
            />
          </PortfolioField>
          <PortfolioField
            id={prefix + 'interval'}
            label={t('Refresh interval in minutes')}
          >
            <Input
              id={prefix + 'interval'}
              type="number"
              min={MIN_REFRESH_MINUTES}
              max={MAX_REFRESH_MINUTES}
              required
              value={interval}
              onChangeValue={setInterval}
            />
          </PortfolioField>
          <PortfolioField
            id={prefix + 'symbols'}
            label={t('Historical trading symbols')}
            hint={t(
              'Optional pairs for symbol-specific history, including delisted markets.',
            )}
          >
            <Input
              id={prefix + 'symbols'}
              value={symbols}
              onChangeValue={setSymbols}
            />
          </PortfolioField>
        </View>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>
            Use a read-only API key. Credentials are stored encrypted on your
            sync server.
          </Trans>
        </Text>
        <View style={{ alignItems: 'flex-start' }}>
          <Button
            type="submit"
            variant="primary"
            isDisabled={busy || !providers.length}
          >
            <Trans>Save connection</Trans>
          </Button>
        </View>
      </View>
    </form>
  );
}
