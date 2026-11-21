export type StatementTransaction = {
  line: number;
  date: string;
  secondaryDate?: string;
  description: string;
  /** Integer minor units, with the bank's signed cash-flow convention. */
  amount: number;
  balance?: number;
  importedId: string;
  provisional: boolean;
};

export type StatementIssue = {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  line?: number;
};

export type BankStatement = {
  provider: string;
  account: {
    fingerprint: string;
    maskedNumber: string;
    description: string;
    kind: 'current' | 'credit';
    currency: string;
  };
  transactions: StatementTransaction[];
  from?: string;
  through?: string;
  openingBalance?: number;
  openingBalanceInferred: boolean;
  closingBalance?: number;
  balanceChecks: number;
  skipped: { metadata: number; balanceMarkers: number; notices: number };
  issues: StatementIssue[];
};

export type StatementAdapter = {
  id: string;
  name: string;
  detect(text: string): boolean;
  parse(text: string): BankStatement;
};

export type StatementDateField = 'primary' | 'secondary';
