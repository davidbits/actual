import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

import * as api from '@actual-app/api';
import {
  statementFactory,
  statementSummary,
  statementTransactions,
} from '@actual-app/finance/statements';
import type { StatementDateField } from '@actual-app/finance/statements';
import type { Command } from 'commander';
import { Option } from 'commander';

import { withConnection } from '#connection';
import { printOutput } from '#output';

type Options = {
  provider?: string;
  encoding: string;
  dateField: StatementDateField;
  output?: string;
  account?: string;
  apply?: boolean;
};

async function load(file: string, options: Options) {
  if ((await stat(file)).size > 20 * 1024 * 1024) {
    throw new Error('Statement exceeds 20 MB');
  }
  const bytes = await readFile(file);
  const encoding =
    options.encoding === 'auto'
      ? bytes[0] === 0xff && bytes[1] === 0xfe
        ? 'utf-16le'
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? 'utf-16be'
          : 'utf-8'
      : options.encoding;
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      'Unable to decode statement; select its encoding explicitly',
    );
  }
  return statementFactory.parse(text, options.provider);
}

function sourceOptions(command: Command) {
  return command
    .option('--provider <id>', 'Registered provider (auto-detected by default)')
    .addOption(
      new Option('--encoding <encoding>', 'Input text encoding')
        .choices(['auto', 'utf-8', 'utf-16le', 'utf-16be', 'windows-1252'])
        .default('auto'),
    )
    .addOption(
      new Option(
        '--date-field <field>',
        'Card date used in Actual; both dates remain in notes',
      )
        .choices(['primary', 'secondary'])
        .default('primary'),
    );
}

export function registerStatementsCommand(program: Command) {
  const statements = program
    .command('statements')
    .description('Inspect, convert and ingest bank CSV exports');
  statements
    .command('providers')
    .description('List local statement adapters')
    .action(() =>
      printOutput(statementFactory.providers(), program.opts().format),
    );
  sourceOptions(
    statements
      .command('inspect <files...>')
      .description(
        'Parse and reconcile statements locally, without a server connection',
      ),
  ).action(async (files: string[], options: Options) => {
    const results = [];
    for (const file of files) {
      results.push({
        file: basename(file),
        ...statementSummary(await load(file, options)),
      });
    }
    printOutput(results, program.opts().format);
    if (results.some(r => r.issues.some(issue => issue.severity === 'error'))) {
      process.exitCode = 1;
    }
  });
  sourceOptions(
    statements
      .command('convert <file>')
      .description(
        'Write normalized Actual transaction JSON; refuses to overwrite files',
      ),
  )
    .requiredOption('--output <path>', 'New JSON output file')
    .action(async (file: string, options: Options) => {
      const statement = await load(file, options);
      const transactions = statementTransactions(statement, options.dateField);
      if (!options.output) throw new Error('Output path required');
      await writeFile(
        options.output,
        JSON.stringify(transactions, null, 2) + '\n',
        { flag: 'wx', mode: 0o600 },
      );
      printOutput(
        { ...statementSummary(statement), output: options.output },
        program.opts().format,
      );
    });
  sourceOptions(
    statements
      .command('import <file>')
      .description(
        'Preview reconciliation against an Actual account; --apply imports and syncs',
      ),
  )
    .requiredOption('--account <id>', 'Existing Actual account ID')
    .option('--apply', 'Apply this import and sync the budget', false)
    .action(async (file: string, options: Options) => {
      const statement = await load(file, options);
      const transactions = statementTransactions(statement, options.dateField);
      const accountId = options.account;
      if (!accountId) throw new Error('Account ID required');
      await withConnection(
        program.opts(),
        async () => {
          const account = (await api.getAccounts()).find(
            a => a.id === accountId,
          );
          if (!account || account.closed) {
            throw new Error('Choose an existing open Actual account');
          }
          const existing = await api.getTransactions(
            accountId,
            '1900-01-01',
            '9999-12-31',
          );
          const prefix = `${statement.provider}:v1:${statement.account.fingerprint}:`;
          if (
            existing.some(
              t =>
                t.imported_id?.startsWith(`${statement.provider}:v1:`) &&
                !t.imported_id.startsWith(prefix),
            )
          ) {
            throw new Error(
              'This Actual account already contains a different source account from this provider',
            );
          }
          const result = await api.importTransactions(
            accountId,
            transactions.map(t => ({ ...t, account: accountId })),
            {
              dryRun: !options.apply,
              defaultCleared: true,
            },
          );
          printOutput(
            {
              applied: !!options.apply,
              account: account.name,
              statement: statementSummary(statement),
              added: result.added.length,
              updated: result.updated.length,
              errors: result.errors,
              preview: result.updatedPreview,
            },
            program.opts().format,
          );
          if (result.errors.length) process.exitCode = 1;
        },
        { mutates: !!options.apply },
      );
    });
}
