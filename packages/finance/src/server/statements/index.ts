import { nedbankStatement } from './nedbank';
import type {
  BankStatement,
  StatementAdapter,
  StatementDateField,
} from './types';

export type * from './types';

/** Provider registration is the only extension point required for another bank. */
export function createStatementFactory(adapters: StatementAdapter[]) {
  const registry = new Map(adapters.map(adapter => [adapter.id, adapter]));
  if (registry.size !== adapters.length) {
    throw new Error('Duplicate statement provider');
  }
  return {
    providers: () => adapters.map(({ id, name }) => ({ id, name })),
    parse(text: string, provider?: string): BankStatement {
      const matches = provider
        ? [registry.get(provider)].filter((a): a is StatementAdapter => !!a)
        : adapters.filter(adapter => adapter.detect(text));
      if (matches.length !== 1) {
        throw new Error('Statement format is unknown or ambiguous');
      }
      return matches[0].parse(text);
    },
  };
}

export const statementFactory = createStatementFactory([nedbankStatement]);

/** Actual's existing importer owns matching, rules, splits and transfer semantics. */
export function statementTransactions(
  statement: BankStatement,
  dateField: StatementDateField = 'primary',
) {
  if (statement.issues.some(issue => issue.severity === 'error')) {
    throw new Error(
      'Statement has reconciliation errors; resolve them before importing',
    );
  }
  return statement.transactions.map(t => ({
    date: dateField === 'secondary' ? (t.secondaryDate ?? t.date) : t.date,
    amount: t.amount,
    imported_id: t.importedId,
    payee_name: t.description,
    imported_payee: t.description,
    cleared: !t.provisional,
    notes: t.secondaryDate
      ? `Statement dates: first ${t.date}; second ${t.secondaryDate}`
      : '',
  }));
}

export function statementSummary(statement: BankStatement) {
  return {
    provider: statement.provider,
    account: statement.account,
    from: statement.from,
    through: statement.through,
    transactions: statement.transactions.length,
    openingBalance: statement.openingBalance,
    openingBalanceInferred: statement.openingBalanceInferred,
    closingBalance: statement.closingBalance,
    balanceChecks: statement.balanceChecks,
    skipped: statement.skipped,
    issues: statement.issues,
  };
}
