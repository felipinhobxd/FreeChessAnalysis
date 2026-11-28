import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMobileReviewDevice,
  mobileReviewWorkerCount,
} from '../dist/mobile-review.js';

const environment = ({
  userAgent = 'Desktop browser',
  width = 390,
  touch = 0,
  coarse = false,
  cores = 8,
  memory = 4,
} = {}) => {
  const navigator = {
    userAgent,
    maxTouchPoints: touch,
    hardwareConcurrency: cores,
  };
  if (memory !== undefined) navigator.deviceMemory = memory;

  return {
    navigator,
    innerWidth: width,
    matchMedia: query => ({ matches: query === '(pointer: coarse)' && coarse }),
  };
};

test('mobile detection recognizes Android, iPhone, iPad and narrow touch browsers', () => {
  assert.equal(isMobileReviewDevice(environment({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' })), true);
  assert.equal(isMobileReviewDevice(environment({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })), true);
  assert.equal(isMobileReviewDevice(environment({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0)', width: 1024 })), true);
  assert.equal(isMobileReviewDevice(environment({ width: 800, touch: 5 })), true);
  assert.equal(isMobileReviewDevice(environment({ width: 390, coarse: true })), true);
});

test('desktop devices always keep the single-worker review path', () => {
  assert.equal(isMobileReviewDevice(environment({ width: 1280 })), false);
  assert.equal(mobileReviewWorkerCount(environment({ width: 1280, cores: 16, memory: 16 })), 1);
});

test('two Lite workers are enabled only when mobile CPU and memory headroom are sufficient', () => {
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'Android', cores: 8, memory: 4 })), 2);
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'Android', cores: 12, memory: 8 })), 2);
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'Android', cores: 6, memory: 4 })), 2);
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'Android', cores: 8, memory: 2 })), 1);
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'Android', cores: 5, memory: 8 })), 1);
});

test('missing deviceMemory does not unnecessarily disable capable mobile browsers', () => {
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'Android', cores: 8, memory: undefined })), 2);
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'iPhone', cores: 6, memory: undefined })), 2);
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'iPad', cores: 8, memory: undefined })), 2);
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'Android', cores: 6, memory: undefined })), 1);
});

test('a known low-memory estimate remains a hard stop even on fast phones', () => {
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'iPhone', cores: 8, memory: 2 })), 1);
  assert.equal(mobileReviewWorkerCount(environment({ userAgent: 'Android', cores: 12, memory: 3 })), 1);
});

test('the full review keeps the requested depth and MultiPV 3 on every worker', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
  assert.match(app, /mobileReviewWorkerCount\(\)/);
  assert.match(app, /worker\.search\([\s\S]{0,220}depth,\s*3,/);
  assert.match(app, /node\.reviewData = \{ depth, cache, multiPV: 3, result \}/);
  assert.match(app, /studyAnalysis = \{ version: cacheVersion, depth,/);
  assert.match(app, /Revisão concluída · profundidade/);
  assert.doesNotMatch(app, /mobileReviewScanDepth|shouldRefineMobileReview|activeScanDepth/);
});
