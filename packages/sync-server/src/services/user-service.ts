// @ts-strict-ignore
import { getAccountDb, isAdmin } from '#account-db';

export function getUserByUsername(userName) {
  if (typeof userName !== 'string') {
    return null;
  }
  const { id } =
    getAccountDb().first('SELECT id FROM users WHERE user_name = ?', [
      userName,
    ]) || {};
  return id || null;
}

export function getUserById(userId) {
  if (!userId) {
    return null;
  }
  const { id } =
    getAccountDb().first('SELECT * FROM users WHERE id = ?', [userId]) || {};
  return id || null;
}

export function getOwnerCount(): number {
  const { ownerCount } = getAccountDb().first(
    `SELECT count(*) as ownerCount FROM users WHERE users.user_name <> '' and users.owner = 1`,
  ) || { ownerCount: 0 };
  return ownerCount;
}

export function getOwnerId() {
  const { id } =
    getAccountDb().first(
      `SELECT users.id FROM users WHERE users.user_name <> '' and users.owner = 1`,
    ) || {};
  return id;
}

export function transferAllFilesFromUser(ownerId, oldUserId) {
  if (!ownerId || !oldUserId) {
    throw new Error('Invalid user IDs');
  }
  try {
    getAccountDb().transaction(() => {
      const ownerExists = getUserById(ownerId);
      if (!ownerExists) {
        throw new Error('New owner not found');
      }
      getAccountDb().mutate('UPDATE files set owner = ? WHERE owner = ?', [
        ownerId,
        oldUserId,
      ]);
    });
  } catch (error) {
    throw new Error(`Failed to transfer files: ${error.message}`);
  }
}

export function canAccessActiveFile(fileId: string, userId: string): boolean {
  const file = getAccountDb().first(
    'SELECT id FROM files WHERE id = ? AND deleted = 0',
    [fileId],
  );
  return (
    !!file &&
    (isAdmin(userId) || checkFilePermission(fileId, userId).granted === 1)
  );
}

export function checkFilePermission(fileId, userId) {
  return (
    getAccountDb().first(
      `SELECT 1 as granted
       FROM files
       WHERE files.id = ? and (files.owner = ?)`,
      [fileId, userId],
    ) || { granted: 0 }
  );
}

export function getOpenIDConfig() {
  return (
    getAccountDb().first(`SELECT * FROM auth WHERE method = ?`, ['openid']) ||
    null
  );
}
