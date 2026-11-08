import { test, expect, type Page } from '@playwright/test';
import type { PartnerApplication } from '../lib/shared/partners/application';
test.use({ viewport: { width: 390, height: 844 } });
async function fillApplication(page: Page) {
  await page.getByLabel('Store or business name').fill('Example test business');
  await page.getByLabel('Full store address and postcode').fill('Example Street, London SW1A 1AA');
  await page.getByRole('combobox', { name: 'Store type', exact: true }).selectOption('Convenience store');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Your name').fill('Test Contact');
  await page.getByLabel('Work email').fill('partner@example.test');
  await page.getByRole('combobox', { name: 'Your role', exact: true }).selectOption('Owner');
  await page.getByLabel('I am authorised').check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('I agree that Zik').check();
}
test('application retry, dashboard resume and demo setup replace support tickets', async ({ page }) => {
  let app: PartnerApplication;
  let fail = true;
  let requestId = '';
  let supportCalls = 0;
  await page.route('**/api/support/tickets', route => { supportCalls++; return route.abort(); });
  await page.route('**/api/partners/applications**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { application: app } });
    const body = route.request().postDataJSON();
    if (body.action === 'create') {
      if (requestId) expect(body.requestId).toBe(requestId);
      requestId = body.requestId;
      if (fail) return route.fulfill({ status: 503, json: { error: 'Please try again shortly.' } });
      app = { id: 'partner_test', details: body.details, status: 'submitted', completedTasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    } else if (body.action === 'simulate_review') app.status = 'setup';
    else { app.completedTasks = [...app.completedTasks, body.task]; app.status = app.completedTasks.length === 3 ? 'ready' : 'setup'; }
    return route.fulfill({ json: { application: app } });
  });
  await page.goto('/stores');
  await expect(page).toHaveURL(/\/partner_stores$/);
  await expect(page.getByRole('heading', { name: 'Bring Zik to your store.' })).toBeVisible();
  await fillApplication(page);
  await expect(page.getByRole('heading', { name: 'Review your application' })).toBeVisible();
  await page.getByRole('button', { name: 'Submit store application' }).click();
  await expect(page.locator('#enquire').getByRole('alert')).toHaveText('Please try again shortly.');
  await expect(page.getByText('Example test business', { exact: false })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Submit store application' }).click();
  await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulate partner review' }).click();
  await expect(page.getByRole('heading', { name: 'Let’s get your store ready' })).toBeVisible();
  for (const label of ['Confirm your store contact', 'Review the staff ID-check guide', 'Plan your counter setup']) {
    await page.getByLabel(label).click();
    await expect(page.getByLabel(label)).toBeChecked();
    await expect(page.getByLabel(label)).toBeEnabled();
  }
  await expect(page.getByRole('heading', { name: 'Demo setup complete' })).toBeVisible();
  await page.locator('#enquire').screenshot({ path: '/tmp/zik-partner-workspace.png' });
  expect(supportCalls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Google selection prefills editable details and survives moving between steps', async ({ page }) => {
  await page.route('https://maps.googleapis.com/maps/api/js?**', route => route.fulfill({ contentType: 'application/javascript', body: `class TestPlaces extends HTMLElement {
    connectedCallback() { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Select Example Shop'; button.onclick = () => { const event = new Event('gmp-select'); event.placePrediction = { toPlace: () => ({ id: 'place-example', displayName: 'Example Shop', formattedAddress: 'Example Street, London', fetchFields: async () => {} }) }; this.dispatchEvent(event); }; this.append(button); }
  } customElements.define('test-places', TestPlaces); window.google = { maps: { importLibrary: async () => ({ PlaceAutocompleteElement: TestPlaces }) } }; window.zikGoogleMapsReady();` }));
  await page.goto('/partner_stores');
  await page.getByRole('button', { name: 'Search with Google' }).click();
  await page.getByRole('button', { name: 'Select Example Shop' }).click();
  await expect(page.getByLabel('Store or business name')).toHaveValue('Example Shop');
  await expect(page.getByLabel('Full store address and postcode')).toHaveValue('Example Street, London');
  await page.getByLabel('Store or business name').fill('Example Shop Ltd');
  await page.getByRole('combobox', { name: 'Store type', exact: true }).selectOption('Convenience store');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Store or business name')).toHaveValue('Example Shop Ltd');
  await page.getByRole('button', { name: 'Remove listing link' }).click();
  await expect(page.getByText('Google listing linked.', { exact: false })).toHaveCount(0);
});

test('Google failure keeps manual entry and service validation available', async ({ page }) => {
  await page.route('https://maps.googleapis.com/maps/api/js?**', route => route.abort());
  await page.goto('/partner_stores');
  await page.getByRole('button', { name: 'Search with Google' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Google search is unavailable' })).toBeVisible();
  await fillApplication(page);
  await page.getByRole('button', { name: 'Edit services' }).click();
  await page.getByLabel('In-person ID checks').uncheck();
  await page.getByLabel('Physical Zik Cards').uncheck();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#enquire').getByRole('alert')).toHaveText('Choose at least one service.');
});

test('partner navigation loads Google-specific document policies', async ({ page }) => {
  await page.goto('/about');
  await page.locator('summary').filter({ hasText: 'for stores' }).click();
  const navigation = page.waitForResponse(response => response.request().isNavigationRequest() && new URL(response.url()).pathname === '/partner_stores');
  await page.getByRole('link', { name: 'Become a partner store', exact: true }).click();
  const response = await navigation;
  expect(response.headers()['content-security-policy']).toContain('https://places.googleapis.com');
  expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  const ordinaryPage = await page.request.get('/about');
  expect(ordinaryPage.headers()['content-security-policy']).not.toContain('https://places.googleapis.com');
  expect(ordinaryPage.headers()['referrer-policy']).toBe('no-referrer');
});
