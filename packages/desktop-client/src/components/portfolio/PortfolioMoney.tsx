import type { CSSProperties } from '@actual-app/components/styles';
import { Exact, toCents } from '@actual-app/finance';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { useFormat } from '#hooks/useFormat';

export function PortfolioMoney({
  value,
  style,
}: {
  value: string;
  style?: CSSProperties;
}) {
  const format = useFormat();
  return (
    <PrivacyFilter>
      <FinancialText style={style}>
        {format.currency.code === 'ZAR'
          ? format(toCents(value), 'financial')
          : new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency: 'ZAR',
            }).format(new Exact(value).toNumber())}
      </FinancialText>
    </PrivacyFilter>
  );
}

export function displayQuantity(value: string) {
  return new Exact(value).toSignificantDigits(10).toFixed();
}
