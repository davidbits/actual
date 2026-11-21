/** Exact decimal strings cross all persistence and transport boundaries. */
export type Quantity = string;

export type FinanceAccount = {
  id: string;
  name: string;
  product: string;
  parentId?: string;
};

export type Holding = {
  accountId: string;
  asset: string;
  quantity: Quantity;
  available?: Quantity;
  debt?: Quantity;
  unrealizedPnl?: Quantity;
};

export type Position = {
  id: string;
  accountId: string;
  symbol: string;
  settlementAsset: string;
  quantity: Quantity;
  entryPrice: Quantity;
  markPrice?: Quantity;
  unrealizedPnl: Quantity;
  side: string;
};

export type Posting = {
  asset: string;
  quantity: Quantity;
  role: 'principal' | 'fee' | 'reward' | 'interest' | 'funding' | 'pnl';
};

/** One envelope keeps the legs of a trade atomic across device sync. */
export type FinanceEvent = {
  id: string;
  accountId: string;
  stream: string;
  timestamp: number;
  type: string;
  status: 'booked' | 'pending';
  postings: Posting[];
  reference?: string;
  description?: string;
  transactionHash?: string;
};

export type Coverage = {
  stream: string;
  accountId?: string;
  status: 'ok' | 'partial' | 'error' | 'unsupported';
  reason?: string;
  from?: number;
  through?: number;
};

export type Price = {
  asset: string;
  quote: string;
  price: Quantity;
  timestamp: number;
  source: string;
};

export type Collection = {
  timestamp: number;
  accounts: FinanceAccount[];
  holdings: Holding[];
  positions: Position[];
  events: FinanceEvent[];
  coverage: Coverage[];
  cursors: Record<string, string>;
};

export type ConnectionSummary = {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  intervalMinutes: number;
  historyStart: string;
  symbols: string[];
  lastAttempt?: number;
  lastSuccess?: number;
  error?: string;
};

export type Portfolio = {
  version: 1;
  connections: ConnectionSummary[];
  collections: Record<string, Collection>;
  prices: Price[];
  updatedAt: number;
};

export type Credentials = {
  key: string;
  secret: string;
  passphrase?: string;
};

export type ConnectInput = {
  id?: string;
  provider: string;
  name: string;
  credentials?: Credentials;
  enabled: boolean;
  intervalMinutes: number;
  historyStart: string;
  symbols: string[];
};

export type ProviderDefinition = {
  id: string;
  name: string;
  passphrase: boolean;
  products: string[];
};

export const emptyPortfolio = (): Portfolio => ({
  version: 1,
  connections: [],
  collections: {},
  prices: [],
  updatedAt: 0,
});
