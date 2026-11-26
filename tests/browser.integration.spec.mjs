import { test, expect } from '@playwright/test';

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
