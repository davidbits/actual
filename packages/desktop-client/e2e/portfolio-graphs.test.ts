import { buildPortfolioTimeline, timelineStart } from '@actual-app/finance';
import type { Collection, Portfolio } from '@actual-app/finance';

import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';

for (const mobile of [false, true]) {
  test(`shows dated portfolio and asset graphs on ${mobile ? 'mobile' : 'desktop'}`, async ({
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
    const at = Date.parse('2026-01-07T12:00:00+02:00');
    const collections = [1, 2, 3, 5, 6, 7].map((day): Collection => ({
      timestamp: Date.parse(`2026-01-0${day}T12:00:00+02:00`),
      accounts: [{ id: 'spot', name: 'Spot', product: 'spot' }],
      holdings: [
        { accountId: 'spot', asset: 'BTC', quantity: String(day + 1) },
        { accountId: 'spot', asset: 'AUNKNOWN', quantity: '1' },
      ],
      positions: [],
      events: [],
      coverage: [{ stream: 'balances', status: 'ok' }],
      cursors: {},
    }));
    const prices = collections.map((collection, index) => ({
      asset: 'BTC',
      quote: 'ZAR',
      price: String(10 + index * 2),
      timestamp: collection.timestamp,
      source: 'Synthetic quote',
    }));
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
          lastSuccess: at,
        },
      ],
      collections: { fixture: collections[collections.length - 1] },
      prices,
    };
    const requests: Array<{
      days: number;
      connectionId?: string;
      at?: number;
    }> = [];
    await page.clock.install({ time: new Date(at) });
    await page.route('https://sync.example.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith('/finance/')) return route.abort();
      if (path.endsWith('/timeline')) {
        const body = route.request().postDataJSON();
        requests.push(body);
        const through = body.at ?? at;
        return route.fulfill({
          json: {
            status: 'ok',
            data: buildPortfolioTimeline(
              { fixture: collections },
              prices,
              timelineStart(through, body.days),
              through,
            ),
          },
        });
      }
      if (path.endsWith('/history')) {
        return route.fulfill({ json: { status: 'ok', data: portfolio } });
      }
      return route.fulfill({
        json: {
          status: 'ok',
          data: path.endsWith('/providers') ? [] : portfolio,
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
    await expect(
      page
        .getByRole('table', { name: 'Holdings' })
        .getByText('BTC', { exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Graphs', exact: true }).click();
    const chart = page.getByRole('region', {
      name: 'Priced portfolio value (ZAR)',
      exact: true,
    });
    const table = page.getByRole('table', { name: 'Portfolio value history' });
    await expect(chart.locator('.recharts-line-curve')).toBeVisible();
    const path = await chart.locator('.recharts-line-curve').getAttribute('d');
    expect(path?.match(/M/g)).toHaveLength(2);
    if (!mobile) {
      await chart.locator('.recharts-line-dot').last().hover();
      await expect(
        chart.getByText('2026-01-07', { exact: true }),
      ).toBeVisible();
      await expect(chart.getByText(/160\.00/)).toBeVisible();
      await expect(
        chart.getByText('Partial valuation', { exact: true }),
      ).toBeVisible();
    }
    await expect(
      table.getByRole('row').filter({ hasText: '2026-01-07' }),
    ).toContainText('160.00');
    await expect(
      table.getByRole('row').filter({ hasText: '2026-01-04' }),
    ).toContainText('No saved holdings');
    expect(requests.at(-1)).toMatchObject({
      days: 30,
      connectionId: 'fixture',
    });
    await page.getByLabel('Graph range', { exact: true }).click();
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Last 7 days', exact: true })
      .click();
    await expect.poll(() => requests.at(-1)?.days).toBe(7);
    await expect(table.getByRole('row')).toHaveCount(8);
    await expect(chart).toMatchThemeScreenshots();
    const assetChart = page.getByRole('region', {
      name: 'BTC · Holding value (ZAR)',
      exact: true,
    });
    await expect(assetChart.locator('.recharts-line-curve')).toBeVisible();
    await expect(assetChart).toMatchThemeScreenshots();
    await expect(
      page.getByRole('region', {
        name: 'Daily graph observations',
        exact: true,
      }),
    ).toMatchThemeScreenshots();
    await table.getByRole('row').last().scrollIntoViewIfNeeded();
    await expect(table.getByRole('row').last()).toBeInViewport();
    await page.getByLabel('Asset metric', { exact: true }).click();
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Price / rate (ZAR)', exact: true })
      .click();
    await expect(
      page
        .getByRole('region', { name: 'BTC · Price / rate (ZAR)', exact: true })
        .locator('.recharts-line-curve'),
    ).toBeVisible();
    await page.getByLabel('Asset metric', { exact: true }).click();
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Net units', exact: true })
      .click();
    await expect(
      page
        .getByRole('region', { name: 'BTC · Net units', exact: true })
        .locator('.recharts-line-curve'),
    ).toBeVisible();
    await page.getByLabel('Graph asset', { exact: true }).click();
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'AUNKNOWN', exact: true })
      .click();
    await page.getByLabel('Asset metric', { exact: true }).click();
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Holding value (ZAR)', exact: true })
      .click();
    await expect(
      page
        .getByRole('region', {
          name: 'AUNKNOWN · Holding value (ZAR)',
          exact: true,
        })
        .getByText('No saved values in this range.'),
    ).toBeVisible();
    if (!mobile) {
      await page.getByRole('button', { name: 'Enable privacy mode' }).click();
      await expect(chart.locator('.recharts-wrapper')).toHaveCount(0);
      await page.getByRole('button', { name: 'Disable privacy mode' }).click();
      await page
        .getByLabel('Valuation date', { exact: true })
        .fill('2026-01-03');
      await page
        .getByRole('button', { name: 'View history', exact: true })
        .click();
      await expect
        .poll(() => requests.at(-1)?.at)
        .toBe(Date.parse('2026-01-03T23:59:59+02:00'));
      await expect(
        table.getByRole('row').filter({ hasText: '2026-01-07' }),
      ).toHaveCount(0);
      await page.getByRole('button', { name: 'Latest', exact: true }).click();
      await expect(
        table.getByRole('row').filter({ hasText: '2026-01-07' }),
      ).toBeVisible();
    }
    // Return to the already-cached default range before opening it offline.
    await page.getByLabel('Graph range', { exact: true }).click();
    await page
      .getByRole('menu')
      .getByRole('button', { name: 'Last 30 days', exact: true })
      .click();
    await expect(page.getByLabel('Graph range', { exact: true })).toContainText(
      'Last 30 days',
    );
    await page.unroute('https://sync.example.test/**');
    await page.route('https://sync.example.test/**', route => route.abort());
    await page.reload();
    await page.getByRole('tab', { name: 'Graphs', exact: true }).click();
    await expect(chart.locator('.recharts-line-curve')).toBeVisible();
    await expect(
      page.getByText(
        'Server unavailable. Showing saved graph history where available.',
      ),
    ).toBeVisible();
    await page.close();
  });
}
