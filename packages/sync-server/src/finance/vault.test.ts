import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { createFinanceVault } from './vault';

it('encrypts private state, binds it to its connection, and survives restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'actual-finance-fixture-'));
  try {
    const vault = createFinanceVault(directory);
    const data = { key: 'synthetic-only-key', secret: 'synthetic-only-secret' };
    const encrypted = vault.encrypt(data, 'connection-1');
    expect(encrypted).not.toContain(data.secret);
    expect(vault.encrypt(data, 'connection-1')).not.toBe(encrypted);
    expect(
      createFinanceVault(directory).decrypt(encrypted, 'connection-1'),
    ).toEqual(data);
    expect(() => vault.decrypt(encrypted, 'connection-2')).toThrow();
    expect(statSync(join(directory, '.finance-key')).mode & 0o777).toBe(0o600);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
