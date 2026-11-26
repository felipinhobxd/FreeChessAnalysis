import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyByLoss, LOSS_THRESHOLDS } from '../dist/move-classification.js';

test('classification thresholds have explicit boundaries and stable categories', () => {
  const cases = [
    [0, 'excellent'], [1, 'excellent'], [2, 'excellent'],
    [2.01, 'good'], [5, 'good'], [5.01, 'inaccuracy'],
    [10, 'inaccuracy'], [10.01, 'mistake'], [20, 'mistake'],
    [20.01, 'blunder'], [45, 'blunder'],
  ];
  for (const [loss, expected] of cases) {
    assert.equal(classifyByLoss({ loss }), expected, 'loss='+loss);
  }
  assert.equal(classifyByLoss({ loss: 50, exactBest: true }), 'best');
  assert.equal(classifyByLoss({ loss: 30, accepted: true }), 'excellent');
  assert.deepEqual(LOSS_THRESHOLDS, { accepted: 1, excellent: 2, good: 5, inaccuracy: 10, mistake: 20 });
});

test('classification rejects invalid loss data rather than silently mislabeling', () => {
  for (const loss of [NaN, Infinity, -1, undefined]) assert.throws(() => classifyByLoss({ loss }), TypeError);
});
