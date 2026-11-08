import { test, expect } from '@playwright/test';

test('local editor previews, discards, saves and offers undo after saving', async ({ page }) => {
  let canUndo = false;
  let saved: { style: { fontSize?: number }; texts: string[] } | undefined;
  let undoCalled = false;
  await page.route('**/api/local-editor', async route => {
    const method = route.request().method();
    if (method === 'POST') { saved = route.request().postDataJSON(); canUndo = true; }
    if (method === 'DELETE') { undoCalled = true; canUndo = false; }
    await route.fulfill({ json: method === 'GET' ? { token: 'test-editor-token', canUndo, entries: [{ id: 've-06f49e315854-1', tag: 'p', file: 'app/about/page.tsx', hash: 'test-hash', texts: ['About Zik'], style: {}, styleEditable: true }] } : { ok: true } });
  });
  await page.goto('/about');
  const panel = page.getByRole('complementary', { name: 'Local visual editor' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Edit page', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Exit editing / discard preview' })).toBeVisible();
  const target = page.locator('[data-local-edit="ve-06f49e315854-1"]');
  await target.click();
  await panel.getByLabel('Font size', { exact: true }).fill('30');
  await expect(target).toHaveCSS('font-size', '30px');
  await panel.getByRole('button', { name: 'Exit editing / discard preview' }).click();
  await expect(target).not.toHaveCSS('font-size', '30px');
  await panel.getByRole('button', { name: 'Edit page', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Exit editing / discard preview' })).toBeVisible();
  await target.click();
  await panel.getByLabel('Font size', { exact: true }).fill('28');
  await panel.getByRole('button', { name: 'Save to source (⌘S)' }).click();
  await expect(panel.getByRole('status')).toHaveText('Saved to source. The change survives refresh.');
  expect(saved?.style.fontSize).toBe(28);
  await panel.getByRole('button', { name: 'Undo last source save' }).click();
  await expect(panel.getByRole('status')).toHaveText('Undone. The previous source has been restored.');
  expect(undoCalled).toBe(true);
});
