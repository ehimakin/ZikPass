import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });
test('partner page captures an enquiry and preserves details on failure', async ({ page }) => {
  let payload: Record<string, string> = {};
  await page.route('**/api/support/tickets', async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Please try again shortly.' }) });
  });
  await page.goto('/stores');
  await expect(page).toHaveURL(/\/partner_stores$/);
  await expect(page.getByRole('heading', { name: 'Bring Zik to your store.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Already a partner? Staff sign-in' })).toHaveAttribute('href', '/store');
  await page.getByRole('link', { name: 'Become a partner', exact: true }).click();
  await page.getByLabel('Store or business name').fill('Example test business');
  await page.getByLabel('Town and postcode').fill('London SW1A 1AA');
  await page.getByLabel('Your name').fill('Test Contact');
  await page.getByLabel('Work email').fill('partner@example.test');
  await page.getByLabel('I agree that Zik').check();
  await page.getByRole('button', { name: 'Send store enquiry' }).click();
  await expect(page.locator('#enquire').getByRole('alert')).toHaveText('Please try again shortly.');
  expect(payload.category).toBe('store_partner');
  expect(payload.subject).toBe('Store partnership: Example test business');
  expect(payload.body).toContain('Location: London SW1A 1AA');
  expect(payload.email).toBe('partner@example.test');
  await expect(page.getByLabel('Store or business name')).toHaveValue('Example test business');
  const requestId = payload.requestId;
  await page.getByRole('button', { name: 'Send store enquiry' }).click();
  await expect(page.getByRole('button', { name: 'Send store enquiry' })).toBeEnabled();
  expect(payload.requestId).toBe(requestId);
  await page.unroute('**/api/support/tickets');
  await page.route('**/api/support/tickets', route => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'help_partner_test' }) }));
  await page.route('**/api/support/tickets/help_partner_test', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'help_partner_test', subject: payload.subject, category: 'store_partner', status: 'open', resolution: '', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] }) }));
  await page.getByRole('button', { name: 'Send store enquiry' }).click();
  await expect(page).toHaveURL(/\/help\/ticket\/help_partner_test$/);
  await expect(page.getByRole('heading', { name: 'Store partnership: Example test business' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
