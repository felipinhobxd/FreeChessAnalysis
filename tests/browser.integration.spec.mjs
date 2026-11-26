import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

async function openBoard(page) {
  await page.goto('/analysis');
  await page.locator('#language-select').selectOption('en');
  await page.locator('#language-enter').click();
  await expect(page.locator('#board .square')).toHaveCount(64);
}

function square(page, name) {
  return page.locator(`#board [data-square="${name}"]`);
}

async function serveBundledLite(page) {
  await page.route(/^https:\/\/unpkg\.com\/stockfish@19\.0\.1\/bin\/stockfish-19-lite-single\.(?:js|wasm)$/, async route => {
    const filename = new URL(route.request().url()).pathname.split('/').at(-1);
    await route.fulfill({
      path: fileURLToPath(new URL('../node_modules/stockfish/bin/' + filename, import.meta.url)),
      headers: { 'access-control-allow-origin': '*' },
    });
  });
}

test('the real app boots, unlocks the workspace and imports the bundled example', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/analysis');
  await expect(page.locator('#language-gate')).toBeVisible();
  await page.locator('#language-select').selectOption('pt-BR');
  await page.locator('#language-enter').click();

  await expect(page.locator('#app-content')).toBeVisible();
  await expect(page.locator('#submit')).toBeEnabled();
  await expect(page.locator('#board .square')).toHaveCount(64);

  await page.locator('#example').click();
  await expect(page.locator('#board .square')).toHaveCount(64);
  await expect(page.locator('#panel-sub')).not.toContainText('Posição inicial');
  expect(pageErrors).toEqual([]);
});

test('IndexedDB persists studies, preserves newer revisions and fingerprints content', async ({ page }) => {
  await page.goto('/analysis');
  const result = await page.evaluate(async () => {
    const storage = await import('/study-storage.js');
    const fingerprint = await storage.gameFingerprint('1. e4 e5');
    const record = { id: fingerprint, name: 'Browser integration', date: 20, data: { pgn: '1. e4 e5' } };
    await storage.putStudy(record);
    await storage.putStudy({ ...record, date: 10, name: 'stale overwrite' });
    const loaded = await storage.getStudy(fingerprint);
    const all = await storage.listStudies();
    return { fingerprint, loaded, count: all.length };
  });

  expect(result.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(result.loaded.name).toBe('Browser integration');
  expect(result.loaded.date).toBe(20);
  expect(result.count).toBe(1);
});

test('cloud sync request and error handling work through the browser fetch boundary', async ({ page }) => {
  await page.goto('/analysis');
  const requests = [];
  await page.route('https://iqlfryqkbmadmirkxlvv.supabase.co/rest/v1/rpc/fca_sync_archive', async route => {
    const request = route.request();
    requests.push({
      method: request.method(),
      headers: request.headers(),
      body: request.postDataJSON(),
    });
    const entries = request.postDataJSON()?.p_entries;
    if (Array.isArray(entries) && entries.some(entry => entry.name === 'trigger-error')) {
      await route.fulfill({ status: 413, contentType: 'application/json', body: JSON.stringify({ message: 'Archive entry too large' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'a'.repeat(64), name: 'Cloud roundtrip', date: 10, data: { pgn: '1. e4' } }]) });
  });

  const result = await page.evaluate(async () => {
    const { syncArchive } = await import('/study-cloud.js');
    const code = 'a'.repeat(64);
    const first = await syncArchive(code);
    let invalidCode;
    try { await syncArchive('invalid'); } catch (error) { invalidCode = error.message; }
    let limitError;
    try {
      await syncArchive(code, [{ id: 'b'.repeat(64), name: 'trigger-error', date: 1, data: { pgn: '1. d4' } }]);
    } catch (error) { limitError = error.message; }
    return { first, invalidCode, limitError };
  });

  expect(result.first[0].name).toBe('Cloud roundtrip');
  expect(result.invalidCode).toContain('inválido');
  expect(result.limitError).toContain('grande demais');
  expect(requests).toHaveLength(2);
  expect(requests[0].method).toBe('POST');
  expect(requests[0].headers.apikey).toBeTruthy();
  expect(requests[0].body.p_code).toBe('a'.repeat(64));
});

test('the actual Stockfish Lite worker initializes and returns a legal best move', async ({ page }) => {
  await serveBundledLite(page);
  await page.goto('/analysis');
  test.setTimeout(120_000);
  const result = await page.evaluate(async () => {
    const { Engine } = await import('/engine.js');
    const engine = new Engine('lite');
    try {
      const initialized = await engine.start();
      const searched = await engine.search(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        [], 7, 1
      );
      return { initialized, best: searched.best, lines: searched.lines };
    } finally {
      engine.dispose();
    }
  });
  expect(result.initialized.identity).toMatch(/^Stockfish 19/);
  expect(result.best).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
  expect(result.lines.length).toBeGreaterThan(0);
});

test('clicks, repeated drags and keyboard input each play a single legal move', async ({ page }) => {
  await openBoard(page);
  await square(page, 'e2').click();
  await expect(square(page, 'e2')).toHaveClass(/selected/);
  await square(page, 'e2').click();
  await expect(square(page, 'e2')).not.toHaveClass(/selected/);
  await square(page, 'e2').click();
  await square(page, 'e4').click();
  await expect(square(page, 'e4')).toHaveClass(/occupied/);

  for (const [from, to] of [['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f3', 'g1']]) {
    const origin = await square(page, from).boundingBox();
    const destination = await square(page, to).boundingBox();
    await page.mouse.move(origin.x + origin.width / 2, origin.y + origin.height / 2);
    await page.mouse.down();
    await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(square(page, from)).not.toHaveClass(/occupied/);
    await expect(square(page, to)).toHaveClass(/occupied/);
  }

  await square(page, 'g8').press('Enter');
  await square(page, 'f6').press('Enter');
  await expect(square(page, 'f6')).toHaveClass(/occupied/);
  await expect(page.locator('#ply-count')).toHaveText('6 moves');
});

test.describe('touch board', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('tapping a piece and its destination plays the move', async ({ page }) => {
    await openBoard(page);
    await square(page, 'e2').tap();
    await expect(square(page, 'e2')).toHaveClass(/selected/);
    await square(page, 'e4').tap();
    await expect(square(page, 'e4')).toHaveClass(/occupied/);
    await expect(page.locator('#ply-count')).toHaveText('1 move');
  });
});

test('sharing a side line keeps the original review and puzzle progress in the library', async ({ page }) => {
  await serveBundledLite(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async value => { window.sharedGame = value; } },
    });
  });
  await openBoard(page);
  await page.locator('#example').click();
  await expect(page.locator('#review-start')).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('#report-status')).toContainText('Review complete · depth');
  await expect(page.locator('#accuracy-calibration')).toBeVisible();
  await expect(page.locator('#white-acc')).toHaveText(/^\d+\.\d%$/);

  await page.locator('#tab-puzzles').click();
  await page.locator('#puzzles').getByRole('button', { name: /Blunder/ }).click();
  await square(page, 'g7').click();
  await square(page, 'g6').click();
  await expect(page.locator('#puzzles').getByRole('heading', { name: 'Puzzle solved' })).toBeVisible();
  await page.locator('#tab-report').click();

  await square(page, 'd2').click();
  await square(page, 'd4').click();
  await expect(square(page, 'd4')).toHaveClass(/occupied/);
  await page.locator('#export').click();
  await page.locator('#copy-link').click();
  const shared = await page.evaluate(() => new URL(window.sharedGame).hash);
  const data = new URLSearchParams(shared.slice(1));
  expect(data.get('pgn')).toContain('1. d4');
  expect(data.get('pgn')).not.toContain('1. e4');
  expect(data.get('ply')).toBe('1');
  await page.locator('#save-game').click();

  const archive = await page.evaluate(async () => {
    const { listStudies } = await import('/study-storage.js');
    return listStudies();
  });
  expect(archive).toHaveLength(1);
  expect(archive[0].data.pgn).toContain('1. e4 e5');
  expect(archive[0].data.ply).toBe(0);
  expect(archive[0].analysis.positions).toHaveLength(8);
  expect(Object.values(archive[0].drills)).toEqual([expect.objectContaining({ status: 'solved' })]);

  await page.locator('#nav-library').click();
  await page.locator('#archive-list button').click();
  await expect(page.locator('#report-status')).toContainText('Saved review');
  await expect(page.locator('#move-list')).toContainText('Qxf7#');
});

test('Full Stockfish stays selected after a reload', async ({ page }) => {
  await openBoard(page);
  await page.locator('#settings-btn').click();
  await page.locator('#engine-mode').selectOption('full');
  await page.reload();
  await page.locator('#settings-btn').click();
  await expect(page.locator('#engine-mode')).toHaveValue('full');
});

test.describe('mobile workspace shortcuts', () => {
  test.use({ viewport: { width: 390, height: 650 } });

  test('jump controls move focus between the board and the active panel', async ({ page }) => {
    await openBoard(page);
    await page.getByRole('button', { name: 'Go to analysis panel' }).click();
    await expect(page.locator('#tab-import')).toBeFocused();
    await page.getByRole('button', { name: 'Go to board' }).click();
    await expect(square(page, 'a8')).toBeFocused();
  });
});
