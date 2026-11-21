import { quantity } from './decimal';
import type { Collection, FinanceEvent, Price } from './types';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an object');
  }
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.length ||
    value.length > 500 ||
    Array.from(value).some(character => character.charCodeAt(0) < 32)
  ) {
    throw new Error('Invalid text');
  }
  return value;
}
function instant(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > Date.now()
  ) {
    throw new Error('Invalid timestamp');
  }
  return value;
}
function list(value: unknown, max: number) {
  if (!Array.isArray(value) || value.length > max) {
    throw new Error('Invalid list');
  }
  return value.map(record);
}

export function parseFinanceImport(input: unknown): {
  collection: Collection;
  prices: Price[];
} {
  const data = record(input);
  if (data.version !== 1) throw new Error('Unsupported import version');
  const source = record(data.collection);
  const accounts = list(source.accounts, 1000).map(a => ({
    id: text(a.id),
    name: text(a.name),
    product: text(a.product),
    parentId: a.parentId === undefined ? undefined : text(a.parentId),
  }));
  const ids = new Set(accounts.map(a => a.id));
  if (ids.size !== accounts.length) {
    throw new Error('Duplicate account IDs in import');
  }
  if (accounts.some(a => a.parentId && !ids.has(a.parentId))) {
    throw new Error('Unknown parent account');
  }
  const events: FinanceEvent[] = list(source.events ?? [], 100000).map(e => ({
    id: text(e.id),
    accountId: text(e.accountId),
    stream: text(e.stream),
    timestamp: instant(e.timestamp),
    type: text(e.type),
    status:
      e.status === 'pending'
        ? 'pending'
        : e.status === 'booked'
          ? 'booked'
          : invalidStatus(),
    postings: list(e.postings, 100).map(p => {
      const role = p.role;
      if (
        role !== 'principal' &&
        role !== 'fee' &&
        role !== 'reward' &&
        role !== 'interest' &&
        role !== 'funding' &&
        role !== 'pnl'
      ) {
        throw new Error('Invalid posting role');
      }
      return { asset: text(p.asset), quantity: quantity(p.quantity), role };
    }),
    reference: e.reference === undefined ? undefined : text(e.reference),
    description: e.description === undefined ? undefined : text(e.description),
    transactionHash:
      e.transactionHash === undefined ? undefined : text(e.transactionHash),
  }));
  const holdings = list(source.holdings ?? [], 10000).map(h => ({
    stream: h.stream === undefined ? undefined : text(h.stream),
    accountId: text(h.accountId),
    asset: text(h.asset),
    quantity: quantity(h.quantity),
    debt: h.debt === undefined ? undefined : quantity(h.debt),
    available: h.available === undefined ? undefined : quantity(h.available),
    unrealizedPnl:
      h.unrealizedPnl === undefined ? undefined : quantity(h.unrealizedPnl),
    observedAt: h.observedAt === undefined ? undefined : instant(h.observedAt),
  }));
  const positions = list(source.positions ?? [], 10000).map(p => ({
    stream: p.stream === undefined ? undefined : text(p.stream),
    id: text(p.id),
    accountId: text(p.accountId),
    symbol: text(p.symbol),
    settlementAsset: text(p.settlementAsset),
    quantity: quantity(p.quantity),
    entryPrice: quantity(p.entryPrice),
    markPrice: p.markPrice === undefined ? undefined : quantity(p.markPrice),
    unrealizedPnl: quantity(p.unrealizedPnl),
    side: text(p.side),
  }));
  if (new Set(positions.map(p => p.id)).size !== positions.length) {
    throw new Error('Duplicate position IDs in import');
  }
  if (
    [...events, ...holdings, ...positions].some(row => !ids.has(row.accountId))
  ) {
    throw new Error('Unknown imported account');
  }
  if (new Set(events.map(e => e.id)).size !== events.length) {
    throw new Error('Duplicate event IDs in import');
  }
  const at = instant(source.timestamp);
  return {
    collection: {
      timestamp: at,
      accounts,
      holdings,
      events,
      positions,
      cursors: {},
      coverage: [
        {
          stream: 'statement-import',
          status: 'partial',
          reason:
            'User-supplied history; verify completeness against statements',
        },
      ],
    },
    prices: list(data.prices ?? [], 100000).map(p => ({
      asset: text(p.asset),
      quote: text(p.quote),
      price: quantity(p.price),
      timestamp: instant(p.timestamp),
      source: text(p.source),
    })),
  };
}

function invalidStatus(): never {
  throw new Error('Invalid event status');
}
