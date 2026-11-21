import { expect, test } from './fixtures';
import { ConfigurationPage } from './page-models/configuration-page';
import { Navigation } from './page-models/navigation';

test('keeps financial pages while removing news, tours, and sharing', async ({
  browser,
}) => {
  const page = await browser.newPage();
  try {
    await page.goto('/');
    await new ConfigurationPage(page).createTestFile();

    await page.getByTestId('help-menu-button').click();
    await expect(
      page.getByText('Keyboard shortcuts', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Take a tour', { exact: true })).toHaveCount(0);
    await expect(
      page.getByText('Community support (Discord)', { exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');

    await new Navigation(page).goToSettingsPage();
    await expect(
      page.getByText('Client version', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Update notifications', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText('In-app notifications', { exact: true }),
    ).toHaveCount(0);

    for (const path of ['/notifications', '/user-directory', '/user-access']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/budget$/);
      await expect(page.getByTestId('budget-table')).toBeVisible();
    }
  } finally {
    await page.close();
  }
});
