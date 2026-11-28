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
  return '[Event "Mobile review worker smoke test"]\n[Result "*"]\n\n' + chess.pgn() + ' *';
}

async function installMockEngine(page) {
  await page.evaluate(async () => {
    const { Engine } = await import('/engine.js');
    const metrics = window.__mobileReviewMetrics = {
      nextEngineId: 0,
      engineIds: [],
      searches: [],
    };

    Engine.prototype.start = async function() {
      if (!this.__mobileReviewTestId) {
        this.__mobileReviewTestId = ++metrics.nextEngineId;
        metrics.engineIds.push(this.__mobileReviewTestId);
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

    await page.locator('#game-input').fill(createDeterministicGame(12));
    await page.locator('#submit').click();
    await expect(page.locator('#move-list')).not.toBeEmpty();
    await page.locator('#tab-report').click();

    await page.evaluate(() => { window.__mobileReviewMetrics.searches.length = 0; });
    await page.locator('#review-btn').click();
    await expect(page.locator('#report-status')).toContainText(
      'Revisão concluída · profundidade 14',
      { timeout: 20_000 },
    );

    const metrics = await page.evaluate(() => ({
      engineIds: window.__mobileReviewMetrics.engineIds,
      searches: window.__mobileReviewMetrics.searches,
    }));
    const workersUsed = new Set(metrics.searches.map(search => search.workerId));

    expect(metrics.engineIds).toHaveLength(2);
    expect(workersUsed.size).toBe(2);
    expect(metrics.searches.length).toBeGreaterThan(1);
    for (const search of metrics.searches) {
      expect(search.requestedDepth).toBe(14);
      expect(search.requestedMultiPV).toBe(3);
    }
  } finally {
    await context.close();
  }
});
