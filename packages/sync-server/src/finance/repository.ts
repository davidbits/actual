import type { Collection, Credentials, Price } from '@actual-app/finance';
import type { FinanceRepository } from '@actual-app/finance/server';

import { getAccountDb } from '#account-db';

import type { createFinanceVault } from './vault';

type Row = {
  id: string;
  file_id: string;
  user_id: string;
  settings: string;
  credentials: string;
};

export function createFinanceRepository(
  vault: ReturnType<typeof createFinanceVault>,
): FinanceRepository {
  const db = getAccountDb();
  return {
    connections(fileId) {
      const rows: Row[] = fileId
        ? db.all('SELECT * FROM finance_connections WHERE file_id = ?', [
            fileId,
          ])
        : db.all('SELECT * FROM finance_connections');
      return rows.map(row => ({
        ...JSON.parse(row.settings),
        id: row.id,
        fileId: row.file_id,
        userId: row.user_id,
        credentials: vault.decrypt<Credentials>(row.credentials, row.id),
      }));
    },
    saveConnection(connection, updateOnly = false) {
      const { credentials, fileId, userId, ...settings } = connection;
      if (updateOnly) {
        db.mutate('UPDATE finance_connections SET settings=? WHERE id=?', [
          JSON.stringify(settings),
          connection.id,
        ]);
        return;
      }
      db.mutate(
        `INSERT INTO finance_connections(id,file_id,user_id,settings,credentials) VALUES(?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET settings=excluded.settings, credentials=excluded.credentials`,
        [
          connection.id,
          fileId,
          userId,
          JSON.stringify(settings),
          vault.encrypt(credentials, connection.id),
        ],
      );
    },
    remove(id) {
      db.mutate('DELETE FROM finance_connections WHERE id = ?', [id]);
    },
    collection(id) {
      const row: { payload: string } | null = db.first(
        'SELECT payload FROM finance_collections WHERE connection_id = ?',
        [id],
      );
      return row ? vault.decrypt<Collection>(row.payload, id) : undefined;
    },
    saveCollection(id, collection) {
      const encrypted = vault.encrypt(collection, id);
      db.transaction(() => {
        db.mutate(
          'INSERT INTO finance_collections VALUES(?,?) ON CONFLICT(connection_id) DO UPDATE SET payload=excluded.payload',
          [id, encrypted],
        );
        // Durable dated checkpoints include native quantities and derivative equity.
        db.mutate('INSERT OR REPLACE INTO finance_snapshots VALUES(?,?,?)', [
          id,
          collection.timestamp,
          vault.encrypt({ ...collection, events: [] }, id),
        ]);
      });
    },
    saveSnapshot(id, collection) {
      db.mutate('INSERT OR REPLACE INTO finance_snapshots VALUES(?,?,?)', [
        id,
        collection.timestamp,
        vault.encrypt(collection, id),
      ]);
    },
    snapshots(id, at) {
      const row: { payload: string } | null = db.first(
        'SELECT payload FROM finance_snapshots WHERE connection_id=? AND timestamp<=? ORDER BY timestamp DESC LIMIT 1',
        [id, at],
      );
      return row ? vault.decrypt<Collection>(row.payload, id) : undefined;
    },
    prices(fileId) {
      const rows: { payload: string }[] = db.all(
        'SELECT payload FROM finance_prices WHERE file_id=?',
        [fileId],
      );
      return rows.map(row => vault.decrypt<Price>(row.payload, fileId));
    },
    savePrices(fileId, prices) {
      db.transaction(() => {
        for (const price of prices) {
          db.mutate('INSERT OR REPLACE INTO finance_prices VALUES(?,?,?)', [
            fileId,
            `${price.asset}:${price.quote}:${price.timestamp}:${price.source}`,
            vault.encrypt(price, fileId),
          ]);
        }
      });
    },
    acquire(id, now) {
      return (
        db.mutate(
          'UPDATE finance_connections SET lease_until=? WHERE id=? AND lease_until<?',
          [now + 30 * 60000, id, now],
        ).changes === 1
      );
    },
    release(id) {
      db.mutate('UPDATE finance_connections SET lease_until=0 WHERE id=?', [
        id,
      ]);
    },
  };
}
