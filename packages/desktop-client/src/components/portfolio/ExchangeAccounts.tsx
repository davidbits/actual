import { Trans, useTranslation } from 'react-i18next';

import { AlignedText } from '@actual-app/components/aligned-text';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { valueHoldings } from '@actual-app/finance';

import { Link } from '#components/common/Link';
import { usePortfolio } from '#finance/queries';

import { PortfolioMoney } from './PortfolioMoney';

export function ExchangeAccounts({
  variant = 'classic',
}: {
  variant?: 'classic' | 'redesign' | 'mobile';
}) {
  const { t } = useTranslation();
  const { portfolio } = usePortfolio();
  if (!portfolio.connections.length) return null;
  const mobile = variant === 'mobile';
  const at = portfolio.updatedAt;
  const total = valueHoldings(
    Object.values(portfolio.collections).flatMap(c => c.holdings),
    portfolio.prices,
    at,
  );
  const incomplete =
    total.unpriced > 0 ||
    portfolio.connections.some(c => !!c.error || !portfolio.collections[c.id]);
  const color = mobile ? theme.pageText : theme.sidebarItemText;
  return (
    <View
      role="navigation"
      aria-label={t('Exchange accounts')}
      data-testid="sidebar-exchange-accounts"
      style={{ flexShrink: 0, marginTop: 16, marginBottom: 12 }}
    >
      <Link
        variant="internal"
        to="/portfolio"
        isExactPathMatch
        style={{
          padding: mobile ? '12px 18px' : '7px 14px',
          textDecoration: 'none',
          color,
          fontSize: 13,
          fontWeight: 600,
        }}
        activeStyle={{
          color: mobile ? theme.pageTextLink : theme.sidebarItemTextSelected,
        }}
      >
        <AlignedText
          style={
            variant === 'classic'
              ? {
                  borderBottom: '1.5px solid rgba(255,255,255,0.4)',
                  paddingBottom: 3,
                }
              : undefined
          }
          left={<Trans>Exchanges</Trans>}
          right={
            <View
              title={
                incomplete
                  ? t('Priced balance; some assets have no quote')
                  : t('Portfolio value in ZAR')
              }
              style={{
                flexDirection: 'row',
                gap: 3,
                justifyContent: 'flex-end',
              }}
            >
              {incomplete && '~'}
              <PortfolioMoney value={total.total} />
            </View>
          }
        />
      </Link>
      {portfolio.connections.map(connection => {
        const collection = portfolio.collections[connection.id];
        const value = collection
          ? valueHoldings(collection.holdings, portfolio.prices, at)
          : undefined;
        return (
          <Link
            key={connection.id}
            variant="internal"
            to={`/portfolio/${connection.id}`}
            style={{
              padding: mobile ? '13px 18px' : '6px 14px',
              borderLeft: '4px solid transparent',
              textDecoration: 'none',
              color,
              fontSize: 13,
              borderRadius: variant === 'redesign' ? 4 : 0,
              ':hover': {
                backgroundColor: mobile
                  ? theme.tableRowBackgroundHover
                  : theme.sidebarItemBackgroundHover,
              },
            }}
            activeStyle={{
              borderColor: theme.sidebarItemAccentSelected,
              color: mobile
                ? theme.pageTextLink
                : theme.sidebarItemTextSelected,
              backgroundColor: mobile
                ? theme.tableRowBackgroundHover
                : theme.sidebarItemBackgroundSelected,
            }}
          >
            <AlignedText
              left={<Text>{connection.name}</Text>}
              right={
                value ? (
                  <View
                    title={
                      value.unpriced || connection.error
                        ? t('Priced balance; some assets have no quote')
                        : t('Portfolio value in ZAR')
                    }
                    style={{
                      flexDirection: 'row',
                      gap: 3,
                      justifyContent: 'flex-end',
                    }}
                  >
                    {(value.unpriced > 0 || !!connection.error) && '~'}
                    <PortfolioMoney value={value.total} />
                  </View>
                ) : (
                  <Text>
                    <Trans>Not synced</Trans>
                  </Text>
                )
              }
            />
          </Link>
        );
      })}
    </View>
  );
}
