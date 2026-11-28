import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';

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
  return chess.pgn();
}

async function installMockEngine(page) {
  await page.evaluate(async () => {
    const { Engine } = await import('/engine.js');
    const metrics = window.__mobileReviewMetrics = {
      nextEngineId: 0,
      engineIds: [],
      searches: [],
      firstSearchStartedAt: null,
      secondWorkerReadyAt: null,
    };

    Engine.prototype.start = async function() {
      if (!this.__mobileReviewTestId) {
        this.__mobileReviewTestId = ++metrics.nextEngineId;
        metrics.engineIds.push(this.__mobileReviewTestId);
      }
      if (this.__mobileReviewTestId === 2) {
        await new Promise(resolve => setTimeout(resolve, 100));
        metrics.secondWorkerReadyAt = performance.now();
      }
      return {
        name: 'Lite',
        mode: 'lite',
        version: '19.0.1',
        file: 'stockfish-19-lite-single',
        hash: 24,
        threads: 1,
        identity: 'Stockfish 19 test double',
        native: false,
      };
    };

    Engine.prototype.search = async function(rootFen, moves, depth, multiPV, { signal } = {}) {
      signal?.throwIfAborted();
      if (metrics.firstSearchStartedAt === null) {
        metrics.firstSearchStartedAt = performance.now();
      }
      // Uneven delays make the integration exercise the shared pull queue,
      // not just two workers receiving identical, fixed-size slices.
      const delay = moves.length % 3 === 0 ? 24 : 8;
      await new Promise(resolve => setTimeout(resolve, delay));
      signal?.throwIfAborted();
      metrics.searches.push({
        workerId: this.__mobileReviewTestId,
        requestedDepth: depth,
        requestedMultiPV: multiPV,
        rootFen,
        moveCount: moves.length,
      });
      return {
        best: null,
        lines: Array.from({ length: multiPV }, (_, index) => ({
          depth,
          type: 'cp',
          value: (1 - index) * 12,
          pv: [],
        })),
      };
    };
  });
}

test('mobile Lite review uses two workers without changing depth or MultiPV', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 8 });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 4 });
  });

  try {
    await page.goto('/analysis');
    await page.locator('#language-select').selectOption('en');
    await page.locator('#community-consent-decline').click();
    await installMockEngine(page);
    await page.locator('#language-enter').click();
    await expect(page.locator('#board .square')).toHaveCount(64);
    await page.locator('#tab-lines').click();
    await page.locator('#engine-toggle').click();
    await page.locator('#tab-import').click();

    await page.evaluate(() => {
      window.__mobileReviewMetrics.searches.length = 0;
      window.__mobileReviewMetrics.firstSearchStartedAt = null;
      window.__mobileReviewMetrics.secondWorkerReadyAt = null;
    });
    const pgn = createDeterministicGame(12);
    await page.locator('#game-input').fill(pgn);
    await page.locator('#submit').click();
    await expect(page.locator('#move-list button')).toHaveCount(12);
    // Importing a game starts its first full review automatically unless a
    // saved review exists. Do not click #review-btn, which would stop it.
    await expect(page.locator('#report-status')).toContainText(
      'Review complete · depth 14',
      { timeout: 20_000 },
    );

    const metrics = await page.evaluate(() => ({
      engineIds: window.__mobileReviewMetrics.engineIds,
      searches: window.__mobileReviewMetrics.searches,
      firstSearchStartedAt: window.__mobileReviewMetrics.firstSearchStartedAt,
      secondWorkerReadyAt: window.__mobileReviewMetrics.secondWorkerReadyAt,
    }));
    const workersUsed = new Set(metrics.searches.map(search => search.workerId));

    expect(metrics.engineIds).toHaveLength(2);
    expect(workersUsed.size).toBe(2);
    expect(metrics.searches.length).toBeGreaterThan(1);
    expect(metrics.firstSearchStartedAt).not.toBeNull();
    expect(metrics.secondWorkerReadyAt).not.toBeNull();
    expect(metrics.firstSearchStartedAt).toBeLessThan(metrics.secondWorkerReadyAt);
    for (const search of metrics.searches) {
      expect(search.requestedDepth).toBe(14);
      expect(search.requestedMultiPV).toBe(3);
    }
  } finally {
    await context.close();
  }
});
