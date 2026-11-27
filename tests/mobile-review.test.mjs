import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isMobileReviewDevice,
  MOBILE_REVIEW_SCAN_DEPTH,
  mobileReviewScanDepth,
  shouldRefineMobileReview,
} from '../dist/mobile-review.js';

const environment = ({ userAgent = 'Desktop browser', width = 390, touch = 0, coarse = false } = {}) => ({
  navigator: { userAgent, maxTouchPoints: touch },
  innerWidth: width,
  matchMedia: query => ({ matches: query === '(pointer: coarse)' && coarse }),
});

const score = (white, type = 'cp') => ({ white, type, value: white, depth: 12 });
const move = ({ san = 'e4', captured, promotion, color = 'w' } = {}) => ({
  from: 'e2', to: 'e4', color, san, captured, promotion,
});

test('mobile detection recognizes Android, iPhone, iPad and narrow touch browsers', () => {
  assert.equal(isMobileReviewDevice(environment({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' })), true);
  assert.equal(isMobileReviewDevice(environment({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })), true);
  assert.equal(isMobileReviewDevice(environment({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0)' , width: 1024 })), true);
  assert.equal(isMobileReviewDevice(environment({ width: 800, touch: 5 })), true);
  assert.equal(isMobileReviewDevice(environment({ width: 390, coarse: true })), true);
});

test('mobile detection does not classify ordinary desktop pointers as mobile', () => {
  assert.equal(isMobileReviewDevice(environment({ width: 1280 })), false);
  assert.equal(isMobileReviewDevice(environment({ width: 1280, touch: 1 })), false);
});

test('mobile scan depth preserves lower user choices and caps only expensive depths', () => {
  assert.equal(MOBILE_REVIEW_SCAN_DEPTH, 12);
  assert.equal(mobileReviewScanDepth(8), 8);
  assert.equal(mobileReviewScanDepth(10), 10);
  assert.equal(mobileReviewScanDepth(12), 12);
  assert.equal(mobileReviewScanDepth(14), 12);
  assert.equal(mobileReviewScanDepth(22), 12);
  assert.equal(mobileReviewScanDepth('invalid'), 12);
});

test('large losses, serious labels and missed opportunities trigger selective refinement', () => {
  assert.equal(shouldRefineMobileReview({
    before: score(0), after: score(-120), move: move(), bestMove: 'd2d4',
  }), true);
  assert.equal(shouldRefineMobileReview({
    before: score(100), after: score(95), move: move(), bestMove: 'd2d4',
    classification: 'inaccuracy',
  }), true);
  assert.equal(shouldRefineMobileReview({
    before: score(100), after: score(95), move: move(), bestMove: 'd2d4',
    chanceLost: { kind: 'faster-mate' },
  }), true);
  assert.equal(shouldRefineMobileReview({
    before: score(0), after: score(0), move: move(), bestMove: 'e2e4',
    classification: 'brilliant',
  }), true);
});

test('mate changes and forcing tactical moves are refined', () => {
  assert.equal(shouldRefineMobileReview({
    before: score(0, 'mate'), after: score(-100), move: move(), bestMove: 'd2d4',
  }), true);
  assert.equal(shouldRefineMobileReview({
    before: score(0), after: score(0), move: move({ san: 'Bxe5+', captured: 'p' }),
    bestMove: 'd2d4',
  }), true);
  assert.equal(shouldRefineMobileReview({
    before: score(0), after: score(0), move: move({ promotion: 'q', san: 'e8=Q+' }),
    bestMove: 'd2d4',
  }), true);
});

test('quiet, close alternatives do not receive unnecessary expensive refinement', () => {
  assert.equal(shouldRefineMobileReview({
    before: score(0), after: score(-10), move: move(), bestMove: 'd2d4',
    classification: 'excellent',
  }), false);
  assert.equal(shouldRefineMobileReview({
    before: score(0), after: score(-10), move: move(), bestMove: 'e2e4',
    classification: 'best',
  }), false);
});

test('forced moves do not consume a refinement search', () => {
  assert.equal(shouldRefineMobileReview({
    before: score(0), after: score(-200), move: move(), bestMove: 'd2d4',
    classification: 'blunder', forced: true,
  }), false);
});

test('the app uses a shallow mobile scan and selectively deepens critical positions', async () => {
  const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.match(app, /isMobileReviewDevice\(\)/);
  assert.match(app, /mobileReviewScanDepth\(depth\)/);
  assert.match(app, /shouldRefineMobileReview\(/);
  assert.match(app, /const scanDepth = mobileAdaptive \? mobileReviewScanDepth\(depth\) : depth/);
  assert.ok(app.includes('const hasCompleteDeepCache = path.every(node =>'));
  assert.ok(app.includes('const activeScanDepth = adaptiveReview ? scanDepth : depth;'));
  assert.match(app, /engine\.search\([\s\S]{0,180}activeScanDepth/);
  assert.match(app, /engine\.search\([\s\S]{0,180}depth,/);
  assert.match(app, /gradeMove\(path\[index\], before\.lines, before\.best, index, after\.lines\[0\]\)/);
  assert.match(app, /Revisão concluída · varredura/);
});
