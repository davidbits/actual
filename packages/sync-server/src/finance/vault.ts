import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function createFinanceVault(directory: string) {
  const filename = join(directory, '.finance-key');
  if (!existsSync(filename)) {
    try {
      writeFileSync(filename, randomBytes(32), { mode: 0o600, flag: 'wx' });
    } catch (error) {
      if (!existsSync(filename)) throw error;
    }
  }
  const key = readFileSync(filename);
  if (key.length !== 32) throw new Error('Invalid finance encryption key');
  return {
    encrypt(value: unknown, context: string) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context));
      const payload = Buffer.concat([
        cipher.update(JSON.stringify(value), 'utf8'),
        cipher.final(),
      ]);
      return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString(
        'base64',
      );
    },
    decrypt<T>(value: string, context: string): T {
      const buffer = Buffer.from(value, 'base64');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        buffer.subarray(0, 12),
      );
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(buffer.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          decipher.update(buffer.subarray(28)),
          decipher.final(),
        ]).toString('utf8'),
      ) as T;
    },
  };
}
