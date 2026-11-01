import { test, expect } from '@playwright/test';
test('clerk and customer must independently complete demo prerequisites', async ({ browser, baseURL }) => {
  const clerk = await browser.newContext();
  const customer = await browser.newContext();
  const page = await clerk.newPage();
  const phone = await customer.newPage();
  try {
    const login = await clerk.request.post(`${baseURL}/api/operator/session`, { data: { storeId: 'zik-london-001', code: '8640' } });
    expect(login.ok()).toBeTruthy();
    await page.goto(`${baseURL}/verify/card`);
    await page.getByLabel('Card serial or QR payload').fill('ZKC-DEMO-000097');
    await page.getByRole('button', { name: 'Check card and start onboarding' }).click();
    await expect(page.getByRole('heading', { name: 'Additional document services', exact: true })).toBeVisible();
    await expect(page.getByAltText('Customer demo onboarding QR')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue to customer QR' }).click();
    await expect(page.getByRole('heading', { name: 'Awaiting customer', exact: true })).toBeVisible();
    const code = await page.locator('strong.font-mono').innerText();
    await phone.goto(`${baseURL}/card/pair`);
    await phone.getByLabel('Pairing code from the clerk').fill(code);
    await phone.getByRole('button', { name: 'Connect this demo device' }).click();
    await expect(phone.getByRole('heading', { name: 'Device connected — confirm binding', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Device connected — confirm binding', exact: true })).toBeVisible();
    await phone.getByRole('button', { name: 'Bind verification to this device (demo)', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Completed', exact: true })).toBeVisible();
    await expect(phone.getByRole('heading', { name: 'Completed', exact: true })).toBeVisible();
  } finally { await clerk.close(); await customer.close(); }
});

test('camera starts on demand and releases tracks on stop and successful scan', async ({ page, baseURL }) => {
  await page.request.post(`${baseURL}/api/operator/session`, { data: { storeId: 'zik-london-001', code: '8640' } });
  await page.addInitScript(() => {
    const state = { starts: 0, stops: 0, payload: '' };
    Object.assign(window, { scannerTest: state, BarcodeDetector: class {
      static async getSupportedFormats() { return ['qr_code']; }
      async detect() { return state.payload ? [{ rawValue: state.payload }] : []; }
    } });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      state.starts++;
      return { getTracks: () => [{ stop: () => { state.stops++; } }] };
    } });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { set() {}, get() { return null; } });
    HTMLMediaElement.prototype.play = async () => {};
  });
  const state = () => page.evaluate(() => (window as unknown as { scannerTest: { starts: number; stops: number; payload: string } }).scannerTest);
  await page.goto(`${baseURL}/verify/card`);
  expect((await state()).starts).toBe(0);
  await page.getByRole('button', { name: 'Scan card with camera' }).click();
  await expect.poll(async () => (await state()).starts).toBe(1);
  await page.getByRole('button', { name: 'Stop camera' }).click();
  expect((await state()).stops).toBe(1);
  await page.getByRole('button', { name: 'Scan card with camera' }).click();
  await page.evaluate(() => { (window as unknown as { scannerTest: { payload: string } }).scannerTest.payload = 'ZIKCARD:1:ZKC-DEMO-000098'; });
  await expect(page.getByRole('heading', { name: 'Additional document services', exact: true })).toBeVisible();
  expect((await state()).stops).toBe(2);
  await page.getByRole('button', { name: 'Cancel session', exact: true }).click();
});
