import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Chess } from 'chess.js';
import { test, expect } from '@playwright/test';

test.describe.configure({ retries: 0 });
import { fileURLToPath } from 'node:url';

function createDeterministicGame(plies = 12) {
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
    pgn: '[Event "Mobile review performance fixture"]\n[Result "*"]\n\n' + chess.pgn() + ' *',
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
}

const REPORT = 'artifacts/mobile-review-benchmark.json';
const ENVIRONMENT = {
  browser: 'Chromium via Playwright',
  viewport: '390x844',
  touch: true,
  cpuThrottle: '4x',
  engine: 'Stockfish 19 Lite single-thread WASM',
};

test('benchmark Stockfish Lite depth and MultiPV combinations on mobile CPU limits', async ({ browser }) => {
  test.setTimeout(240_000);
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

  const fixture = createDeterministicGame(12);
  const replay = new Chess();
  const positions = [replay.fen()];
  replay.loadPgn(fixture.pgn);
  const history = replay.history({ verbose: true });
  const sampleBoard = new Chess();
  for (const [index, move] of history.entries()) {
    sampleBoard.move({ from: move.from, to: move.to, promotion: move.promotion });
    if (index === 5 || index === history.length - 1) positions.push(sampleBoard.fen());
  }

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
      const engine = new Engine('lite');
      const reports = [];
      const initializationStart = performance.now();
      try {
        const profile = await engine.start();
        const initializationMs = Math.round(performance.now() - initializationStart);
        for (const config of configs) {
          const samples = [];
          for (const fen of positions) {
            const start = performance.now();
            const result = await engine.search(fen, [], config.depth, config.lines);
            samples.push({
              elapsedMs: performance.now() - start,
              depth: Math.max(0, ...result.lines.map(line => Number(line.depth) || 0)),
            });
          }
          const sorted = samples.map(sample => sample.elapsedMs).sort((a, b) => a - b);
          const total = samples.reduce((sum, sample) => sum + sample.elapsedMs, 0);
          reports.push({
            id: config.id,
            depth: config.depth,
            multiPV: config.lines,
            ...{
              searches: samples.length,
              totalMs: Math.round(total),
              meanMs: Math.round(total / Math.max(1, samples.length)),
              medianMs: Math.round(sorted[Math.floor(sorted.length / 2)] || 0),
              p95Ms: Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] || 0),
              averageDepth: Number((samples.reduce((sum, sample) => sum + sample.depth, 0) / Math.max(1, samples.length)).toFixed(1)),
            },
          });
        }
        return { engine: profile.identity, threads: profile.threads, initializationMs, configurations: reports };
      } finally {
        engine.dispose();
      }
    }, { positions, configs: configurations });

    await mkdir('artifacts', { recursive: true });
    const report = {
      generatedAt: new Date().toISOString(),
      environment: { ...ENVIRONMENT, fixturePlies: fixture.plies, sampledPositions: positions.length },
      engineRuns,
      fullReview: null,
    };
    await writeFile(REPORT, JSON.stringify(report, null, 2));
    console.log('MOBILE_ENGINE_BENCHMARK ' + JSON.stringify(engineRuns));
  } finally {
    await context.close();
  }
});

async function measureFullReview(browser, fixture, mobile) {
  const context = await browser.newContext(mobile ? {
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  } : {
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await serveBundledLite(page);

  try {
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
    await expect(page.locator('#report-status')).toContainText(/Revisão concluída/);

    const elapsedMs = Math.round(await page.evaluate(start => performance.now() - start, reviewStartedAt));
    const status = (await page.locator('#report-status').innerText()).trim();
    if (mobile) {
      await expect(page.locator('#report-status')).toContainText('varredura 12');
      await expect(page.locator('#report-status')).toContainText('até 14');
    } else {
      await expect(page.locator('#report-status')).toContainText('profundidade 14');
    }
    return {
      mode: mobile ? 'mobile-adaptive' : 'desktop-baseline',
      plies: fixture.plies,
      positions: fixture.plies + 1,
      elapsedMs,
      seconds: Number((elapsedMs / 1000).toFixed(2)),
      millisecondsPerPosition: Math.round(elapsedMs / (fixture.plies + 1)),
      completionStatus: status,
    };
  } finally {
    await context.close();
  }
}

test('compare full review baseline against adaptive mobile Lite review', async ({ browser }) => {
  test.setTimeout(660_000);
  const fixture = createDeterministicGame(12);

  const baseline = await measureFullReview(browser, fixture, false);
  const mobileAdaptive = await measureFullReview(browser, fixture, true);
  const speedup = Number((baseline.elapsedMs / mobileAdaptive.elapsedMs).toFixed(2));
  const timeSavedPercent = Number((100 * (1 - mobileAdaptive.elapsedMs / baseline.elapsedMs)).toFixed(1));

  const report = JSON.parse(await readFile(REPORT, 'utf8'));
  report.fullReview = {
    baseline,
    mobileAdaptive,
    speedup,
    timeSavedPercent,
  };
  report.generatedAt = new Date().toISOString();
  await writeFile(REPORT, JSON.stringify(report, null, 2));
  console.log('MOBILE_REVIEW_AB_BENCHMARK ' + JSON.stringify(report));
  expect(mobileAdaptive.elapsedMs).toBeLessThan(baseline.elapsedMs);
});
