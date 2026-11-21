import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
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
  onImport: (id: string, document: unknown) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  return (
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
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
      <label>
        <Trans>Import history or dated holdings</Trans>
        <input
          aria-label={t('Import history or dated holdings')}
          type="file"
          accept=".json"
          disabled={disabled}
          onChange={async event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const input = event.target;
            setError('');
            try {
              if (file.size > 10 * 1024 * 1024) {
                throw new Error('Archive too large');
              }
              await onImport(id, JSON.parse(await file.text()) as unknown);
              input.value = '';
            } catch {
              setError(
                t(
                  'Unable to import archive. Use a valid finance JSON file smaller than 10 MB.',
                ),
              );
            }
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
    </View>
  );
}
