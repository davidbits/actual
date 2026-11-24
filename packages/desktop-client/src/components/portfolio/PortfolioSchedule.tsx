import { useId, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { MAX_REFRESH_MINUTES, MIN_REFRESH_MINUTES } from '@actual-app/finance';
import type { ConnectInput, ConnectionSummary } from '@actual-app/finance';

import { PortfolioField } from './PortfolioField';

export function PortfolioSchedule({
  connection,
  busy,
  onSave,
}: {
  connection: ConnectionSummary;
  busy: boolean;
  onSave: (input: ConnectInput) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [minutes, setMinutes] = useState(String(connection.intervalMinutes));
  const lastAttempt = connection.lastAttempt ?? connection.lastSuccess;
  return (
    <form
      onSubmit={async event => {
        event.preventDefault();
        await onSave({ ...connection, intervalMinutes: Number(minutes) });
      }}
    >
      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <PortfolioField id={id} label={t('Refresh interval in minutes')}>
            <Input
              id={id}
              type="number"
              min={MIN_REFRESH_MINUTES}
              max={MAX_REFRESH_MINUTES}
              required
              value={minutes}
              onChangeValue={setMinutes}
              disabled={busy}
              style={{ width: 160 }}
            />
          </PortfolioField>
          <Button
            type="submit"
            isDisabled={busy || Number(minutes) === connection.intervalMinutes}
          >
            <Trans>Save schedule</Trans>
          </Button>
        </View>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>
            Choose 5–1,440 minutes. Updates run on the sync server, even with
            the browser closed. Keep the server running.
          </Trans>
        </Text>
        {connection.enabled && (
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            {lastAttempt === undefined
              ? t('First sync pending')
              : t('Next sync due {{date}}', {
                  date: new Date(
                    lastAttempt + connection.intervalMinutes * 60000,
                  ).toLocaleString(),
                })}
          </Text>
        )}
      </View>
    </form>
  );
}
