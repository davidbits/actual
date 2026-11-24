import type { Portfolio } from '@actual-app/finance';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';

for (const mobile of [false, true]) {
  test(`edits refresh schedules and compares saved asset changes on ${mobile ? 'mobile' : 'desktop'}`, async ({
    browser,
  }) => {
    const page = await browser.newPage(
      mobile
        ? {
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          }
        : {},
    );
    const at = Date.parse('2026-01-02T12:00:00Z');
    const before = at - 86400000;
    const portfolio: Portfolio = {
      version: 1,
      updatedAt: at,
      connections: [
        {
          id: 'fixture',
          provider: 'luno',
          name: 'Synthetic exchange',
          enabled: true,
          intervalMinutes: 15,
          historyStart: '2020-01-01',
          symbols: [],
          lastAttempt: at,
          lastSuccess: at,
        },
      ],
      collections: {
        fixture: {
          timestamp: at,
          accounts: [{ id: 'spot', name: 'Spot', product: 'spot' }],
          holdings: [
            { accountId: 'spot', asset: 'BTC', quantity: '3' },
            { accountId: 'spot', asset: 'UNKNOWN', quantity: '1' },
          ],
          positions: [],
          events: [],
          coverage: [{ stream: 'balances', status: 'ok' }],
          cursors: {},
        },
      },
      comparison: {
        at: before,
        collections: {
          fixture: {
            timestamp: before,
            accounts: [{ id: 'spot', name: 'Spot', product: 'spot' }],
            holdings: [{ accountId: 'spot', asset: 'BTC', quantity: '2' }],
            positions: [],
            events: [],
            coverage: [{ stream: 'balances', status: 'ok' }],
            cursors: {},
          },
        },
      },
      prices: [
        {
          asset: 'BTC',
          quote: 'ZAR',
          price: '10',
          timestamp: before,
          source: 'Synthetic quote',
        },
        {
          asset: 'BTC',
          quote: 'ZAR',
          price: '12',
          timestamp: at,
          source: 'Synthetic quote',
        },
      ],
    };
    await page.clock.install({ time: new Date(at) });
    await page.route('https://sync.example.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith('/finance/')) return route.abort();
      if (path.endsWith('/connect')) {
        const input = route.request().postDataJSON();
        expect(input.credentials).toBeUndefined();
        expect(input.intervalMinutes).toBeLessThanOrEqual(1440);
        portfolio.connections[0] = {
          ...portfolio.connections[0],
          intervalMinutes: input.intervalMinutes,
          enabled: input.enabled,
        };
      }
      return route.fulfill({
        json: {
          status: 'ok',
          data: path.endsWith('/providers')
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
    await page.evaluate(async () => {
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
    });
    await page.goto('/portfolio/fixture');
    await page.getByRole('tab', { name: 'Connections', exact: true }).click();
    // The add-connection form has the same interval label while saved data loads.
    await expect(
      page.getByText('Automatic sync every 15 minutes'),
    ).toBeVisible();
    const interval = page.getByLabel('Refresh interval in minutes');
    await interval.fill('1441');
    await page.getByRole('button', { name: 'Save schedule' }).click();
    expect(portfolio.connections[0].intervalMinutes).toBe(15);
    await interval.fill('1440');
    await page.getByRole('button', { name: 'Save schedule' }).click();
    await expect(
      page.getByText('Automatic sync every 1440 minutes'),
    ).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: 'Connections', exact: true }).click();
    await expect(interval).toHaveValue('1440');
    await expect(page.getByText(/Next sync due/)).toBeVisible();
    await expect(page.getByRole('tabpanel')).toMatchThemeScreenshots();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByText('Automatic sync paused')).toBeVisible();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(
      page.getByText('Automatic sync every 1440 minutes'),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Changes', exact: true }).click();
    const table = page.getByRole('table', { name: 'Asset changes' });
    const btc = table.getByRole('row').filter({ hasText: 'BTC' });
    await expect(btc).toContainText('2 → 3');
    await expect(btc).toContainText('10 → 12');
    await expect(btc.getByRole('cell').last()).toContainText('16.00');
    await expect(
      table.getByRole('row').filter({ hasText: 'UNKNOWN' }),
    ).toContainText('Unavailable');
    await expect(page.getByRole('tabpanel')).toMatchThemeScreenshots();
    await page.unroute('https://sync.example.test/**');
    await page.route('https://sync.example.test/**', route => route.abort());
    await page.reload();
    await page.getByRole('tab', { name: 'Changes', exact: true }).click();
    await expect(btc.getByRole('cell').last()).toContainText('16.00');
    await expect(
      page.getByText('Server unavailable. Showing last saved portfolio.'),
    ).toBeVisible();
    await page.close();
  });
}
