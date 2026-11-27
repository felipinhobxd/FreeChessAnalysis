import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reviewLinesFor, liveLinesFor, reviewDataFromLive } from '../dist/analysis-reuse.js';

const cache = 'stockfish/19.0.1/stockfish-19-lite-single/24/1';
const lines = count => Array.from({ length: count }, (_, index) => ({
  depth: 14,
  type: 'cp',
  value: 30 - index,
  pv: ['e2e4'],
}));

const stored = (multiPV = 3, count = multiPV) => ({
  cache,
  depth: 14,
  multiPV,
  result: { best: 'e2e4', lines: lines(count) },
});

test('review reuses only a complete three-line MultiPV 3 result', () => {
  const data = stored(3, 3);
  assert.deepEqual(reviewLinesFor(data, cache, 14, 3), data.result.lines);
  assert.equal(reviewLinesFor(stored(1, 1), cache, 14, 3), null);
  assert.equal(reviewLinesFor(stored(2, 2), cache, 14, 3), null);
  assert.equal(reviewLinesFor(stored(4, 4), cache, 14, 3), null);
  assert.equal(reviewLinesFor(stored(3, 2), cache, 14, 3), null);
});

test('live analysis reuses only the exact same MultiPV count', () => {
  const data = stored(3, 3);
  assert.deepEqual(liveLinesFor(data, cache, 14, 3), data.result.lines);
  assert.equal(liveLinesFor(data, cache, 14, 2), null);
  assert.equal(liveLinesFor(data, cache, 14, 4), null);
  assert.deepEqual(liveLinesFor(stored(2, 2), cache, 14, 2), stored(2, 2).result.lines);
  assert.equal(liveLinesFor(stored(4, 3), cache, 14, 4), null);
});

test('cached evaluations from a different engine build or depth are never reused', () => {
  const data = stored();
  assert.equal(reviewLinesFor(data, cache, 18, 3), null);
  assert.equal(reviewLinesFor(data, 'other-build', 14, 3), null);
  assert.equal(liveLinesFor(data, cache, 18, 3), null);
  assert.equal(liveLinesFor(data, 'other-build', 14, 3), null);
  assert.equal(reviewLinesFor(null, cache, 14, 3), null);
  assert.equal(liveLinesFor({ cache, depth: 14 }, cache, 14, 3), null);
});

test('only a complete live MultiPV 3 result can seed the review cache', () => {
  const three = lines(3);
  assert.deepEqual(reviewDataFromLive(cache, 14, 'e2e4', three, 3), {
    cache,
    depth: 14,
    multiPV: 3,
    result: { best: 'e2e4', lines: three },
  });
  assert.equal(reviewDataFromLive(cache, 14, 'e2e4', lines(2), 3), null);
  assert.equal(reviewDataFromLive(cache, 14, 'e2e4', lines(4), 4), null);
  assert.equal(reviewDataFromLive(cache, 14, 'e2e4', lines(2), 2), null);
  assert.equal(reviewDataFromLive(cache, 14, 'e2e4', null, 3), null);
});

test('live analysis and full review actually share only validated results', async () => {
  const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.match(app, /import \{ liveLinesFor, reviewLinesFor, reviewDataFromLive \} from '\.\/analysis-reuse\.js'/);
  assert.match(app, /liveLinesFor\(position\.reviewData, cache, depth, count\)/);
  assert.match(app, /reviewLinesFor\(node\.reviewData, cache, depth, 3\)/);
  assert.match(app, /reviewLinesFor\(position\.reviewData, cache, depth, 3\)/);
  assert.match(app, /reviewDataFromLive\(cache, depth, result\.best, position\.lines, count\)/);
  assert.match(app, /result\.lines\.length === count/);
  assert.match(app, /position\.reviewData = seeded/);
  assert.match(app, /multiPV:3/);
});
