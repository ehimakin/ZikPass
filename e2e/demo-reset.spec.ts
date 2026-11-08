import { test, expect } from '@playwright/test';

test('reset handles server failures then clears only demo data after confirmation', async ({ page }) => {
  let fail = true;
  let requests = 0;
  await page.route('**/api/demo/reset', route => {
    requests++;
    return route.fulfill({ status: fail ? 500 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: 'failed' } : { ok: true }) });
  });
  await page.goto('/help');
  await page.evaluate(async () => {
    localStorage.setItem('zik-pass-wallet', JSON.stringify({ enrollmentId: 'old-enrollment' }));
    localStorage.setItem('zik-vault-onboarding', 'paid');
    localStorage.setItem('zikpass-selected-store', 'test');
    localStorage.setItem('unrelated-preference', 'keep');
    sessionStorage.setItem('zik-purchase-sale:test', 'old-sale');
    sessionStorage.setItem('unrelated-session', 'keep');
    for (const [name, store, key, value] of [
      ['zik-pass-wallet', 'wallet', 'primary', { id: 'primary', state: { enrollmentId: 'old-enrollment' } }],
      ['zik-local-vault', 'encrypted', 'profile', { ciphertext: 'test-placeholder' }]
    ] as const) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(store, store === 'wallet' ? { keyPath: 'id' } : undefined);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(store, 'readwrite');
          if (store === 'wallet') tx.objectStore(store).put(value); else tx.objectStore(store).put(value, key);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      });
    }
  });
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await page.getByRole('button', { name: 'Delete and reset demo' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('server reset failed');
  expect(await page.evaluate(() => localStorage.getItem('zik-vault-onboarding'))).toBe('paid');
  fail = false;
  await page.getByRole('button', { name: 'Delete and reset demo' }).click();
  await expect(page.locator('main').getByRole('status')).toContainText('Demo reset complete');
  expect(await page.evaluate(() => ({
    legacy: localStorage.getItem('zik-pass-wallet'), onboarding: localStorage.getItem('zik-vault-onboarding'),
    sale: sessionStorage.getItem('zik-purchase-sale:test'), preference: localStorage.getItem('unrelated-preference'), session: sessionStorage.getItem('unrelated-session')
  }))).toEqual({ legacy: null, onboarding: null, sale: null, preference: 'keep', session: 'keep' });
  await page.goto('/wallet');
  await expect(page.getByText('Not added', { exact: true })).toBeVisible();
  await page.goto('/vault');
  await expect(page.getByRole('button', { name: 'Get Zik Vault' })).toBeVisible();
});
