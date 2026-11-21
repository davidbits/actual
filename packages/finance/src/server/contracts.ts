import type {
  Collection,
  Credentials,
  FinanceEvent,
  ProviderDefinition,
} from '#types';

export type JsonObject = Record<string, unknown>;
export type RequestParams = Record<
  string,
  string | number | boolean | undefined
>;

export type Resource = {
  host?: 'spot' | 'futures' | 'coin-futures';
  method?: 'GET' | 'POST';
  path: string;
  public?: boolean;
};

export type Request = (
  resource: Resource,
  params?: RequestParams,
) => Promise<unknown>;

export type CollectOptions = {
  from: number;
  through: number;
  cursors: Record<string, string>;
  symbols: string[];
  maxPages?: number;
};

export type ExchangeAdapter = {
  definition: ProviderDefinition;
  collect(options: CollectOptions): Promise<Collection>;
};

export type AdapterDependencies = {
  request: Request;
};

export type AdapterRegistration = {
  definition: ProviderDefinition;
  resources: Resource[];
  create(dependencies: AdapterDependencies): ExchangeAdapter;
};

export type TransportOptions = {
  credentials: Credentials;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
};

export type EventPage = {
  events: FinanceEvent[];
  cursor?: string;
  exhausted: boolean;
};
