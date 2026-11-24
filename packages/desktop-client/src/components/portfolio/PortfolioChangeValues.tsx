import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { portfolioChanges } from '@actual-app/finance';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';

import { displayQuantity, PortfolioMoney } from './PortfolioMoney';

export function PortfolioChangeValues({
  row,
  mobile,
}: {
  row: ReturnType<typeof portfolioChanges>[number];
  mobile: boolean;
}) {
  const { t } = useTranslation();
  const values = [
    {
      label: t('Net units'),
      content: (
        <PrivacyFilter>
          <FinancialText>
            {row.before.net === null ? '—' : displayQuantity(row.before.net)} →{' '}
            {row.after.net === null ? '—' : displayQuantity(row.after.net)}
          </FinancialText>
        </PrivacyFilter>
      ),
    },
    {
      label: t('Rate (ZAR)'),
      content: (
        <>
          <FinancialText>
            {row.before.rate ? displayQuantity(row.before.rate.price) : '—'} →{' '}
            {row.after.rate ? displayQuantity(row.after.rate.price) : '—'}
          </FinancialText>
          {(!row.before.rate || !row.after.rate) && (
            <View className="subdued">
              <Trans>Missing rate</Trans>
            </View>
          )}
        </>
      ),
    },
    {
      label: t('Value (ZAR)'),
      content: (
        <>
          {row.before.value === null ? (
            '—'
          ) : (
            <PortfolioMoney value={row.before.value} />
          )}{' '}
          →{' '}
          {row.after.value === null ? (
            '—'
          ) : (
            <PortfolioMoney value={row.after.value} />
          )}
        </>
      ),
    },
    {
      label: t('Value change (ZAR)'),
      content:
        row.valueChange === null ? (
          t('Unavailable')
        ) : (
          <PortfolioMoney value={row.valueChange} />
        ),
    },
  ];
  return mobile ? (
    <td
      className="number"
      style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
    >
      <View style={{ gap: 10 }}>
        {values.map(value => (
          <View key={value.label} style={{ gap: 3 }}>
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              {value.label}
            </Text>
            <View style={{ display: 'block' }}>{value.content}</View>
          </View>
        ))}
      </View>
    </td>
  ) : (
    <>
      {values.map(value => (
        <td className="number" key={value.label}>
          {value.content}
        </td>
      ))}
    </>
  );
}
