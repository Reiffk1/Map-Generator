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
    'generate-dungeon-button',
  ];

  for (const id of uniqueSelectorIds) {
    await expect.soft(page.getByTestId(id), `selector ${id}`).toHaveCount(1);
  }

  const layoutFitsDesktop = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
  expect.soft(layoutFitsDesktop, 'desktop layout overflow').toBeTruthy();
}

async function clickWorldPoint(page: Page, point: { x: number; y: number }) {
  const screenPoint = await page.evaluate((worldPoint) => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    const map = debug.selectActiveMap();
    return {
      x: map.view.pan.x + worldPoint.x * map.view.zoom,
      y: map.view.pan.y + worldPoint.y * map.view.zoom,
    };
  }, point);

  const canvasBox = await page.locator('.konvajs-content').boundingBox();
  if (!canvasBox) throw new Error('Konva canvas not found');

  await page.mouse.click(canvasBox.x + screenPoint.x, canvasBox.y + screenPoint.y);
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

  await page.getByTestId('map-item-map_sump_tunnels').dispatchEvent('click');
  await expect(page.locator('.canvas-meta-strip')).toContainText('Sump Tunnels');

  await page.getByTestId('inspector-tab-map').dispatchEvent('click');
  await page.getByTestId('map-name-field').fill('Sump Tunnels Revised');
  await page.getByTestId('map-grid-size-field').fill('56');
  await expect(page.locator('.canvas-meta-strip')).toContainText('Sump Tunnels Revised');

  await page.locator('[data-testid^="transition-hotspot-"]').first().dispatchEvent('click');
  await page.getByTestId('inspector-tab-selection').dispatchEvent('click');
  await page.getByLabel('Transition').fill('Exit Revised');
  await expect(page.getByLabel('Select Exit Revised')).toBeVisible();

  await page.evaluate(() => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    debug.store.getState().setViewMode('third_orbit');
  });
  await expect(page.getByTestId('map-3d-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset Camera' })).toBeVisible();
  await expect(page.getByRole('button', { name: /First Person/ })).toBeVisible();
  await expect(page).toHaveScreenshot('cinematic-preview-open.png');
  await page.evaluate(() => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    debug.store.getState().setViewMode('plan_2d');
  });
  await expect(page.getByTestId('fit-map-button')).toBeVisible();

  await assertRuntimeHealth(page, runtime);
});

test('builds a scratch map with snapped doors, chest overlays, and editable notes', async ({ page }) => {
  const runtime = await bootApp(page, { tutorial: 'off' });

  await page.getByTestId('new-map-button').click();
  await page.evaluate(async () => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    const store = debug.store.getState();
    store.addFloorRoom({ x: 336, y: 240, width: 240, height: 168 });
    store.addCorridor([{ x: 576, y: 324 }, { x: 720, y: 324 }]);
  });

  await expect(page.getByTestId('map-room-count')).toHaveText('1 rooms');
  await expect(page.getByTestId('map-corridor-count')).toHaveText('1 corridors');

  const wallStateBeforeDoor = await page.evaluate(async () => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    const map = debug.selectActiveMap();
    const room = map.floorRooms[0];
    const roomEdge = room.bounds.x + room.bounds.width;
    const eastWallLengths = map.wallSegments
      .map((wall) => {
        const [start, end] = wall.points;
        if (!start || !end) return null;
        if (Math.abs(start.x - roomEdge) > 1 || Math.abs(end.x - roomEdge) > 1) return null;
        return Math.abs(end.y - start.y);
      })
      .filter((length): length is number => length !== null);

    return {
      doorCount: map.doorways.length,
      roomHeight: room.bounds.height,
      eastWallLengths,
    };
  });

  expect(wallStateBeforeDoor.doorCount).toBe(0);
  expect(wallStateBeforeDoor.eastWallLengths.some((length) => length >= wallStateBeforeDoor.roomHeight - 1)).toBeTruthy();

  await page.getByTestId('tool-doorway').click();
  await expect(page.getByTestId('transition-preset-portcullis')).toBeVisible();
  await page.getByTestId('transition-preset-portcullis').click();

  const doorwayTarget = await page.evaluate(async () => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    const map = debug.selectActiveMap();
    return map.corridors[0].points[0]!;
  });
  await clickWorldPoint(page, doorwayTarget);

  await expect(page.getByTestId('map-door-count')).toHaveText('1 links');

  const wallStateAfterDoor = await page.evaluate(async () => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    const map = debug.selectActiveMap();
    const room = map.floorRooms[0];
    const roomEdge = room.bounds.x + room.bounds.width;
    const eastWallLengths = map.wallSegments
      .map((wall) => {
        const [start, end] = wall.points;
        if (!start || !end) return null;
        if (Math.abs(start.x - roomEdge) > 1 || Math.abs(end.x - roomEdge) > 1) return null;
        return Math.abs(end.y - start.y);
      })
      .filter((length): length is number => length !== null);

    return {
      selectedDoorType: map.doorways[0]?.transitionType,
      roomHeight: room.bounds.height,
      eastWallLengths,
    };
  });

  expect(wallStateAfterDoor.selectedDoorType).toBe('portcullis');
  expect(wallStateAfterDoor.eastWallLengths.some((length) => length >= wallStateAfterDoor.roomHeight - 1)).toBeFalsy();

  const tutorialDismiss = page.getByTestId('tutorial-dismiss');
  if (await tutorialDismiss.count()) {
    await tutorialDismiss.click();
  }

  await page.getByTestId('tool-marker').click();
  await expect(page.getByTestId('marker-preset-chest')).toBeVisible();
  await page.getByTestId('marker-preset-chest').click();
  await clickWorldPoint(page, { x: 648, y: 372 });

  const chestMarker = await page.evaluate(async () => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    const map = debug.selectActiveMap();
    return map.markers.at(-1);
  });

  expect(chestMarker?.iconId).toBe('chest');

  await page.getByTestId('tool-note').click();
  await clickWorldPoint(page, { x: 660, y: 468 });
  await page.getByLabel('Title').last().fill('Route Reminder');
  await page.getByLabel('Body').last().fill('Portcullis added after the corridor was confirmed.');

  const editedNote = await page.evaluate(async () => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    const store = debug.store.getState();
    const map = debug.selectActiveMap();
    const selectedId = store.selection.ids[0];
    return map.notesBoard.find((note) => note.id === selectedId);
  });

  expect(editedNote?.title).toBe('Route Reminder');
  expect(editedNote?.body).toContain('Portcullis added');

  await assertRuntimeHealth(page, runtime);
});

test('generates a tilemap dungeon and previews it in 3D', async ({ page }) => {
  const runtime = await bootApp(page, { tutorial: 'off' });

  await page.getByTestId('generate-dungeon-button').click();

  const dungeonTab = page.getByRole('button', { name: 'Open Generated Dungeon' });
  await expect(dungeonTab).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId('map-canvas')).toBeVisible();
  await expect(page.getByTestId('map-tabs')).toContainText('Generated Dungeon');
  await expect(page).toHaveScreenshot('generated-dungeon.png');

  await page.evaluate(() => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    debug.store.getState().setViewMode('third_orbit');
  });
  await expect(page.getByTestId('map-3d-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset Camera' })).toBeVisible();
  await expect(page.getByRole('button', { name: /First Person/ })).toBeVisible();
  await expect(page).toHaveScreenshot('generated-dungeon-3d.png');

  await page.evaluate(() => {
    const debug = window.__WAYFINDER_DEBUG__;
    if (!debug) throw new Error('Wayfinder debug hook unavailable');
    debug.store.getState().setViewMode('plan_2d');
  });
  await expect(page.getByTestId('map-canvas')).toBeVisible();

  await assertRuntimeHealth(page, runtime);
});
