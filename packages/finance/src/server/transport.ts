import { createHmac } from 'node:crypto';

import type {
  Request,
  Resource,
  Signer,
  TransportDefinition,
  TransportOptions,
} from './contracts';
import { object, parseExactJson } from './json';

export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(`Provider request failed (${status}, ${code})`);
  }
}

export const signBinance: Signer = ({ credentials, timestamp, params }) => {
  params.set('timestamp', timestamp);
  params.set('recvWindow', '5000');
  params.set(
    'signature',
    createHmac('sha256', credentials.secret)
      .update(params.toString())
      .digest('hex'),
  );
  return {
    headers: { 'X-MBX-APIKEY': credentials.key },
    query: params.toString(),
  };
};

export const signBitget: Signer = ({
  credentials,
  timestamp,
  method,
  path,
  params,
}) => {
  const query = method === 'GET' ? params.toString() : '';
  const body =
    method === 'POST' ? JSON.stringify(Object.fromEntries(params)) : '';
  const signature = createHmac('sha256', credentials.secret)
    .update(timestamp + method + path + (query ? '?' + query : '') + body)
    .digest('base64');
  return {
    query,
    body: body || undefined,
    headers: {
      'ACCESS-KEY': credentials.key,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': credentials.passphrase ?? '',
    },
  };
};

export const signValr: Signer = ({
  credentials,
  timestamp,
  method,
  path,
  params,
  subaccountId,
}) => {
  const query = params.toString();
  const signature = createHmac('sha512', credentials.secret)
    .update(
      timestamp +
        method +
        path +
        (query ? '?' + query : '') +
        (subaccountId ?? ''),
    )
    .digest('hex');
  return {
    query,
    headers: {
      'X-VALR-API-KEY': credentials.key,
      'X-VALR-SIGNATURE': signature,
      'X-VALR-TIMESTAMP': timestamp,
      ...(subaccountId ? { 'X-VALR-SUB-ACCOUNT-ID': subaccountId } : {}),
    },
  };
};

export const signLuno: Signer = ({ credentials, params }) => ({
  query: params.toString(),
  headers: {
    Authorization: `Basic ${Buffer.from(`${credentials.key}:${credentials.secret}`).toString('base64')}`,
  },
});

function allowed(resource: Resource, resources: Resource[]) {
  return resources.some(candidate => {
    const pattern = candidate.path
      .split('/')
      .map(part =>
        part.startsWith(':')
          ? '[A-Za-z0-9_-]+'
          : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('/');
    return (
      new RegExp(`^${pattern}$`).test(resource.path) &&
      (candidate.method ?? 'GET') === (resource.method ?? 'GET') &&
      (candidate.host ?? 'spot') === (resource.host ?? 'spot') &&
      !!candidate.public === !!resource.public
    );
  });
}

export function createTransport(
  definition: TransportDefinition,
  resources: Resource[],
  options: TransportOptions,
): Request {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const wait =
    options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let offset: number | undefined;
  let queue = Promise.resolve();
  let lastRequest = 0;

  async function execute(
    resource: Resource,
    values: Record<string, string | number | boolean | undefined> = {},
  ): Promise<unknown> {
    if (!allowed(resource, resources)) {
      throw new Error('Resource is not on the read-only allowlist');
    }
    const host = definition.hosts[resource.host ?? 'spot'];
    if (!host || !host.startsWith('https://')) {
      throw new Error('Unsupported provider host');
    }
    if (!resource.public && offset === undefined && definition.clock) {
      const start = now();
      const clock = await execute(definition.clock.resource);
      offset = definition.clock.read(clock) - Math.floor((start + now()) / 2);
    }
    const pause = Math.max(0, 250 - (now() - lastRequest));
    if (pause) await wait(pause);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const method = resource.method ?? 'GET';
    const signed = resource.public
      ? { query: params.toString(), headers: {}, body: undefined }
      : definition.signer({
          credentials: options.credentials,
          timestamp: String(now() + (offset ?? 0)),
          method,
          path: resource.path,
          params,
          subaccountId: resource.subaccountId,
        });
    lastRequest = now();
    let response: Response;
    try {
      response = await fetcher(
        host + resource.path + (signed.query ? '?' + signed.query : ''),
        {
          method,
          headers: {
            Accept: 'application/json',
            ...signed.headers,
            ...(signed.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: signed.body,
          redirect: 'error',
          signal: AbortSignal.timeout(20000),
        },
      );
    } catch {
      throw new ProviderError('network', 0);
    }
    // Errors deliberately omit URLs, headers, bodies and provider messages.
    const text = await response.text();
    if (text.length > 16 * 1024 * 1024) {
      throw new ProviderError('response-too-large', response.status);
    }
    let result: unknown;
    try {
      result = parseExactJson(text);
    } catch {
      throw new ProviderError('invalid-json', response.status);
    }
    const code =
      result && typeof result === 'object' && !Array.isArray(result)
        ? object(result).code
        : undefined;
    const safeCode =
      typeof code === 'string' && /^[-A-Za-z0-9_]{1,40}$/.test(code)
        ? code
        : String(response.status);
    if (
      !response.ok ||
      (code !== undefined && code !== '00000' && code !== '0' && code !== 0)
    ) {
      throw new ProviderError(safeCode, response.status);
    }
    return result;
  }
  return (resource, params) => {
    const result = queue.then(() => execute(resource, params));
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
