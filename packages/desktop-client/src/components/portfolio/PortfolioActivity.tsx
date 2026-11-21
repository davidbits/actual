import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { Portfolio } from '@actual-app/finance';

import { EmptyMessage } from '#components/common/EmptyMessage';
import { Search } from '#components/common/Search';
import { FinancialText } from '#components/FinancialText';

import { displayQuantity } from './PortfolioMoney';
import { PortfolioTable } from './PortfolioTable';

export function PortfolioActivity({ portfolio }: { portfolio: Portfolio }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const events = Object.entries(portfolio.collections)
    .flatMap(([id, c]) =>
      c.events.map(e => ({
        ...e,
        connectionId: id,
        accountName:
          c.accounts.find(a => a.id === e.accountId)?.name ?? e.accountId,
        exchange:
          portfolio.connections.find(connection => connection.id === id)
            ?.name ?? '',
      })),
    )
    .filter(e =>
      [
        e.type,
        e.description,
        e.reference,
        e.exchange,
        e.accountName,
        ...e.postings.map(p => p.asset),
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.timestamp - a.timestamp);
  return (
    <View role="region" aria-label={t('Exchange activity')} style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Search
          value={search}
          onChange={value => {
            setSearch(value);
            setLimit(100);
          }}
          placeholder={t('Search exchange activity')}
          width={280}
        />
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>
            Showing {{ visible: Math.min(limit, events.length) }} of{' '}
            {{ total: events.length }} collected events
          </Trans>
        </Text>
      </View>
      {!events.length ? (
        <EmptyMessage>
          <Trans>No activity matches this selection.</Trans>
        </EmptyMessage>
      ) : (
        <PortfolioTable label={t('Exchange activity')}>
          <thead>
            <tr>
              <th>
                <Trans>Date</Trans>
              </th>
              <th>
                <Trans>Account</Trans>
              </th>
              <th>
                <Trans>Type</Trans>
              </th>
              <th>
                <Trans>Description</Trans>
              </th>
              <th className="number">
                <Trans>Asset movements</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, limit).map(event => (
              <tr key={`${event.connectionId}/${event.id}`}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(event.timestamp).toLocaleDateString()}
                </td>
                <td>
                  <View style={{ gap: 3 }}>
                    <Text>
                      {event.exchange} / {event.accountName}
                    </Text>
                  </View>
                </td>
                <td>{event.type}</td>
                <td>{event.description ?? event.reference ?? ''}</td>
                <td className="number">
                  <View style={{ gap: 4, alignItems: 'flex-end' }}>
                    {event.postings.map((p, i) => (
                      <FinancialText key={i} title={`${p.quantity} ${p.asset}`}>
                        {displayQuantity(p.quantity)} {p.asset}
                      </FinancialText>
                    ))}
                  </View>
                </td>
              </tr>
            ))}
          </tbody>
        </PortfolioTable>
      )}
      {limit < events.length && (
        <View style={{ alignItems: 'center' }}>
          <Button onPress={() => setLimit(n => n + 100)}>
            <Trans>Show more activity</Trans>
          </Button>
        </View>
      )}
    </View>
  );
}
