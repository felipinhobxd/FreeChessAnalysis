import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { reviewLinesFor, liveLinesFor, reviewDataFromLive } from '../dist/analysis-reuse.js';

const cache = 'stockfish/19.0.1/stockfish-19-lite-single/24/1';
const line = depth => ({ depth, type: 'cp', value: 30, pv: ['e2e4'] });
const threeLines = () => [line(14), line(14), line(14)];
const reviewData = () => ({ cache, depth: 14, result: { best: 'e2e4', lines: threeLines() } });

test('live analysis reuses a stored review result at the same depth, build and line count', () => {
  const stored = reviewData();
  assert.deepEqual(liveLinesFor(stored, cache, 14, 3), stored.result.lines);
});

test('live analysis serves only the requested leading lines of a stored result', () => {
  const stored = reviewData();
  const served = liveLinesFor(stored, cache, 14, 2);
  assert.equal(served.length, 2);
  assert.equal(served[0], stored.result.lines[0]);
  assert.equal(served[1], stored.result.lines[1]);
});

test('live analysis refuses stored results from another depth, build or with too few lines', () => {
  const stored = reviewData();
  assert.equal(liveLinesFor(stored, cache, 18, 3), null);            // different depth
  assert.equal(liveLinesFor(stored, 'stockfish/19.0.0/other/64/4', 14, 3), null); // different build
  assert.equal(liveLinesFor(stored, cache, 14, 4), null);           // not enough lines
  assert.equal(liveLinesFor(null, cache, 14, 3), null);             // nothing stored
  assert.equal(liveLinesFor({ cache, depth: 14 }, cache, 14, 1), null); // missing result
});

test('review consumption keeps stored results capped at the review line count', () => {
  const stored = reviewData();
  assert.deepEqual(reviewLinesFor(stored, cache, 14, 3), stored.result.lines);
  const five = { ...stored, result: { best: 'e2e4', lines: [line(14), line(14), line(14), line(14), line(14)] } };
  const capped = reviewLinesFor(five, cache, 14, 3);
  assert.equal(capped.length, 3);
  assert.equal(capped[0], five.result.lines[0]);
  assert.equal(capped[2], five.result.lines[2]);
});

test('review consumption refuses stored results from another depth or build', () => {
  const stored = reviewData();
  assert.equal(reviewLinesFor(stored, cache, 18, 3), null);
  assert.equal(reviewLinesFor(stored, 'other', 14, 3), null);
  assert.equal(reviewLinesFor(undefined, cache, 14, 3), null);
  assert.equal(reviewLinesFor({ cache, depth: 14, result: {} }, cache, 14, 3), null);
});

test('live results with at least three lines seed the review cache', () => {
  const lines = threeLines();
  assert.deepEqual(reviewDataFromLive(cache, 14, 'e2e4', lines), {
    cache,
    depth: 14,
    result: { best: 'e2e4', lines },
  });
});

test('live results with fewer than three lines never seed the review cache', () => {
  assert.equal(reviewDataFromLive(cache, 14, 'e2e4', [line(14)]), null);
  assert.equal(reviewDataFromLive(cache, 14, 'e2e4', []), null);
  assert.equal(reviewDataFromLive(cache, 14, 'e2e4', null), null);
});

test('the app wires cross-reuse into live analysis, review and exploration', async () => {
  const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.match(app, /liveLinesFor\(position\.reviewData, cache, depth, count\)/);
  assert.match(app, /if \(seeded && !position\.reviewData\) position\.reviewData = seeded;/);
  // Seeding exists exactly once and is always guarded: a live result never
  // replaces a stored review result from a previous full review.
  assert.equal((app.match(/position\.reviewData = seeded/g) || []).length, 1);
  assert.match(app, /reviewLinesFor\(node\.reviewData, cache, depth, 3\)/);
  assert.match(app, /reviewLinesFor\(position\.reviewData, cache, depth, 3\)/);
});
