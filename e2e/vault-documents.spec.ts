import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { resetDemo } from './helpers';

/**
 * The real document journey: choose files, consent, local extraction, review,
 * lock and reopen, readiness, application, and deletion withdrawing readiness.
 *
 * Every assertion here runs against the actual pipeline — real OCR, real
 * encrypted storage — not a mock.
 */
const fixtures = join(__dirname, '../tests/fixtures/documents');
const secret = 'correct horse battery staple';
const name = 'Alex Morgan Rivers';
const address = 'Flat 3, 14 Harbour Lane, Bristol, BS1 4TR';

test.describe.configure({ mode: 'serial' });

async function createVault(page: Page) {
  await page.goto('/vault');
  await page.getByRole('button', { name: 'Get Zik Vault' }).click();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.getByRole('button', { name: /Pay £0.99/ }).click();
  await page.getByLabel('Legal name').fill(name);
  await page.getByLabel('Delivery address').fill(address);
  await page.getByLabel('Create a passphrase').fill(secret);
  await page.getByLabel('Confirm passphrase').fill(secret);
  await page.getByRole('button', { name: 'Create encrypted Vault' }).click();
  await page.getByRole('button', { name: 'Go to my Vault' }).click();
  await expect(page.getByRole('heading', { name: 'Vault.' })).toBeVisible();
}

async function unlock(page: Page) {
  await page.goto('/vault');
  await page.getByLabel('Vault key').fill(secret);
  await page.getByRole('button', { name: 'Unlock Vault' }).click();
  await expect(page.getByRole('heading', { name: 'Vault.' })).toBeVisible({ timeout: 20_000 });
}

/** Drives the OS file picker by handing Playwright the files it would have returned. */
async function addDocuments(page: Page, files: string[], { analyse }: { analyse: boolean }) {
  await page.getByRole('button', { name: /Add document/ }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Add files/ }).click();
  await (await chooser).setFiles(files.map(file => join(fixtures, file)));
  await expect(page.getByRole('heading', { name: 'What you have chosen' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Keep these in my Vault/ }).check();
  if (analyse) await page.getByRole('checkbox', { name: /read them on this device/ }).check();
  await page.getByRole('button', { name: analyse ? 'Add and read' : 'Add without reading' }).click();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible({ timeout: 180_000 });
  await page.getByRole('button', { name: 'Done' }).click();
}

// Real OCR takes seconds per document, so these need more than the default budget.
test.beforeEach(async ({ request }) => { test.setTimeout(240_000); await resetDemo(request); });

test('documents are read on the device, reviewed, and survive lock and reload', async ({ page }) => {
  await createVault(page);
  await addDocuments(page, ['passport-clean.png'], { analyse: true });

  await expect(page.getByText(/Passport · Read/)).toBeVisible();
  const proposal = page.getByRole('listitem').filter({ hasText: 'ALEX MORGAN RIVERS' }).first();
  await expect(proposal).toBeVisible();
  await expect(proposal.getByText('Matches your details')).toBeVisible();

  // The date of birth was not in the Vault before, so it is offered rather than assumed.
  const birth = page.getByRole('listitem').filter({ hasText: '1994-03-12' }).first();
  await expect(birth.getByText('You have not added this yet')).toBeVisible();
  await birth.getByRole('button', { name: 'Use this' }).click();

  await page.getByRole('button', { name: 'Lock Vault' }).click();
  await page.reload();
  await unlock(page);
  await expect(page.getByText('passport-clean.png', { exact: true })).toBeVisible();
  await expect(page.getByText('1994-03-12').first()).toBeVisible();
});

test('a stored-only import is never read', async ({ page }) => {
  await createVault(page);
  await addDocuments(page, ['passport-clean.png'], { analyse: false });
  await expect(page.getByText(/Not read · Stored, not read/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Found in your documents' })).toHaveCount(0);
});

test('nothing about a document leaves the device while it is read', async ({ page }) => {
  const origin = new URL(process.env.ZIK_E2E_BASE_URL ?? 'http://localhost:3000').origin;
  const bodies: string[] = [];
  const offDevice: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== origin) offDevice.push(url.href);
    bodies.push(request.postData() ?? '');
  });
  await createVault(page);
  await addDocuments(page, ['passport-clean.png', 'utility-bill-recent.pdf'], { analyse: true });

  for (const body of bodies) {
    for (const value of ['ALEX MORGAN', 'RIVERS', 'Harbour Lane', '1994-03-12', '987654321', secret]) {
      expect(body, `a request body carried ${value}`).not.toContain(value);
    }
  }
  expect(offDevice, `requests left the origin: ${offDevice.join(', ')}`).toEqual([]);

  // Stored bytes and extracted text are ciphertext on disk.
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const open = indexedDB.open('zik-vault'); open.onsuccess = () => resolve(open.result); });
    const read = (store: string) => new Promise<unknown[]>(resolve => { const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => resolve(request.result); });
    const dump = JSON.stringify([await read('documents'), await read('observations'), await read('claims'), await read('profile')]);
    db.close();
    return dump;
  });
  for (const value of ['ALEX MORGAN', 'Harbour Lane', 'passport-clean.png', '1994-03-12']) expect(stored).not.toContain(value);
});

test('a conflict blocks readiness until it is resolved', async ({ page }) => {
  await createVault(page);
  await addDocuments(page, ['passport-clean.png', 'driving-licence-dob-conflict.png'], { analyse: true });
  const birth = page.getByRole('listitem').filter({ hasText: '1994-03-12' }).first();
  await birth.getByRole('button', { name: 'Use this' }).click();
  const conflict = page.getByRole('listitem').filter({ hasText: '1974-03-12' }).first();
  await expect(conflict.getByText('Different from your details')).toBeVisible();
  await conflict.getByRole('button', { name: 'Keep mine' }).click();
  await expect(page.getByText(/Resolve the difference between the dates of birth/)).toHaveCount(0);
});

test('unsupported and damaged files are reported individually', async ({ page }) => {
  await createVault(page);
  await page.getByRole('button', { name: /Add document/ }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Add files/ }).click();
  await (await chooser).setFiles([join(fixtures, 'passport-clean.heic'), join(fixtures, 'passport-clean.png')]);
  // HEIC is refused before any consent is given, with a reason.
  await expect(page.getByText(/HEIC photos cannot be opened by browsers/)).toBeVisible();
  await expect(page.getByText('1 file was left out')).toBeVisible();
  await page.getByRole('checkbox', { name: /Keep these in my Vault/ }).check();
  await page.getByRole('checkbox', { name: /read them on this device/ }).check();
  await page.getByRole('button', { name: 'Add and read' }).click();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible({ timeout: 120_000 });
});

test('deleting supporting evidence withdraws readiness', async ({ page }) => {
  await createVault(page);
  await addDocuments(page, ['passport-clean.png'], { analyse: true });
  await expect(page.getByRole('heading', { name: /What a Zik ID application would need/ })).toBeVisible();
  await expect(page.getByText(/Add a passport or driving licence/)).toHaveCount(0);

  await page.getByRole('button', { name: 'Delete' }).first().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(page.getByText(/Add a passport or driving licence/)).toBeVisible();
});
