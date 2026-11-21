import { describe, expect, it } from 'vitest';

import { nedbankStatement } from './nedbank';

import {
  createStatementFactory,
  statementFactory,
  statementTransactions,
} from './index';

// Entirely synthetic statements. Never copy financial records into fixtures.
const header =
  'Statement Enquiry :\nAccount Number : ,900000001\nAccount Description :,Synthetic Current\nStatement Number : ,1,\n';
const current =
  header +
  [
    '01Jan2025,BROUGHT FORWARD,,1000',
    '02Jan2025,Example salary,100,1100,',
    '03Jan2025,"Example shop, branch",-10.25,1089.75,',
    '03Jan2025,VAT 01/01-03/01 = R1.00,,1089.75,',
    '03Jan2025,CARRIED FORWARD,,1089.75,',
    '04Jan2025,BROUGHT FORWARD,,1089.75,',
    '04Jan2025,Example refund,5,1094.75,',
  ].join('\n');
const cardHeader =
  'Statement Enquiry :\nAccount Number : ,9000000000000001\nAccount Description :,Credit Card\n';
const card =
  cardHeader +
  '01-Feb-2025,03-Feb-2025,Example purchase,-100.25,\n04-Feb-2025,04-Feb-2025,Example payment,200,\n';

describe('Nedbank statement ingestion', () => {
  it('keeps provisional rows uncleared with stable IDs when the final export arrives', () => {
    const row = '01Jan2025,Example receipt,100,100,\n';
    const provisional = statementFactory.parse(
      header + '01Jan2025,PROVISIONAL STATEMENT,,\n' + row,
    );
    const final = statementFactory.parse(header + row);
    expect(statementTransactions(provisional)[0].cleared).toBe(false);
    expect(statementTransactions(final)[0].cleared).toBe(true);
    expect(provisional.transactions[0].importedId).toBe(
      final.transactions[0].importedId,
    );
  });
  it('reconciles balances and excludes carry-forward and VAT notices', () => {
    const data = statementFactory.parse('\uFEFF' + current);
    expect(data.account).toMatchObject({
      kind: 'current',
      currency: 'ZAR',
      maskedNumber: '…0001',
    });
    expect(data.transactions.map(t => t.amount)).toEqual([10000, -1025, 500]);
    expect(data.skipped).toEqual({
      metadata: 4,
      balanceMarkers: 3,
      notices: 1,
    });
    expect(data.balanceChecks).toBe(6);
    expect(data.openingBalance).toBe(100000);
    expect(data.closingBalance).toBe(109475);
    expect(data.issues).toEqual([]);
    expect(data.transactions[1].description).toBe('Example shop, branch');
    expect(JSON.stringify(data)).not.toContain('900000001');
  });
  it('keeps signed credit-card activity and both dates without inventing balances', () => {
    const data = statementFactory.parse(card);
    expect(data.openingBalance).toBeUndefined();
    expect(data.issues[0].code).toBe('no-balances');
    expect(statementTransactions(data)[0]).toMatchObject({
      amount: -10025,
      date: '2025-02-01',
      notes: 'Statement dates: first 2025-02-01; second 2025-02-03',
    });
    expect(statementTransactions(data, 'secondary')[0].date).toBe('2025-02-03');
    expect(statementTransactions(data)[1].amount).toBe(20000);
  });
  it('produces stable IDs across overlapping exports and preserves identical purchases', () => {
    const row = '01-Feb-2025,03-Feb-2025,Example purchase,-100.25,\n';
    const complete = statementFactory.parse(
      cardHeader + row + row + '04-Feb-2025,04-Feb-2025,Example payment,200,\n',
    );
    const overlap = statementFactory.parse(cardHeader + row + row);
    expect(complete.transactions.slice(0, 2).map(t => t.importedId)).toEqual(
      overlap.transactions.map(t => t.importedId),
    );
    expect(new Set(overlap.transactions.map(t => t.importedId)).size).toBe(2);
    expect(overlap.issues.some(i => i.code === 'identical-rows')).toBe(true);
    expect(
      statementFactory.parse(
        cardHeader.replace('9000000000000001', '9000000000000002') + row,
      ).transactions[0].importedId,
    ).not.toBe(overlap.transactions[0].importedId);
  });
  it('blocks malformed dates, amounts, unrecognized rows and conflicting metadata', () => {
    for (const text of [
      current.replace('02Jan2025', '31Feb2025'),
      current.replace(',100,', ',1e2,'),
      current.replace(',100,', ',100.001,'),
      current + '\nunknown,row',
      current + '\nAccount Number :,900000002',
      current.replace(',1100,', ',1100,extra'),
    ]) {
      expect(() => statementFactory.parse(text)).toThrow();
    }
    expect(() => statementFactory.parse('date,amount\n2025-01-01,1')).toThrow(
      'unknown',
    );
    expect(() =>
      createStatementFactory([nedbankStatement, nedbankStatement]),
    ).toThrow('Duplicate');
  });
  it('reports a missing movement and blocks import rather than concealing balance gaps', () => {
    const data = statementFactory.parse(
      current.replace('03Jan2025,"Example shop, branch",-10.25,1089.75,\n', ''),
    );
    expect(data.issues.some(i => i.code === 'balance-mismatch')).toBe(true);
    expect(() => statementTransactions(data)).toThrow('reconciliation');
  });
  it('infers an opening balance only from an explicit transaction and running balance', () => {
    const data = statementFactory.parse(
      header + '01Jan2025,BROUGHT FORWARD,,\n02Jan2025,Example receipt,1,6,',
    );
    expect(data.openingBalance).toBe(500);
    expect(data.openingBalanceInferred).toBe(true);
    expect(data.transactions).toHaveLength(1);
  });
  it('preserves quoted multiline descriptions and validates grouping without floating-point rounding', () => {
    const data = statementFactory.parse(
      header + '01Jan2025,"Example\nmerchant","-1,234.56","5,000.01",',
    );
    expect(data.transactions[0]).toMatchObject({
      amount: -123456,
      balance: 500001,
      description: 'Example merchant',
    });
    expect(() =>
      statementFactory.parse(header + '01Jan2025,Example,"1,23.00",5,'),
    ).toThrow('amount');
  });
});
