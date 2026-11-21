import type { Credentials } from '#types';

import type { AdapterRegistration, TransportOptions } from './contracts';
import { binance } from './providers/binance';
import { bitget } from './providers/bitget';
import { luno } from './providers/luno';
import { valr } from './providers/valr';
import { createTransport } from './transport';

/** Composition root: adding a provider requires one registration, no service/UI switch. */
export function createProviderFactory(registrations: AdapterRegistration[]) {
  const registry = new Map(
    registrations.map(registration => [
      registration.definition.id,
      registration,
    ]),
  );
  if (registry.size !== registrations.length) {
    throw new Error('Duplicate finance provider');
  }
  return {
    definitions: () => [...registry.values()].map(entry => entry.definition),
    create(
      provider: string,
      credentials: Credentials,
      options: Omit<TransportOptions, 'credentials'> = {},
    ) {
      const entry = registry.get(provider);
      if (!entry) throw new Error('Unknown finance provider');
      if (
        !credentials.key ||
        !credentials.secret ||
        (entry.definition.passphrase && !credentials.passphrase)
      ) {
        throw new Error('Missing provider credentials');
      }
      return entry.create({
        request: createTransport(entry.transport, entry.resources, {
          ...options,
          credentials,
        }),
      });
    },
  };
}

export const exchangeFactory = createProviderFactory([
  luno,
  valr,
  bitget,
  binance,
]);
