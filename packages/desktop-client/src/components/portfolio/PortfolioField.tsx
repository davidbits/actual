import type { ReactNode } from 'react';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

export const dateInputClassName = css({
  colorScheme: 'light',
  '[data-theme="dark"] &, [data-theme="midnight"] &': { colorScheme: 'dark' },
  '@media (prefers-color-scheme: dark)': {
    '[data-theme="auto"] &': { colorScheme: 'dark' },
  },
});

export function PortfolioField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <label
        htmlFor={id}
        className={css({
          color: theme.pageText,
          fontSize: 13,
          fontWeight: 500,
        })}
      >
        {label}
      </label>
      {children}
      {hint && (
        <Text style={{ fontSize: 12, color: theme.pageTextSubdued }}>
          {hint}
        </Text>
      )}
    </View>
  );
}
