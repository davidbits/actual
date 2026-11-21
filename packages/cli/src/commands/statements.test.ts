import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as api from '@actual-app/api';
import { Command } from 'commander';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { withConnection } from '#connection';
import { printOutput } from '#output';

import { registerStatementsCommand } from './statements';

vi.mock('@actual-app/api', () => ({
  getAccounts: vi.fn(),
  getTransactions: vi.fn(),
  importTransactions: vi.fn(),
}));
vi.mock('#connection', () => ({
  withConnection: vi.fn(
    async (_options: unknown, action: () => Promise<unknown>) => action(),
  ),
}));
vi.mock('#output', () => ({ printOutput: vi.fn() }));

const csv =
  'Statement Enquiry :\nAccount Number : ,900000001\nAccount Description :,Synthetic Current\n01Jan2025,Example receipt,100,100,\n';
let folder: string;
let file: string;
function run(args: string[]) {
  const program = new Command()
    .exitOverride()
    .option('--format <format>', '', 'json');
  registerStatementsCommand(program);
  return program.parseAsync(['node', 'actual', 'statements', ...args]);
}
beforeEach(async () => {
  vi.clearAllMocks();
  folder = await mkdtemp(join(tmpdir(), 'actual-statement-fixture-'));
  file = join(folder, 'synthetic.csv');
  await writeFile(file, csv);
  vi.mocked(api.getAccounts).mockResolvedValue([
    {
      id: 'account',
      name: 'Synthetic account',
      offbudget: false,
      closed: false,
    },
  ]);
  vi.mocked(api.getTransactions).mockResolvedValue([]);
  vi.mocked(api.importTransactions).mockResolvedValue({
    added: ['new'],
    updated: [],
    updatedPreview: [],
    errors: [],
  });
});
afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

it('inspects and converts without connecting, and refuses to overwrite output', async () => {
  await run(['inspect', file]);
  expect(withConnection).not.toHaveBeenCalled();
  expect(printOutput).toHaveBeenCalled();
  const output = join(folder, 'normalized.json');
  await run(['convert', file, '--output', output]);
  expect(JSON.parse(await readFile(output, 'utf8'))[0].amount).toBe(10000);
  await expect(run(['convert', file, '--output', output])).rejects.toThrow(
    'EEXIST',
  );
});
it('previews by default and mutates only with the apply flag', async () => {
  await run(['import', file, '--account', 'account']);
  expect(api.importTransactions).toHaveBeenLastCalledWith(
    'account',
    expect.any(Array),
    { defaultCleared: true, dryRun: true },
  );
  expect(withConnection).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.any(Function),
    { mutates: false },
  );
  await run(['import', file, '--account', 'account', '--apply']);
  expect(api.importTransactions).toHaveBeenLastCalledWith(
    'account',
    expect.any(Array),
    { defaultCleared: true, dryRun: false },
  );
  expect(withConnection).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.any(Function),
    { mutates: true },
  );
});
it('blocks a balance mismatch before opening a budget', async () => {
  await writeFile(file, csv + '02Jan2025,Example expense,-1,50,\n');
  await expect(
    run(['import', file, '--account', 'account', '--apply']),
  ).rejects.toThrow('reconciliation');
  expect(withConnection).not.toHaveBeenCalled();
});

it('blocks a closed or missing target account before importing', async () => {
  vi.mocked(api.getAccounts).mockResolvedValue([]);
  await expect(
    run(['import', file, '--account', 'account', '--apply']),
  ).rejects.toThrow('open Actual account');
  expect(api.importTransactions).not.toHaveBeenCalled();
});

it('rejects mixing two source accounts in one Actual account', async () => {
  vi.mocked(api.getTransactions).mockResolvedValue([
    {
      id: 'existing',
      account: 'account',
      date: '2025-01-01',
      amount: 100,
      imported_id: 'nedbank:v1:another-source:row:1',
    },
  ]);
  await expect(
    run(['import', file, '--account', 'account', '--apply']),
  ).rejects.toThrow('different source account');
  expect(api.importTransactions).not.toHaveBeenCalled();
});
