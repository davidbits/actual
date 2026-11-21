import type { ReactNode } from 'react';

import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';

export function PortfolioTable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        width: '100%',
        overflowX: 'auto',
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 4,
        backgroundColor: theme.tableBackground,
      })}
    >
      <table
        aria-label={label}
        className={css({
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: 13,
          color: theme.tableText,
          '& th': {
            backgroundColor: theme.tableHeaderBackground,
            color: theme.tableHeaderText,
            fontWeight: 500,
            fontSize: 12,
            whiteSpace: 'nowrap',
          },
          '& th, & td': {
            padding: '10px 12px',
            borderBottom: `1px solid ${theme.tableBorder}`,
            verticalAlign: 'middle',
          },
          '& tbody tr:last-child td': { borderBottom: 0 },
          '& tbody tr:hover': {
            backgroundColor: theme.tableRowBackgroundHover,
          },
          '& .number': {
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          },
          '& .subdued': { color: theme.pageTextSubdued, fontSize: 12 },
        })}
      >
        {children}
      </table>
    </div>
  );
}
