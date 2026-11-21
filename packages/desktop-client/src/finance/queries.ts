import { send } from '@actual-app/core/platform/client/connection';
import { emptyPortfolio } from '@actual-app/finance';
import type { Portfolio, ProviderDefinition } from '@actual-app/finance';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { useMetadataPref } from '#hooks/useMetadataPref';

export type PortfolioResult = {
  portfolio: Portfolio;
  offline: boolean;
  providers: ProviderDefinition[];
};

export const portfolioQuery = (budgetId?: string) =>
  queryOptions({
    queryKey: ['finance', budgetId, 'portfolio'],
    enabled: !!budgetId,
    queryFn: (): Promise<PortfolioResult> => send('finance/read'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnMount: 'always',
    retry: false,
    networkMode: 'always',
  });

export function usePortfolio() {
  const [budgetId] = useMetadataPref('id');
  const query = useQuery(portfolioQuery(budgetId));
  return {
    ...query,
    budgetId,
    portfolio: query.data?.portfolio ?? emptyPortfolio(),
    offline: query.data?.offline ?? false,
    providers: query.data?.providers ?? [],
  };
}
