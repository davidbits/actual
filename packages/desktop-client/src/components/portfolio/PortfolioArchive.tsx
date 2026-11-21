import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { Collection, Price } from '@actual-app/finance';

export function PortfolioArchive({
  id,
  collection,
  prices,
  disabled,
  onImport,
}: {
  id: string;
  collection?: Collection;
  prices: Price[];
  disabled: boolean;
  onImport: (id: string, document: unknown) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          isDisabled={disabled || !collection}
          onPress={() => {
            void window.Actual.saveFile(
              JSON.stringify({ version: 1, collection, prices }, null, 2),
              'portfolio-archive.json',
              t('Export portfolio archive'),
            );
          }}
        >
          <Trans>Export archive</Trans>
        </Button>
        <Button isDisabled={disabled} onPress={() => input.current?.click()}>
          <Trans>Import history or dated holdings</Trans>
        </Button>
        <input
          ref={input}
          type="file"
          accept=".json"
          hidden
          aria-label={t('Choose portfolio archive')}
          onChange={async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            setError('');
            try {
              if (file.size > 10 * 1024 * 1024) {
                throw new Error('Archive too large');
              }
              if (
                !(await onImport(id, JSON.parse(await file.text()) as unknown))
              ) {
                throw new Error('Import failed');
              }
            } catch {
              setError(
                t(
                  'Unable to import archive. Use a valid finance JSON file smaller than 10 MB.',
                ),
              );
            } finally {
              if (input.current) input.current.value = '';
            }
          }}
        />
      </View>
      {error && (
        <Text role="alert" style={{ color: theme.errorText }}>
          {error}
        </Text>
      )}
    </View>
  );
}
