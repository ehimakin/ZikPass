import { test, expect, type Page } from '@playwright/test';

test('Vault preview: keyboard, retry, mock outcomes and no credential traffic', async ({ page }) => {
  const payloads: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') payloads.push(request.postData() ?? ''); });
  await page.goto('/vault-preview');
  await expect(page.locator('#vault-title')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  const key = page.getByLabel('Vault key', { exact: true });
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await expect(key).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'Enter a demo key' })).toBeVisible();
  await key.pressSequentially('WRONG');
  await expect(page.getByTestId('vault-dial-rotor')).toHaveAttribute('style', /rotate\(-?(18|54|90)deg\)/);
  await key.press('Enter');
  await expect(page.getByTestId('vault-safe')).toHaveAttribute('data-state', 'failure');
  await expect(key).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await expect(page.getByTestId('vault-safe')).toHaveAttribute('data-state', 'failure');
  await key.fill('OPEN');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Demo Vault opened' })).toBeVisible();
  await expect(page.getByTestId('vault-safe')).toHaveCSS('opacity', '0');
  await key.fill('open');
  await key.press('Enter');
  await expect(page.getByTestId('vault-safe')).toHaveAttribute('data-state', 'success');
  expect(payloads.some(value => /WRONG|OPEN/.test(value))).toBe(false);
  await page.reload();
  await expect(key).toHaveValue('');
  await expect(page.getByTestId('vault-safe')).toHaveAttribute('data-state', 'idle');
});

test('a new user can purchase the preview and create an encrypted Vault', async ({ page }) => {
  await page.goto('/vault');
  await expect(page.getByText('NO VAULT ON THIS DEVICE')).toBeVisible();
  await expect(page.locator('form').filter({ has: page.getByLabel('Vault key', { exact: true }) })).toHaveCount(0);
  await page.getByRole('button', { name: 'Get Zik Vault' }).click();

  const signup = page.getByRole('dialog', { name: 'Get Zik Vault' });
  await expect(signup.getByText('Your Vault keeps the details you add encrypted')).toBeVisible();
  await signup.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(signup.getByText('No real payment method is collected')).toBeVisible();
  await signup.getByRole('button', { name: 'Pay £0.99' }).click();

  await signup.getByLabel('Legal name', { exact: true }).fill('Vault Test User');
  await signup.getByLabel('Delivery address', { exact: true }).fill('1 Device Lane, London');
  await signup.getByLabel('Email', { exact: false }).fill('vault@example.test');
  await signup.getByLabel('Create a passphrase', { exact: true }).fill('correct horse battery staple');
  await signup.getByLabel('Confirm passphrase', { exact: true }).fill('correct horse battery staple');
  await signup.getByRole('button', { name: 'Create encrypted Vault' }).click();
  await expect(page.getByRole('dialog', { name: 'Vault created' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to my Vault' }).click();

  await expect(page.locator('#vault-workspace-title')).toBeVisible();
  await expect(page.locator('#vault-title')).toBeVisible();
  await expect(page).toHaveURL(/\/vault$/);
  await expect(page.getByText('Add document', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Add name or designation/ })).toBeVisible();
  const details = page.getByRole('region', { name: 'Names & details' });
  await details.getByRole('button', { name: 'Edit Legal name', exact: true }).click();
  await expect(details.getByRole('button', { name: 'Save Legal name' })).toHaveCount(0);
  await details.getByLabel('Legal name', { exact: true }).fill('Updated Vault User');
  await expect(details.getByRole('button', { name: 'Save Legal name' })).toBeVisible();
  await details.getByLabel('Vault passphrase').fill('incorrect passphrase');
  await details.getByRole('button', { name: 'Save Legal name' }).click();
  await expect(details.getByRole('alert')).toBeVisible();
  await details.getByLabel('Vault passphrase').fill('correct horse battery staple');
  await details.getByRole('button', { name: 'Save Legal name' }).click();
  await expect(details.getByText('Updated Vault User', { exact: true })).toBeVisible();
  await details.getByRole('button', { name: 'Edit Delivery address', exact: true }).click();
  await details.getByLabel('Delivery address', { exact: true }).fill('Unsaved address');
  await details.getByRole('button', { name: 'Cancel editing Delivery address' }).click();
  await expect(details.getByText('1 Device Lane, London', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Add name or designation/ }).click();
  await page.getByLabel('Name or designation', { exact: true }).fill('Director');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await details.getByRole('button', { name: 'Edit Designation', exact: true }).click();
  await details.getByLabel('Designation', { exact: true }).fill('Founder');
  await details.getByRole('button', { name: 'Save Designation' }).click();
  await expect(details.getByText('Founder', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Add document/ }).click();
  const discovery = page.getByRole('dialog', { name: 'Find what matters.' });
  await expect(discovery.getByText('Choose a document yourself')).toBeVisible();
  await expect(discovery.getByLabel('Date of birth')).toBeVisible();
  await expect(discovery.getByLabel('Occupation / employment (CVs)')).toBeVisible();
  await expect(discovery.getByLabel('Camera roll / photo library')).toBeVisible();
  await expect(discovery.getByLabel('Documents library')).toBeVisible();
  await expect(discovery.getByLabel('Files / folders')).toBeVisible();
  await expect(discovery.getByRole('button', { name: 'Show demo matches' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('#vault-title')).toBeVisible();
  await expect(page.getByTestId('vault-safe')).toBeVisible();
  await expect(page.getByLabel('Vault key', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get Zik Vault' })).toHaveCount(0);
  await page.getByLabel('Vault key', { exact: true }).fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await expect(page.locator('#vault-workspace-title')).toBeVisible();
  await expect(details.getByText('Updated Vault User', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect(page.getByTestId('vault-safe')).toHaveAttribute('data-state', 'success');
  await page.getByRole('button', { name: 'Lock Vault' }).click();
  await expect(page.getByLabel('Vault key', { exact: true })).toBeFocused();
  await expect(page.locator('#vault-workspace-title')).toHaveCount(0);
});

test('responsive layouts and reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/vault-preview');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByLabel('Vault key', { exact: true })).toBeVisible();
    const button = await page.getByRole('button', { name: 'Unlock Vault' }).boundingBox();
    expect(button).not.toBeNull();
    expect(button!.x + button!.width).toBeLessThanOrEqual(width - 16);
    await page.screenshot({ path: testInfo.outputPath(`vault-${width}.png`), fullPage: true });
  }
  await page.getByLabel('Vault key', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await expect(page.getByTestId('vault-safe')).toHaveAttribute('data-state', 'failure');
  await expect(page.getByTestId('vault-safe')).toHaveCSS('animation-name', 'none');
  await expect(page.getByTestId('vault-dial-rotor')).toHaveCSS('transform', 'none');
  for (const route of ['/vault-preview']) {
    await page.goto(route);
    await expect(page.locator('#vault-title')).toBeVisible();
  }
  await page.goto('/vault-legacy');
  await expect(page.getByText('Create your local Vault.')).toBeVisible();
});

async function acceptVaultPermission(page: Page) {
  await expect(page.getByRole('button', { name: 'Accept and enter Vault' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'I agree to the local-processing scope above and want to enter the demo Vault.' }).check();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole('button', { name: 'Accept and enter Vault' }).click();
}

test('development key opens a disposable demo Vault and locks cleanly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/vault-preview');
  await page.getByLabel('Vault key', { exact: true }).fill('memaguy');
  await page.getByLabel('Vault key', { exact: true }).press('Enter');
  await acceptVaultPermission(page);
  await expect(page.locator('#demo-vault-title')).toBeFocused();
  await expect(page.getByText('0 sample documents · 0 verified proofs')).toBeVisible();
  await page.getByRole('button', { name: 'Add Photo ID sample' }).click();
  await expect(page.getByText('1 sample document · 0 verified proofs')).toBeVisible();
  await page.getByRole('button', { name: 'Lock Vault' }).click();
  await expect(page.getByLabel('Vault key', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Vault key', { exact: true })).toHaveValue('');
  await page.getByLabel('Vault key', { exact: true }).fill('memaguy');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await acceptVaultPermission(page);
  await expect(page.getByText('0 sample documents · 0 verified proofs')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Vault key', { exact: true })).toHaveValue('');
});

test('document search asks for scope and consent, uses demo matches, and restores focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vault-preview');
  await page.getByLabel('Vault key', { exact: true }).fill('memaguy');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await acceptVaultPermission(page);
  const search = page.getByRole('button', { name: 'search', exact: true });
  await search.click();
  const modal = page.getByRole('dialog', { name: 'Find what matters.' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Show demo matches' })).toBeDisabled();
  await modal.getByLabel('Passport', { exact: true }).check();
  await modal.getByLabel('Camera roll / photo library', { exact: true }).check();
  await expect(modal.getByRole('button', { name: 'Show demo matches' })).toBeDisabled();
  const consent = modal.getByLabel('Allow a demo AI search for these proof details in my selected sources.');
  await consent.check();
  await modal.getByLabel('Something else').fill('Insurance policies');
  await expect(consent).not.toBeChecked();
  await consent.check();
  await modal.getByRole('button', { name: 'Show demo matches' }).click();
  await expect(modal.getByRole('heading', { name: '2 example matches' })).toBeFocused();
  await expect(modal.getByText('Illustrative results only. Your device was not searched.')).toBeVisible();
  await modal.getByRole('button', { name: 'Done' }).click();
  await expect(search).toBeFocused();
  await expect(page.getByText('0 sample documents · 0 verified proofs')).toBeVisible();
  await search.click();
  await expect(modal.getByLabel('Passport', { exact: true })).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(search).toBeFocused();
});

 test('permission decline and persona sample fields stay disposable', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/vault-preview');
  await page.getByLabel('Vault key', { exact: true }).fill('memaguy');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await expect(page.locator('#vault-permission-title')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Add demo document' })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.getByLabel('Vault key', { exact: true })).toBeFocused();
  await page.getByLabel('Vault key', { exact: true }).fill('memaguy');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await acceptVaultPermission(page);
  await page.getByLabel('Name', { exact: true }).fill('Alex Example');
  await page.getByLabel('Date of birth', { exact: true }).fill('1990-01-01');
  await page.getByLabel('Address', { exact: true }).fill('1 Example Street');
  await page.getByRole('button', { name: 'Add National Insurance Number sample' }).click();
  await expect(page.getByText('1 sample document · 0 verified proofs')).toBeVisible();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`vault-persona-${width}.png`), fullPage: true });
  }
  await page.getByRole('button', { name: 'Lock Vault' }).click();
  await page.getByLabel('Vault key', { exact: true }).fill('memaguy');
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await acceptVaultPermission(page);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  await expect(page.getByText('0 sample documents · 0 verified proofs')).toBeVisible();
});
