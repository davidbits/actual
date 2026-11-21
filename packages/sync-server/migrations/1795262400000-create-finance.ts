import { getAccountDb } from '../src/account-db';

export async function up() {
  getAccountDb().exec(`
    CREATE TABLE finance_connections (
      id TEXT PRIMARY KEY, file_id TEXT NOT NULL, user_id TEXT NOT NULL,
      settings TEXT NOT NULL, credentials TEXT NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX finance_connections_file ON finance_connections(file_id);
    CREATE TABLE finance_collections (
      connection_id TEXT PRIMARY KEY REFERENCES finance_connections(id) ON DELETE CASCADE,
      payload TEXT NOT NULL
    );
    CREATE TABLE finance_snapshots (
      connection_id TEXT NOT NULL REFERENCES finance_connections(id) ON DELETE CASCADE,
      timestamp INTEGER NOT NULL, payload TEXT NOT NULL,
      PRIMARY KEY(connection_id, timestamp)
    );
    CREATE TABLE finance_prices (
      file_id TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
      PRIMARY KEY(file_id, id)
    );
  `);
}

export async function down() {
  getAccountDb().exec(
    'DROP TABLE finance_prices; DROP TABLE finance_snapshots; DROP TABLE finance_collections; DROP TABLE finance_connections',
  );
}
