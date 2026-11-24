import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';

async function prepare(page: Page, redesign = false) {
  const at = Date.parse('2026-11-21T12:00:00Z');
  const connection = (id: string, name: string) => ({
    id,
    name,
    provider: id,
    enabled: true,
    intervalMinutes: 15,
    historyStart: '2020-01-01',
    symbols: [],
    lastSuccess: at,
    error: id === 'bitget' ? '1 provider stream needs attention' : undefined,
  });
  const collection = (asset: string, quantity: string, unpriced = false) => ({
    timestamp: at,
    accounts: [{ id: 'wallet', name: 'Spot wallet', product: 'spot' }],
    holdings: [
      { accountId: 'wallet', asset, quantity },
      ...(unpriced
        ? [{ accountId: 'wallet', asset: 'MISSING', quantity: '2' }]
        : []),
    ],
    positions: [],
    events: [],
    coverage: [{ stream: 'balances', status: 'ok' }],
    cursors: {},
  });
  const portfolio = {
    version: 1,
    updatedAt: at,
    connections: [connection('luno', 'Luno'), connection('bitget', 'Bitget')],
    collections: {
      luno: collection('MSFTX', '2'),
      bitget: collection('USDT', '5', true),
    },
    prices: [
      {
        asset: 'MSFTX',
        quote: 'ZAR',
        price: '500',
        timestamp: at,
        source: 'Synthetic token quote',
      },
      {
        asset: 'USDT',
        quote: 'ZAR',
        price: '20',
        timestamp: at,
        source: 'Synthetic stablecoin quote',
      },
    ],
  };
  await page.clock.install({ time: new Date(at) });
  await page.route('https://sync.example.test/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/finance/')) {
      return route.abort();
    }
    if (path.endsWith('/history')) {
      const { at: selectedAt } = route.request().postDataJSON();
      return route.fulfill({
        json: {
          status: 'ok',
          data: {
            ...portfolio,
            collections: Object.fromEntries(
              Object.entries(portfolio.collections).map(([id, collection]) => [
                id,
                { ...collection, timestamp: selectedAt },
              ]),
            ),
            prices: portfolio.prices.map(price => ({
              ...price,
              price: '10',
              timestamp: selectedAt,
            })),
          },
        },
      });
    }
    return route.fulfill({
      json: {
        status: 'ok',
        data: new URL(route.request().url()).pathname.endsWith('/providers')
          ? [
              {
                id: 'luno',
                name: 'Luno',
                passphrase: false,
                products: ['spot'],
              },
            ]
          : portfolio,
      },
    });
  });
  await page.goto('/');
  await new ConfigurationPage(page).createTestFile();
  await page.evaluate(
    async ({ redesign }) => {
      await window.$send('set-server-url', {
        url: 'https://sync.example.test',
        validate: false,
      });
      await window.$send('subscribe-set-token', { token: 'synthetic-session' });
      await window.$send('save-prefs', { cloudFileId: 'fixture-budget' });
      await window.$send('preferences/save', {
        id: 'defaultCurrencyCode',
        value: 'ZAR',
      });
      await window.$send('preferences/save', {
        id: 'flags.newSidebarUI',
        value: redesign ? 'true' : 'false',
      });
      await window.__TANSTACK_QUERY_CLIENT__.invalidateQueries({
        queryKey: ['finance'],
      });
    },
    { redesign },
  );
  // Reload loads metadata/preferences through the normal app lifecycle.
  await page.reload();
}

for (const redesign of [false, true]) {
  test(`shows exchange balances below accounts in ${redesign ? 'redesigned' : 'classic'} sidebar`, async ({
    browser,
  }) => {
    const page = await browser.newPage();
    await prepare(page, redesign);
    const group = page.getByRole('navigation', {
      name: 'Exchange accounts',
      exact: true,
    });
    await expect(group.getByRole('link', { name: /Luno/ })).toBeVisible();
    await group.getByRole('link', { name: /Luno/ }).click();
    await expect(page).toHaveURL(/\/portfolio\/luno$/);
    await expect(
      page
        .getByRole('table', { name: 'Holdings' })
        .getByText('MSFTX', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Holdings' }).getByText('MISSING'),
    ).toHaveCount(0);
    await expect(page).toMatchThemeScreenshots();
    if (!redesign) {
      const currentSidebar = await group
        .getByRole('link', { name: /Luno/ })
        .textContent();
      const balance = page.getByLabel('Portfolio balance', { exact: true });
      const currentBalance = await balance.textContent();
      await page
        .getByLabel('Valuation date', { exact: true })
        .fill('2025-01-01');
      await page.getByRole('button', { name: 'View history' }).click();
      await expect(balance).not.toHaveText(currentBalance ?? '');
      await expect(balance).toContainText('20.00');
      await expect(group.getByRole('link', { name: /Luno/ })).toHaveText(
        currentSidebar ?? '',
      );
      await page.getByRole('button', { name: 'Latest', exact: true }).click();
      await expect(balance).toHaveText(currentBalance ?? '');
    }
    await group.getByRole('link', { name: /Bitget/ }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Missing prices: MISSING' }),
    ).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Holdings' }).getByText('Unpriced'),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Prices and rates' }).click();
    await expect(
      page
        .getByRole('table', { name: 'Prices and exchange rates' })
        .getByText('Synthetic stablecoin quote'),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Connections', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Sync connection' }),
    ).toBeVisible();
    await expect(page).toMatchThemeScreenshots();
    await group.getByRole('link', { name: /^Exchanges/ }).hover();
    await expect(group).toMatchThemeScreenshots();
    await page.close();
  });
}

test('shows exchange accounts and native portfolio layout on mobile', async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await prepare(page);
  await page.getByRole('link', { name: 'Accounts', exact: true }).click();
  const group = page.getByRole('navigation', {
    name: 'Exchange accounts',
    exact: true,
  });
  await expect(group.getByRole('link', { name: /Luno/ })).toBeVisible();
  await group.getByRole('link', { name: /Luno/ }).click();
  await expect(
    page
      .getByRole('table', { name: 'Holdings' })
      .getByText('MSFTX', { exact: true }),
  ).toBeVisible();
  await expect(page).toMatchThemeScreenshots();
  await page.close();
});
