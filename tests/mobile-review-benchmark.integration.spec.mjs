import { mkdir, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

function createDeterministicGame(plies = 18) {
  const chess = new Chess();
  let seed = 0x19a2026;
  const positions = [chess.fen()];

  for (let ply = 0; ply < plies; ply++) {
    const legal = chess.moves({ verbose: true });
    if (!legal.length) break;
    // Keep the fixture going instead of choosing a move that ends the game.
    const candidates = legal.filter(move => !move.san.endsWith('#'));
    const pool = candidates.length ? candidates : legal;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const selected = pool[seed % pool.length];
    chess.move({ from: selected.from, to: selected.to, promotion: selected.promotion });
    if ((ply + 1) % 9 === 0) positions.push(chess.fen());
  }

  return {
    pgn: '[Event "Mobile review performance fixture"]\n[Result "*"]\n\n' + chess.pgn() + ' *',
    plies: chess.history().length,
    positions,
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
}

test('benchmark real Stockfish Lite game review on a throttled mobile browser', async ({ browser }) => {
  test.setTimeout(360_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await serveBundledLite(page);

  const fixture = createDeterministicGame(18);
  const configurations = [
    { id: 'baseline-depth14-multipv3', depth: 14, lines: 3 },
    { id: 'depth14-multipv1', depth: 14, lines: 1 },
    { id: 'depth12-multipv1', depth: 12, lines: 1 },
    { id: 'depth12-multipv3', depth: 12, lines: 3 },
    { id: 'depth10-multipv1', depth: 10, lines: 1 },
  ];

  try {
    await page.goto('/analysis');
    const engineRuns = await page.evaluate(async ({ positions, configs }) => {
      const { Engine } = await import('/engine.js');
      const summarizeSamples = samples => {
        const sorted = samples.map(sample => sample.elapsedMs).sort((a, b) => a - b);
        const sum = samples.reduce((total, sample) => total + sample.elapsedMs, 0);
        return {
          searches: samples.length,
          totalMs: Math.round(sum),
          meanMs: Math.round(sum / Math.max(1, samples.length)),
          medianMs: Math.round(sorted[Math.floor(sorted.length / 2)] || 0),
          p95Ms: Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] || 0),
          averageDepth: Number((samples.reduce((total, sample) => total + sample.depth, 0) / Math.max(1, samples.length)).toFixed(1)),
        };
      };
      const reports = [];
      for (const config of configs) {
        const engine = new Engine('lite');
        const initStart = performance.now();
        try {
          const profile = await engine.start();
          const initializationMs = performance.now() - initStart;
          const samples = [];
          for (const fen of positions) {
            const start = performance.now();
            const result = await engine.search(fen, [], config.depth, config.lines);
            samples.push({
              elapsedMs: performance.now() - start,
              depth: Math.max(0, ...result.lines.map(line => Number(line.depth) || 0)),
              pvCount: result.lines.length,
            });
          }
          reports.push({
            id: config.id,
            depth: config.depth,
            multiPV: config.lines,
            engine: profile.identity,
            threads: profile.threads,
            initializationMs: Math.round(initializationMs),
            ...summarizeSamples(samples),
          });
        } finally {
          engine.dispose();
        }
      }
      return reports;
    }, { positions: fixture.positions, configs: configurations });

    await unlockApp(page);
    await page.locator('#game-input').fill(fixture.pgn);
    await page.locator('#submit').click();
    await expect(page.locator('#board .square')).toHaveCount(64);
    await page.locator('#tab-report').click();

    const reviewStartedAt = await page.evaluate(() => performance.now());
    await page.locator('#review-btn').click();
    await expect(page.locator('#review-progress')).toBeVisible();
    await expect.poll(async () => page.locator('#review-progress').evaluate(el => el.hidden), {
      timeout: 300_000,
      intervals: [250, 500, 1000],
    }).toBe(true);
    await expect(page.locator('#report-status')).toContainText(/Review complete|Revisão concluída/);
    const fullReviewMs = await page.evaluate(start => performance.now() - start, reviewStartedAt);

    const report = {
      generatedAt: new Date().toISOString(),
      environment: {
        browser: 'Chromium via Playwright',
        viewport: '390x844',
        touch: true,
        cpuThrottle: '4x',
        engine: 'Stockfish 19 Lite single-thread WASM',
        fixturePlies: fixture.plies,
        sampledPositions: fixture.positions.length,
      },
      engineRuns,
      fullReview: {
        plies: fixture.plies,
        positions: fixture.plies + 1,
        elapsedMs: Math.round(fullReviewMs),
        seconds: Number((fullReviewMs / 1000).toFixed(2)),
        millisecondsPerPosition: Math.round(fullReviewMs / (fixture.plies + 1)),
      },
    };
    await mkdir('artifacts', { recursive: true });
    await writeFile('artifacts/mobile-review-benchmark.json', JSON.stringify(report, null, 2));
    console.log('MOBILE_REVIEW_BENCHMARK ' + JSON.stringify(report));
  } finally {
    await context.close();
  }
});
