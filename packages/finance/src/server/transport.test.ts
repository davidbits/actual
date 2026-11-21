import { describe, expect, it, vi } from 'vitest';

import { createProviderFactory, exchangeFactory } from './factory';
import { parseExactJson } from './json';
import { createTransport, signBitget, signValr } from './transport';

describe('provider transport boundaries', () => {
  it('preserves large IDs and decimal lexemes without touching JSON strings', () => {
    expect(
      parseExactJson(
        '{"id":9007199254740993,"amount":0.000000000000000001,"name":"123 \\" x"}',
      ),
    ).toEqual({
      id: '9007199254740993',
      amount: '0.000000000000000001',
      name: '123 " x',
    });
  });
  it('rejects unknown providers and missing passphrases', () => {
    expect(() =>
      exchangeFactory.create('unknown', { key: 'fixture', secret: 'fixture' }),
    ).toThrow('Unknown');
    expect(() =>
      exchangeFactory.create('bitget', { key: 'fixture', secret: 'fixture' }),
    ).toThrow('credentials');
    expect(createProviderFactory([]).definitions()).toEqual([]);
  });
  it('blocks non-allowlisted methods, paths and hosts before network access', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const request = createTransport(
      { hosts: { spot: 'https://api.valr.com' }, signer: signValr },
      [{ path: '/v1/account/balances' }],
      { credentials: { key: 'fixture', secret: 'fixture' }, fetch: fetcher },
    );
    await expect(
      request({ path: '/v1/account/balances', method: 'POST' }),
    ).rejects.toThrow('allowlist');
    await expect(request({ path: '/v1/orders' })).rejects.toThrow('allowlist');
    await expect(
      request({ path: '/v1/account/balances', host: 'futures' }),
    ).rejects.toThrow('allowlist');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('matches the published VALR signing vector', () => {
    const signed = signValr({
      credentials: {
        key: 'fixture',
        secret:
          '4961b74efac86b25cce8fbe4c9811c4c7a787b7a5996660afcc2e287ad864363',
      },
      timestamp: '1558014486185',
      method: 'GET',
      path: '/v1/account/balances',
      params: new URLSearchParams(),
    });
    expect(signed.headers['X-VALR-SIGNATURE']).toBe(
      '9d52c181ed69460b49307b7891f04658e938b21181173844b5018b2fe783a6d4c62b8e67a03de4d099e7437ebfabe12c56233b73c6a0cc0f7ae87e05f6289928',
    );
  });
  it('does not leak secrets or provider messages through errors', async () => {
    const request = createTransport(
      { hosts: { spot: 'https://api.bitget.com' }, signer: signBitget },
      [{ path: '/read' }],
      {
        credentials: {
          key: 'private-fixture-key',
          secret: 'private-fixture-secret',
          passphrase: 'private-fixture-passphrase',
        },
        fetch: vi.fn<typeof fetch>().mockResolvedValue(
          new Response('{"code":"40009","msg":"private-fixture-secret"}', {
            status: 400,
          }),
        ),
      },
    );
    await expect(request({ path: '/read' })).rejects.toThrow('40009');
    await expect(request({ path: '/read' })).rejects.not.toThrow(
      'private-fixture',
    );
  });
});
