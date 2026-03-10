import { expect, test, type Page } from '@playwright/test';

type RuntimeTracker = {
  errors: string[];
};

const desktopViewport = { width: 1600, height: 1000 };

async function bootApp(page: Page, options?: { tutorial?: 'on' | 'off' }): Promise<RuntimeTracker> {
  const runtime: RuntimeTracker = { errors: [] };

  page.on('console', (message) => {
    if (message.type() === 'error') runtime.errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    runtime.errors.push(error.message);
  });

  await page.setViewportSize(desktopViewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  const search = new URLSearchParams();
  if (options?.tutorial) search.set('tutorial', options.tutorial);
  await page.goto(`/${search.size ? `?${search.toString()}` : ''}`);
  await expect(page.getByTestId('map-canvas')).toBeVisible();

  return runtime;
}

async function assertRuntimeHealth(page: Page, runtime: RuntimeTracker) {
  await expect.soft(runtime.errors, 'console and page errors').toEqual([]);

  const invalidNestedInteractiveCount = await page.evaluate(() =>
    document.querySelectorAll('button button, button a, a button, button [role="button"], [role="button"] button').length,
  );
  expect.soft(invalidNestedInteractiveCount, 'nested interactive elements').toBe(0);

  const uniqueSelectorIds = [
    'new-map-button',
    'tool-floorRoom',
    'tool-corridor',
    'tool-doorway',
    'tool-note',
    'mode-navigate',
    'fit-map-button',
    'top-search',
    'toggle-3d-preview',
  ];

  for (const id of uniqueSelectorIds) {
    await expect.soft(page.getByTestId(id), `selector ${id}`).toHaveCount(1);
  }

  const layoutFitsDesktop = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  expect.soft(layoutFitsDesktop, 'desktop layout overflow').toBeTruthy();
}

test('completes the first-run tutorial and captures redesigned desktop states', async ({ page }) => {
  const runtime = await bootApp(page, { tutorial: 'on' });

  await expect(page.getByTestId('tutorial-overlay')).toBeVisible();
  await expect(page).toHaveScreenshot('fresh-onboarding.png');
  await expect(page.getByText('Current next action')).toBeVisible();

  await page.getByTestId('tutorial-action').click();
  await expect(page.getByRole('heading', { name: 'Draw a room first' })).toBeVisible();

  await page.getByTestId('tutorial-action').click();
  await expect(page.getByTestId('room-placement-stamp')).toBeVisible();
  await expect(page.getByText('Current next action')).toBeVisible();
  await expect(page.getByText('Add at least one room')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stamp Sample Room' })).toBeVisible();
  await page.getByTestId('tutorial-helper-action').click();
  await expect(page.getByTestId('map-room-count')).toHaveText('1 rooms');
  await expect(page.getByRole('heading', { name: 'Connect it with a corridor' })).toBeVisible();

  await page.getByTestId('tutorial-action').click();
  await expect(page.getByTestId('corridor-width-72')).toBeVisible();
  await expect(page.getByText('Add a corridor')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lay Sample Corridor' })).toBeVisible();
  await page.getByTestId('tutorial-helper-action').click();
  await expect(page.getByTestId('map-corridor-count')).toHaveText('1 corridors');
  await expect(page.getByRole('heading', { name: 'Place a doorway or transition' })).toBeVisible();
  await expect(page).toHaveScreenshot('active-floorplan-editing.png');

  await page.getByTestId('tutorial-action').click();
  await expect(page.getByTestId('transition-preset-door')).toBeVisible();
  await expect(page.getByText('Add a doorway')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Sample Door' })).toBeVisible();
  await page.getByTestId('tutorial-helper-action').click();
  await expect(page.getByTestId('map-door-count')).toHaveText('1 links');
  await expect(page.getByRole('heading', { name: 'Link that doorway to another map' })).toBeVisible();

  await page.getByTestId('tutorial-action').click();
  await expect(page.getByTestId('seed-tutorial-link-button')).toBeVisible();
  await page.locator('[data-testid^="pair-transition-"]').first().click();
  await expect(page.getByRole('heading', { name: 'Layer notes and overlays' })).toBeVisible();

  await page.getByTestId('tutorial-action').click();
  await expect(page.getByText('Pinned Notes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Drop Sample Note' })).toBeVisible();
  await page.getByTestId('tutorial-helper-action').click();
  await expect(page.getByRole('heading', { name: 'Switch into Navigate mode' })).toBeVisible();

  await page.getByTestId('tutorial-action').click();
  await expect(page.getByText('Use linked doorway hotspots to jump between maps.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Travel Linked Exit' })).toBeVisible();
  await page.getByTestId('tutorial-helper-action').click();
  await expect(page.getByRole('heading', { name: 'Use review and revisit tools' })).toBeVisible();
  await expect(page).toHaveScreenshot('linked-transition-navigation.png');

  await page.getByTestId('tutorial-action').click();
  await expect(page.getByTestId('tutorial-overlay')).toBeHidden();
  await expect(page).toHaveScreenshot('review-drawer-open.png');

  await assertRuntimeHealth(page, runtime);
});

test('supports explorer search, review flows, and inspector editing', async ({ page }) => {
  const runtime = await bootApp(page, { tutorial: 'off' });

  await page.getByTestId('top-search').fill('Grate');
  const searchTab = page.getByTestId('drawer-tab-search');
  if (await searchTab.count() === 0) {
    await page.getByRole('button', { name: 'Drawer' }).click();
  }
  await expect(searchTab).toBeVisible();
  await expect(searchTab).toHaveClass(/is-active/);
  await expect(page.getByRole('heading', { name: 'Results for "Grate"' })).toBeVisible();
  await expect(page.locator('[data-testid^="search-result-"]').first()).toBeVisible();

  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="drawer-tab-revisit"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Revisit drawer tab not found');
    button.click();
  });
  await expect(page.getByText('Revisit Planner')).toBeVisible();

  await page.getByTestId('map-item-map_sump_tunnels').click();
  await expect(page.locator('.canvas-meta-strip')).toContainText('Sump Tunnels');

  await page.getByTestId('inspector-tab-map').click();
  await page.getByTestId('map-name-field').fill('Sump Tunnels Revised');
  await page.getByTestId('map-grid-size-field').fill('56');
  await expect(page.locator('.canvas-meta-strip')).toContainText('Sump Tunnels Revised');

  await page.locator('[data-testid^="transition-hotspot-"]').first().click();
  await page.getByTestId('inspector-tab-selection').click();
  await page.getByLabel('Transition').fill('Exit Revised');
  await expect(page.getByLabel('Select Exit Revised')).toBeVisible();

  await page.getByTestId('topbar-more-menu').click();
  await page.getByTestId('toggle-3d-preview').click();
  await expect(page.getByTestId('map-3d-canvas')).toBeVisible();
  await expect(page).toHaveScreenshot('cinematic-preview-open.png');
  await page.getByTestId('topbar-more-menu').click();
  await page.getByTestId('toggle-3d-preview').click();
  await expect(page.getByTestId('fit-map-button')).toBeVisible();

  await assertRuntimeHealth(page, runtime);
});
