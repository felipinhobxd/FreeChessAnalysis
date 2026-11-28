import { mkdir, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// The real-engine A/B run is intentionally manual. Normal CI uses a fast mocked
// integration test to verify worker orchestration and quality settings.
test.skip(process.env.CI_PERF_BENCHMARK !== '1', 'Run from the manual Mobile review performance benchmark workflow.');
test.describe.configure({ retries: 0 });

function createDeterministicGame(plies = 8) {
  const chess = new Chess();
  let seed = 0x19a2026;
  for (let ply = 0; ply < plies; ply++) {
    const legal = chess.moves({ verbose: true });
    if (!legal.length) break;
    const candidates = legal.filter(move => !move.san.endsWith('#'));
    const pool = candidates.length ? candidates : legal;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const selected = pool[seed % pool.length];
    chess.move({ from: selected.from, to: selected.to, promotion: selected.promotion });
  }
  return {
    pgn: chess.pgn(),
    plies: chess.history().length,
  };
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

async function unlockApp(page) {
  await page.goto('/analysis');
  await page.locator('#language-select').selectOption('en');
  await page.locator('#community-consent-decline').click();
  await page.locator('#language-enter').click();
  await expect(page.locator('#board .square')).toHaveCount(64);
  await page.locator('#tab-lines').click();
  await page.locator('#engine-toggle').click();
  await page.locator('#tab-import').click();
}

const REPORT = 'artifacts/mobile-review-benchmark.json';
const ENVIRONMENT = {
  browser: 'Chromium via Playwright',
  viewport: '390x844',
  touch: true,
  cpuThrottle: '4x',
  engine: 'Stockfish 19 Lite single-thread WASM',
  depth: 14,
  multiPV: 3,
};

async function measureFullReview(browser, fixture, logicalProcessors) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(cores => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: cores });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
  }, logicalProcessors);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await serveBundledLite(page);

  try {
    await unlockApp(page);
    await page.locator('#game-input').fill(fixture.pgn);
    await page.locator('#submit').click();
    await expect(page.locator('#move-list button')).toHaveCount(fixture.plies);
    await page.locator('#tab-report').click();

    await page.evaluate(async () => {
      const { Engine } = await import('/engine.js');
      const original = Engine.prototype.search;
      const engineIds = new WeakMap();
      let nextEngineId = 0;
      window.__mobileReviewSearches = [];
      Engine.prototype.search = function(rootFen, moves, depth, lines, options) {
        if (!engineIds.has(this)) engineIds.set(this, ++nextEngineId);
        const workerId = engineIds.get(this);
        return original.call(this, rootFen, moves, depth, lines, options).then(result => {
          window.__mobileReviewSearches.push({
            workerId,
            requestedDepth: depth,
            requestedMultiPV: lines,
            resultDepth: Math.min(...result.lines.map(line => Number(line.depth) || 0)),
            resultLineCount: result.lines.length,
          });
          return result;
        });
      };
    });

    const reviewStartedAt = await page.evaluate(() => performance.now());
    await page.evaluate(() => { window.__mobileReviewSearches.length = 0; });
    await page.locator('#review-btn').click();
    await expect.poll(async () => page.locator('#review-progress').evaluate(el => !el.hidden), {
      timeout: 10_000,
      intervals: [100, 250, 500],
    }).toBe(true);
    await expect.poll(async () => page.locator('#review-progress').evaluate(el => el.hidden), {
      timeout: 600_000,
      intervals: [250, 500, 1000],
    }).toBe(true);
    await expect(page.locator('#report-status')).toContainText('Revisão concluída · profundidade 14');

    const metrics = await page.evaluate(start => ({
      elapsedMs: Math.round(performance.now() - start),
      searches: window.__mobileReviewSearches,
      completionStatus: document.querySelector('#report-status').innerText.trim(),
    }), reviewStartedAt);

    expect(metrics.searches.length).toBeGreaterThan(0);
    for (const search of metrics.searches) {
      expect(search.requestedDepth).toBe(14);
      expect(search.requestedMultiPV).toBe(3);
      expect(search.resultDepth).toBe(14);
      expect(search.resultLineCount).toBe(3);
    }

    return {
      logicalProcessors,
      requestedDepth: 14,
      multiPV: 3,
      positions: fixture.plies + 1,
      elapsedMs: metrics.elapsedMs,
      seconds: Number((metrics.elapsedMs / 1000).toFixed(2)),
      enginesUsed: new Set(metrics.searches.map(search => search.workerId)).size,
      completedSearches: metrics.searches.length,
      completionStatus: metrics.completionStatus,
    };
  } finally {
    await context.close();
  }
}

test('benchmark full-depth mobile review with one versus two Lite workers', async ({ browser }) => {
  test.setTimeout(1_350_000);
  const fixture = createDeterministicGame(8);
  const singleWorker = await measureFullReview(browser, fixture, 4);
  const dualWorker = await measureFullReview(browser, fixture, 8);

  expect(singleWorker.enginesUsed).toBe(1);
  expect(dualWorker.enginesUsed).toBe(2);
  expect(dualWorker.completedSearches).toBe(singleWorker.completedSearches);

  const report = {
    generatedAt: new Date().toISOString(),
    environment: { ...ENVIRONMENT, fixturePlies: fixture.plies },
    singleWorker,
    dualWorker,
    speedup: Number((singleWorker.elapsedMs / dualWorker.elapsedMs).toFixed(2)),
    timeSavedPercent: Number((100 * (1 - dualWorker.elapsedMs / singleWorker.elapsedMs)).toFixed(1)),
  };
  await mkdir('artifacts', { recursive: true });
  await writeFile(REPORT, JSON.stringify(report, null, 2));
  console.log('MOBILE_FULL_DEPTH_REVIEW_BENCHMARK ' + JSON.stringify(report));
});