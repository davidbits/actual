import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

test('connects an exchange and keeps its portfolio available offline', async ({
  browser,
}) => {
  const page = await browser.newPage();
  const at = Date.parse('2026-11-21T12:00:00Z');
  let connected = false;
  const portfolio = () => ({
    version: 1,
    updatedAt: at,
    connections: connected
      ? [
          {
            id: 'fixture',
            provider: 'luno',
            name: 'Synthetic exchange',
            enabled: true,
            intervalMinutes: 15,
            historyStart: '2020-01-01',
            symbols: [],
            lastSuccess: at,
          },
        ]
      : [],
    collections: connected
      ? {
          fixture: {
            timestamp: at,
            accounts: [{ id: 'spot', name: 'Spot', product: 'spot' }],
            holdings: [
              { accountId: 'spot', asset: 'BTC', quantity: '0.012345678' },
            ],
            positions: [],
            events: Array.from({ length: 501 }, (_, index) => ({
              id: `event-${index}`,
              accountId: 'spot',
              stream: 'ledger',
              timestamp: at - index * 1000,
              type: 'movement',
              status: 'booked',
              description: `Synthetic movement ${index}`,
              postings: [
                { asset: 'BTC', quantity: '0.00001', role: 'principal' },
              ],
            })),
            cursors: {},
            coverage: [{ stream: 'balances', status: 'ok' }],
          },
        }
      : {},
    prices: [
      {
        asset: 'BTC',
        quote: 'ZAR',
        price: '1200000',
        timestamp: at,
        source: 'Synthetic quote',
      },
    ],
  });
  await page.clock.install({ time: new Date(at) });
  await page.route('https://sync.example.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/finance/connect') {
      const body = route.request().postDataJSON();
      expect(body.credentials.key).toBe('synthetic-key');
      connected = true;
    }
    await route.fulfill({
      json: {
        status: 'ok',
        data:
          path === '/finance/providers'
            ? [
                {
                  id: 'luno',
                  name: 'Luno',
                  passphrase: false,
                  products: ['spot'],
                },
              ]
            : portfolio(),
      },
    });
  });
  await page.goto('/');
  await new ConfigurationPage(page).createTestFile();
  await page.evaluate(async () => {
    await window.$send('set-server-url', {
      url: 'https://sync.example.test',
      validate: false,
    });
    await window.$send('subscribe-set-token', { token: 'synthetic-session' });
    await window.$send('save-prefs', { cloudFileId: 'fixture-budget' });
  });
  await new Navigation(page).goToBankSyncPage();
  await page.getByRole('button', { name: 'Exchange portfolio' }).click();
  await page
    .getByLabel('Connection name', { exact: true })
    .fill('Synthetic exchange');
  await page.getByLabel('API key', { exact: true }).fill('synthetic-key');
  await page.getByLabel('API secret', { exact: true }).fill('synthetic-secret');
  await page
    .getByRole('button', { name: 'Save connection', exact: true })
    .click();
  await expect(
    page.getByText('Synthetic exchange', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('0.012345678', { exact: true })).toBeVisible();
  await expect(page.getByLabel('API secret', { exact: true })).toHaveValue('');
  await expect(
    page.getByRole('region', { name: 'Holdings', exact: true }),
  ).toMatchThemeScreenshots();
  const activity = page.getByRole('region', {
    name: 'Exchange activity',
    exact: true,
  });
  await expect(
    activity.getByText('Synthetic movement 500', { exact: true }),
  ).toHaveCount(0);
  await activity.getByRole('button', { name: 'Show more activity' }).click();
  await expect(
    activity.getByText('Synthetic movement 500', { exact: true }),
  ).toBeVisible();
  await expect(
    activity.getByText('Synthetic exchange / Spot', { exact: true }).first(),
  ).toBeAttached();
  await expect(
    activity.getByRole('button', { name: 'Show more activity' }),
  ).toHaveCount(0);
  await page.unroute('https://sync.example.test/**');
  await page.route('https://sync.example.test/**', route => route.abort());
  await page.reload();
  await expect(page.getByText('0.012345678', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Server unavailable. Showing last saved portfolio.'),
  ).toBeVisible();
  await page.close();
});
