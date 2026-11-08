import { test, expect } from '@playwright/test';

test('location helps select a store without signing in', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 51.5163, longitude: -0.1421 });
  await page.goto('/dashboard/store/login');
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByText('Nearby stores are listed below.', { exact: false })).toBeVisible();
  const nearby = page.getByRole('region', { name: 'Find your store' });
  await nearby.getByRole('button', { name: /Tesclo Oxford Street/ }).click();
  await expect(page.getByRole('combobox', { name: 'Store', exact: true })).toHaveValue('zik-london-001');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/\/dashboard\/store\/login$/);
});

test('denied location keeps manual selection available', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_success: unknown, failure: (error: { code: number }) => void) => failure({ code: 1 }) } });
  });
  await page.goto('/dashboard/store/login');
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByText('Location permission was denied.', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Store', exact: true }).selectOption('zik-london-002');
  await expect(page.getByRole('combobox', { name: 'Store', exact: true })).toHaveValue('zik-london-002');
});

test('Google map pins select the login store', async ({ page }) => {
  await page.route('https://maps.googleapis.com/maps/api/js?**', async route => {
    await route.fulfill({ contentType: 'application/javascript', body: `
      window.google = { maps: { importLibrary: async function(name) {
        if (name === 'places') { if (!customElements.get('mock-place-search')) customElements.define('mock-place-search', class extends HTMLElement {}); return { PlaceAutocompleteElement: customElements.get('mock-place-search') }; }
        if (name === 'maps') return {
          Map: class { constructor(host, options) { if (options.mapId) throw new Error('Map ID must not be required'); this.host = host; host.style.position = 'relative'; this.count = 0; } panTo() {} setZoom() {} },
          OverlayView: class {
            static preventMapHitsAndGesturesFrom() {}
            setMap(map) { this.map = map; if (map) { this.index = map.count++; this.onAdd(); this.draw(); } else this.onRemove(); }
            getPanes() { return { overlayMouseTarget: this.map.host }; }
            getProjection() { return { fromLatLngToDivPixel: () => ({ x: 30 + this.index * 50, y: 80 }) }; }
          }
        };
        throw new Error('Unexpected Maps library: ' + name);
      } } };
      window.zikGoogleMapsReady();
    ` });
  });
  await page.goto('/dashboard/store/login');
  await page.getByRole('button', { name: 'Choose on map', exact: true }).click();
  await page.getByRole('button', { name: 'Samesburys Camden', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Store', exact: true })).toHaveValue('zik-london-002');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await page.goto('/find');
  await page.getByRole('button', { name: 'Choose on map', exact: true }).click();
  await page.getByLabel('Store map', { exact: true }).getByRole('button', { name: 'Samesburys Camden', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Selected store' }).getByRole('heading', { name: 'Samesburys Camden' })).toBeVisible();
  await page.getByLabel('Search for a place or address').evaluate(widget => {
    const event = new Event('gmp-select');
    Object.assign(event, { placePrediction: { toPlace: () => ({ displayName: 'Camden', location: { lat: () => 51.5392, lng: () => -0.1426 }, fetchFields: async () => {} }) } });
    widget.dispatchEvent(event);
  });
  await expect(page.getByText('Showing configured stores nearest Camden.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
});


test('find page supports manual filtering without opening Google Maps', async ({ page }) => {
  await page.goto('/find');
  await page.getByRole('searchbox').fill('Camden');
  const directory = page.getByRole('region', { name: 'Store directory' });
  await expect(directory.getByRole('button')).toHaveCount(1);
  await directory.getByRole('button', { name: /Samesburys Camden/ }).click();
  await expect(page.getByRole('region', { name: 'Selected store' }).getByRole('heading', { name: 'Samesburys Camden' })).toBeVisible();
  await page.getByRole('searchbox').fill('no matching store');
  await expect(page.getByText('No configured stores match.', { exact: false })).toBeVisible();
});
