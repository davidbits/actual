import { readFile } from 'node:fs/promises';

import * as api from '@actual-app/api';
import type { Command } from 'commander';

import { withConnection } from '#connection';
import { printOutput } from '#output';

export function registerFinanceCommand(program: Command) {
  const finance = program
    .command('finance')
    .description(
      'Exchange portfolios, connection management and historical valuation',
    );
  finance
    .command('import <connection> <file>')
    .description(
      'Import a versioned finance JSON archive or dated holdings checkpoint',
    )
    .action(async (connection: string, file: string) => {
      const document: unknown = JSON.parse(await readFile(file, 'utf8'));
      await withConnection(
        program.opts(),
        async () => {
          await api.importPortfolio(connection, document);
          printOutput({ imported: true }, program.opts().format);
        },
        { mutates: true },
      );
    });
  finance
    .command('list')
    .description('Read the cached portfolio, including data coverage')
    .action(async () => {
      await withConnection(
        program.opts(),
        async () =>
          printOutput(await api.getPortfolio(), program.opts().format),
        { mutates: false },
      );
    });
  finance
    .command('providers')
    .description('List registered provider adapters')
    .action(async () => {
      await withConnection(
        program.opts(),
        async () =>
          printOutput(await api.getFinanceProviders(), program.opts().format),
        { mutates: false },
      );
    });
  finance
    .command('sync')
    .description('Collect read-only exchange data and sync the budget cache')
    .option('--connection <id>')
    .action(async options => {
      await withConnection(
        program.opts(),
        async () =>
          printOutput(
            await api.syncPortfolio(options.connection),
            program.opts().format,
          ),
        { mutates: true },
      );
    });
  finance
    .command('history <date>')
    .description('Get the saved holdings checkpoint and historical ZAR prices')
    .action(async (date: string) => {
      const at = Date.parse(`${date}T23:59:59+02:00`);
      if (!Number.isFinite(at)) throw new Error('Use a YYYY-MM-DD date');
      await withConnection(
        program.opts(),
        async () =>
          printOutput(await api.getPortfolioHistory(at), program.opts().format),
        { mutates: false },
      );
    });
  finance
    .command('connect <provider>')
    .description(
      'Configure a provider using FINANCE_API_KEY, FINANCE_API_SECRET and optional FINANCE_API_PASSPHRASE environment variables',
    )
    .requiredOption('--name <name>')
    .option('--since <date>', 'History start', '2010-01-01')
    .option(
      '--symbols <symbols>',
      'Comma-separated historical trading symbols',
      '',
    )
    .action(async (provider: string, options) => {
      const key = process.env.FINANCE_API_KEY;
      const secret = process.env.FINANCE_API_SECRET;
      if (!key || !secret) {
        throw new Error('Set FINANCE_API_KEY and FINANCE_API_SECRET');
      }
      await withConnection(
        program.opts(),
        async () => {
          await api.connectFinance({
            provider,
            name: options.name,
            credentials: {
              key,
              secret,
              passphrase: process.env.FINANCE_API_PASSPHRASE,
            },
            enabled: true,
            intervalMinutes: 15,
            historyStart: options.since,
            symbols: String(options.symbols)
              .split(',')
              .map(s => s.trim().toUpperCase())
              .filter(Boolean),
          });
          printOutput({ configured: true }, program.opts().format);
        },
        { mutates: true },
      );
    });
}
