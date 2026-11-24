import { randomUUID } from 'node:crypto';

import { emptyPortfolio } from '@actual-app/finance';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAccountDb } from '#account-db';

import { createFinanceRouter } from './app';

describe('finance budget authorization', () => {
  const fileId = randomUUID();
  const db = getAccountDb();
  const service = {
    portfolio: vi.fn(() => emptyPortfolio()),
    timeline: vi.fn(() => ({
      from: '2026-01-01',
      through: '2026-01-07',
      asOf: 0,
      assets: [],
      points: [],
    })),
    sync: vi.fn(async () => emptyPortfolio()),
    historical: vi.fn(async () => emptyPortfolio()),
    tick: vi.fn(async () => {
      /* empty */
    }),
    connect: vi.fn(() => ({
      id: 'fixture',
      provider: 'luno',
      name: 'Fixture',
      enabled: true,
      intervalMinutes: 15,
      historyStart: '2020-01-01',
      symbols: [],
    })),
    remove: vi.fn(),
    importData: vi.fn(() => emptyPortfolio()),
  };
  const app = createFinanceRouter(service);
  beforeEach(() => {
    vi.clearAllMocks();
    db.mutate('INSERT INTO files(id,owner,name) VALUES(?,?,?)', [
      fileId,
      'genericAdmin',
      'Synthetic portfolio',
    ]);
  });
  afterEach(() => db.mutate('DELETE FROM files WHERE id=?', [fileId]));
  it('requires authentication and an accessible active budget', async () => {
    expect((await request(app).post('/list')).status).toBe(401);
    expect(
      (await request(app).post('/list').set('X-ACTUAL-TOKEN', 'valid-token'))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/list')
          .set('X-ACTUAL-TOKEN', 'valid-token-user')
          .set('X-Actual-File-Id', fileId)
      ).status,
    ).toBe(403);
    expect(service.portfolio).not.toHaveBeenCalled();
    const response = await request(app)
      .post('/list')
      .set('X-ACTUAL-TOKEN', 'valid-token')
      .set('X-Actual-File-Id', fileId);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(service.portfolio).toHaveBeenCalledWith(fileId);
  });
  it('denies deleted budgets without invoking providers', async () => {
    db.mutate('UPDATE files SET deleted=1 WHERE id=?', [fileId]);
    const response = await request(app)
      .post('/sync')
      .set('X-ACTUAL-TOKEN', 'valid-token')
      .set('X-Actual-File-Id', fileId)
      .send({});
    expect(response.status).toBe(403);
    expect(service.sync).not.toHaveBeenCalled();
  });
  it('requires budget authorization before reading timeline history', async () => {
    expect(
      (await request(app).post('/timeline').send({ days: 7 })).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/timeline')
          .set('X-ACTUAL-TOKEN', 'valid-token-user')
          .set('X-Actual-File-Id', fileId)
          .send({ days: 7 })
      ).status,
    ).toBe(403);
    expect(service.timeline).not.toHaveBeenCalled();
    expect(
      (
        await request(app)
          .post('/timeline')
          .set('X-ACTUAL-TOKEN', 'valid-token')
          .set('X-Actual-File-Id', fileId)
          .send({ days: 7 })
      ).status,
    ).toBe(200);
    expect(service.timeline).toHaveBeenCalledWith(fileId, { days: 7 });
  });
  it('never exposes thrown credential details', async () => {
    service.connect.mockImplementationOnce(() => {
      throw new Error('synthetic-secret-must-not-leak');
    });
    const response = await request(app)
      .post('/connect')
      .set('X-ACTUAL-TOKEN', 'valid-token')
      .set('X-Actual-File-Id', fileId)
      .send({
        provider: 'luno',
        name: 'Synthetic',
        symbols: [],
        enabled: true,
      });
    expect(response.status).toBe(400);
    expect(response.text).not.toContain('synthetic-secret');
  });
});
