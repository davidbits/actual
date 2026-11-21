import { randomUUID } from 'node:crypto';
import { format } from 'node:util';

import createDebug from 'debug';
import type * as OpenIdClient from 'openid-client';

import { getAccountDb, getSession } from '#account-db';
import { config } from '#load-config';

import { loginWithOpenIdFinalize, loginWithOpenIdSetup } from './openid';

const provider = vi.hoisted(() => ({
  callback: vi.fn(),
  userinfo: vi.fn(),
}));

vi.mock('openid-client', async importOriginal => {
  const actual = await importOriginal<typeof OpenIdClient>();
  class Client {
    redirect_uris = ['https://actual.example/openid/callback'];
    callback = provider.callback;
    userinfo = provider.userinfo;
    authorizationUrl(params: Record<string, string>) {
      return `https://identity.example/authorize?${new URLSearchParams(params).toString()}`;
    }
  }
  return { ...actual, Issuer: { discover: async () => ({ Client }) } };
});

beforeEach(() => {
  getAccountDb().mutate("DELETE FROM sessions WHERE auth_method = 'openid'");
  getAccountDb().mutate(
    'INSERT INTO auth (method, active, extra_data) VALUES (?, 1, ?)',
    [
      'openid',
      JSON.stringify({
        issuer: 'https://identity.example',
        client_id: 'client',
        client_secret: 'secret',
        server_hostname: 'https://actual.example',
      }),
    ],
  );
  provider.callback.mockReset().mockResolvedValue({
    access_token: 'provider-token',
    claims: () => ({ iss: 'https://identity.example', sub: 'fixed-id' }),
  });
  provider.userinfo.mockReset().mockResolvedValue({
    sub: 'fixed-id',
    preferred_username: 'renamed-admin',
  });
});

afterEach(() => {
  const db = getAccountDb();
  db.mutate("DELETE FROM auth WHERE method = 'openid'");
  db.mutate('DELETE FROM pending_openid_requests');
  db.mutate("DELETE FROM sessions WHERE auth_method = 'openid'");
});

async function finishLoginAs(username: string) {
  provider.userinfo.mockResolvedValue({ preferred_username: username });
  const start = await loginWithOpenIdSetup('https://actual.example');
  const state = new URL(start.url ?? '').searchParams.get('state');
  return loginWithOpenIdFinalize({ code: 'test-code', state });
}

it('admits the existing owner on another device without creating another user', async () => {
  const db = getAccountDb();
  const before = db.first('SELECT count(*) AS count FROM users').count;
  const result = await finishLoginAs('admin');

  expect(result.error).toBeUndefined();
  const token = new URL(result.url ?? '').searchParams.get('token');
  expect(getSession(token)?.user_id).toBe('genericAdmin');
  expect(db.first('SELECT count(*) AS count FROM users').count).toBe(before);
});

it('rejects another identity even when legacy automatic user creation is enabled', async () => {
  const previousMode = config.get('userCreationMode');
  const username = `new-${randomUUID()}`;
  config.set('userCreationMode', 'login');
  try {
    const result = await finishLoginAs(username);
    expect(result.error).toBe('openid-grant-failed');
    expect(
      getAccountDb().first('SELECT id FROM users WHERE user_name = ?', [
        username,
      ]),
    ).toBeNull();
  } finally {
    config.set('userCreationMode', previousMode);
  }
});

it('rejects an existing non-owner administrator', async () => {
  const db = getAccountDb();
  const id = randomUUID();
  db.mutate(
    'INSERT INTO users (id, user_name, enabled, owner, role) VALUES (?, ?, 1, 0, ?)',
    [id, id, 'ADMIN'],
  );
  try {
    expect((await finishLoginAs(id)).error).toBe('openid-grant-failed');
    expect(
      db.all('SELECT token FROM sessions WHERE user_id = ?', [id]),
    ).toEqual([]);
  } finally {
    db.mutate('DELETE FROM users WHERE id = ?', [id]);
  }
});

it.each(['', 'actual:*', 'actual-sensitive:openid'])(
  'keeps provider details behind the sensitive namespace (%s)',
  async namespaces => {
    const previous = createDebug.disable();
    createDebug.enable(namespaces);
    const debugLog = vi
      .spyOn(createDebug, 'log')
      .mockImplementation(() => undefined);
    const secret = 'private-provider-code-and-token';
    const start = await loginWithOpenIdSetup('https://actual.example');
    const state = new URL(start.url ?? '').searchParams.get('state');
    provider.callback.mockRejectedValue(new Error(secret));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const result = await loginWithOpenIdFinalize({ code: secret, state });
      expect(result.error).toBeTruthy();
      expect(log).toHaveBeenCalled();
      expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
      const details = debugLog.mock.calls
        .map(args => format(...args))
        .join('\n');
      expect(details.includes(secret)).toBe(
        namespaces === 'actual-sensitive:openid',
      );
      if (namespaces === 'actual-sensitive:openid') {
        expect(details).toContain('Error:');
        expect(details).toContain('openid.test.ts:');
      }
    } finally {
      log.mockRestore();
      debugLog.mockRestore();
      createDebug.enable(previous);
    }
  },
);
