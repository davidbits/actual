import type { ConnectInput } from '@actual-app/finance';
import {
  createFinanceService,
  createPriceSource,
  exchangeFactory,
} from '@actual-app/finance/server';
import express from 'express';

import { config } from '#load-config';
import { canAccessActiveFile } from '#services/user-service';
import { validateBankSyncSession } from '#util/validate-budget-session';

import { createFinanceRepository } from './repository';
import { scheduleFinanceSync } from './scheduler';
import { createFinanceVault } from './vault';

export function createFinanceRouter(
  service: ReturnType<typeof createFinanceService>,
) {
  const router = express();
  router.use(express.json({ limit: '10mb' }));
  router.use(validateBankSyncSession);
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const fileId = req.get('X-Actual-File-Id');
    if (!fileId || !canAccessActiveFile(fileId, res.locals.user_id)) {
      res.status(403).json({ status: 'error', reason: 'file-access-denied' });
      return;
    }
    res.locals.fileId = fileId;
    next();
  });
  router.post('/providers', (_req, res) =>
    res.json({ status: 'ok', data: exchangeFactory.definitions() }),
  );
  router.post('/list', (_req, res) =>
    res.json({ status: 'ok', data: service.portfolio(res.locals.fileId) }),
  );
  router.post('/timeline', (req, res) =>
    res.json({
      status: 'ok',
      data: service.timeline(res.locals.fileId, req.body),
    }),
  );
  router.post('/connect', (req, res) => {
    const input: ConnectInput = req.body;
    // Detailed validation lives in the shared service and is used by UI and CLI equally.
    if (
      !input ||
      typeof input.provider !== 'string' ||
      typeof input.name !== 'string' ||
      !Array.isArray(input.symbols) ||
      typeof input.enabled !== 'boolean'
    ) {
      res.status(400).json({ status: 'error', reason: 'invalid-settings' });
      return;
    }
    res.json({
      status: 'ok',
      data: service.connect(res.locals.fileId, res.locals.user_id, input),
    });
  });
  router.post('/remove', (req, res) => {
    service.remove(res.locals.fileId, req.body.id);
    res.json({ status: 'ok' });
  });
  router.post('/sync', async (req, res) =>
    res.json({
      status: 'ok',
      data: await service.sync(res.locals.fileId, req.body.id),
    }),
  );
  router.post('/import', (req, res) =>
    res.json({
      status: 'ok',
      data: service.importData(
        res.locals.fileId,
        req.body.id,
        req.body.document,
      ),
    }),
  );
  router.post('/history', async (req, res) =>
    res.json({
      status: 'ok',
      data: await service.historical(res.locals.fileId, req.body.at),
    }),
  );
  router.use(
    (
      _error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      // Never pass provider credentials or response bodies to generic request-error loggers.
      res
        .status(400)
        .json({ status: 'error', reason: 'finance-request-failed' });
    },
  );
  return router;
}

let service: ReturnType<typeof createFinanceService> | undefined;
export function getFinanceService() {
  service ??= createFinanceService({
    repository: createFinanceRepository(
      createFinanceVault(config.get('dataDir')),
    ),
    factory: exchangeFactory,
    prices: createPriceSource(),
    canRead: c => canAccessActiveFile(c.fileId, c.userId),
  });
  return service;
}

export const handlers = express();
handlers.use((req, res, next) =>
  createFinanceRouter(getFinanceService())(req, res, next),
);

export function startFinanceScheduler() {
  return scheduleFinanceSync(() => getFinanceService().tick());
}
