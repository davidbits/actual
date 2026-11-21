import { createHash } from 'node:crypto';

import { parse } from 'csv-parse/sync';

import { Exact, toCents } from '#decimal';

import type { BankStatement, StatementAdapter } from './types';

const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
const months = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

function date(value: string, line: number): string {
  const match = /^(\d{1,2})-?([a-z]{3})-?(\d{4})$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid Nedbank date on line ${line}`);
  const month = months.indexOf(match[2].toLowerCase()) + 1;
  const result = `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const time = Date.parse(result + 'T00:00:00Z');
  if (
    !month ||
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== result
  ) {
    throw new Error(`Invalid Nedbank date on line ${line}`);
  }
  return result;
}

/** Reject rounding, exponent notation and malformed grouping in bank amounts. */
function money(value: string, line: number): number {
  let raw = value
    .trim()
    .replace(/^(?:ZAR|R)\s*/i, '')
    .replace(/\u00a0/g, ' ');
  if (/^\(.*\)$/.test(raw)) raw = '-' + raw.slice(1, -1);
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error(`Invalid Nedbank amount on line ${line}`);
  }
  return toCents(raw.replaceAll(',', ''));
}

type CsvRow = { record: string[]; info: { lines: number } };

function isCsvRow(row: unknown): row is CsvRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'record' in row &&
    Array.isArray(row.record) &&
    row.record.every(cell => typeof cell === 'string') &&
    'info' in row &&
    typeof row.info === 'object' &&
    row.info !== null &&
    'lines' in row.info &&
    typeof row.info.lines === 'number'
  );
}

export const nedbankStatement: StatementAdapter = {
  id: 'nedbank',
  name: 'Nedbank statement enquiry CSV',
  detect: text => /^\uFEFF?\s*"?Statement Enquiry\s*:/i.test(text),
  parse(text) {
    if (text.length > 20 * 1024 * 1024) {
      throw new Error('Statement exceeds 20 MB');
    }
    if (!nedbankStatement.detect(text)) {
      throw new Error('Not a Nedbank statement enquiry CSV');
    }
    let rows: CsvRow[];
    try {
      const parsed: unknown = parse(text, {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        info: true,
        max_record_size: 65536,
      });
      if (!Array.isArray(parsed) || !parsed.every(isCsvRow)) {
        throw new Error('Unexpected CSV record');
      }
      rows = parsed;
    } catch {
      throw new Error('Invalid statement CSV quoting or record size');
    }
    if (rows.length > 100000) throw new Error('Statement exceeds 100,000 rows');
    let accountNumber = '';
    let description = '';
    for (const { record } of rows) {
      const key = clean(record[0] ?? '')
        .replace(/\s*:\s*$/, '')
        .toLowerCase();
      if (key === 'account number') {
        const number = (record[1] ?? '').replace(/\s/g, '');
        if (
          !/^\d{6,24}$/.test(number) ||
          (accountNumber && number !== accountNumber)
        ) {
          throw new Error('Missing or conflicting Nedbank account number');
        }
        accountNumber = number;
      }
      if (key === 'account description') {
        const next = clean(record[1] ?? '');
        if (description && next !== description) {
          throw new Error('Conflicting account descriptions');
        }
        description = next;
      }
    }
    if (!accountNumber || !description) {
      throw new Error('Missing Nedbank account metadata');
    }
    const credit = /credit\s*card/i.test(description);
    const fingerprint = digest(['nedbank', accountNumber]);
    const result: BankStatement = {
      provider: 'nedbank',
      account: {
        fingerprint,
        maskedNumber: '…' + accountNumber.slice(-4),
        description,
        kind: credit ? 'credit' : 'current',
        currency: 'ZAR',
      },
      transactions: [],
      openingBalanceInferred: false,
      balanceChecks: 0,
      skipped: { metadata: 0, balanceMarkers: 0, notices: 0 },
      issues: [],
    };
    let previousBalance: number | undefined;
    let provisional = false;
    const occurrences = new Map<string, number>();
    const issue = (line: number) =>
      result.issues.push({
        severity: 'error',
        code: 'balance-mismatch',
        line,
        message: 'Running balance does not reconcile with the preceding row.',
      });
    for (const {
      record: cells,
      info: { lines: line },
    } of rows) {
      const row = cells.map(cell => cell.trim());
      const key = clean(row[0] ?? '')
        .replace(/\s*:\s*$/, '')
        .toLowerCase();
      if (
        [
          'statement enquiry',
          'account number',
          'account description',
          'statement number',
        ].includes(key)
      ) {
        result.skipped.metadata++;
        continue;
      }
      if (row.every(cell => !cell)) continue;
      if (row.length < 4 || row.slice(4).some(Boolean)) {
        throw new Error(`Unsupported Nedbank row layout on line ${line}`);
      }
      const primary = date(row[0], line);
      const secondary = credit ? date(row[1], line) : undefined;
      const payee = clean(row[credit ? 2 : 1]);
      if (!payee) throw new Error(`Missing description on line ${line}`);
      const amountRaw = row[credit ? 3 : 2];
      const balance = !credit && row[3] ? money(row[3], line) : undefined;
      if (
        !credit &&
        payee.toUpperCase() === 'PROVISIONAL STATEMENT' &&
        !amountRaw &&
        balance === undefined
      ) {
        provisional = true;
        result.skipped.notices++;
        result.issues.push({
          severity: 'warning',
          code: 'provisional-statement',
          line,
          message:
            'Rows in the provisional statement section are imported uncleared. A finalized export can clear the same imported IDs later.',
        });
        continue;
      }
      if (!amountRaw) {
        const marker = /^(BROUGHT|CARRIED) FORWARD$/i.test(payee);
        if (credit || (!marker && balance === undefined)) {
          throw new Error(`Missing transaction amount on line ${line}`);
        }
        if (marker) result.skipped.balanceMarkers++;
        else result.skipped.notices++;
        if (balance !== undefined) {
          if (previousBalance !== undefined) {
            result.balanceChecks++;
            if (balance !== previousBalance) issue(line);
          }
          if (
            !result.transactions.length &&
            result.openingBalance === undefined
          ) {
            result.openingBalance = balance;
          }
          previousBalance = balance;
          result.closingBalance = balance;
        }
        continue;
      }
      const amount = money(amountRaw, line);
      if (!credit && balance === undefined) {
        throw new Error(`Missing running balance on line ${line}`);
      }
      if (balance !== undefined) {
        if (previousBalance !== undefined) {
          result.balanceChecks++;
          if (!new Exact(previousBalance).plus(amount).equals(balance)) {
            issue(line);
          }
        } else {
          const opening = new Exact(balance).minus(amount);
          if (
            !opening.isInteger() ||
            !Number.isSafeInteger(opening.toNumber())
          ) {
            throw new Error(
              'Opening balance exceeds the supported amount range',
            );
          }
          result.openingBalance = opening.toNumber();
          result.openingBalanceInferred = true;
        }
        previousBalance = balance;
        result.closingBalance = balance;
      }
      if (
        !credit &&
        result.transactions.at(-1)?.date &&
        result.transactions.at(-1)!.date > primary
      ) {
        result.issues.push({
          severity: 'error',
          code: 'date-order',
          line,
          message:
            'Current-account rows must be in ascending date order for balance reconciliation.',
        });
      }
      const identity = digest([
        fingerprint,
        credit ? 'credit' : 'current',
        primary,
        secondary ?? null,
        payee.toUpperCase(),
        amount,
        balance ?? null,
      ]);
      const occurrence = (occurrences.get(identity) ?? 0) + 1;
      occurrences.set(identity, occurrence);
      result.transactions.push({
        line,
        date: primary,
        secondaryDate: secondary,
        description: payee,
        amount,
        balance,
        importedId: `nedbank:v1:${fingerprint}:${identity}:${occurrence}`,
        provisional,
      });
    }
    const dates = result.transactions.map(t => t.date).sort();
    result.from = dates[0];
    result.through = dates.at(-1);
    if (!result.transactions.length) {
      result.issues.push({
        severity: 'warning',
        code: 'empty-statement',
        message: 'Statement contains no transaction rows.',
      });
    }
    if (credit) {
      result.issues.push({
        severity: 'warning',
        code: 'no-balances',
        message:
          'This credit-card export has no balances. Reconcile the account against a card statement; no opening balance was invented.',
      });
    }
    if ([...occurrences.values()].some(count => count > 1)) {
      result.issues.push({
        severity: 'warning',
        code: 'identical-rows',
        message:
          'Identical rows are retained as separate transactions. Use complete dates in overlapping exports to keep their occurrence IDs stable.',
      });
    }
    return result;
  },
};
