import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REVIEW_CHART_MARKERS, chartMarkerPoints, chartSelectionFor } from '../dist/review-chart.js';

test('the graph only marks requested notable move categories, including theory', () => {
  assert.deepEqual([...REVIEW_CHART_MARKERS], [
    'brilliant', 'great', 'inaccuracy', 'mistake', 'chance-lost', 'blunder', 'theory',
  ]);
  const points = [
    ...['brilliant', 'great', 'inaccuracy', 'mistake', 'chance-lost', 'blunder', 'theory',
      'best', 'excellent', 'good', null].map((classification, index) => ({
        node: { id: index, move: { san: 'e4' }, classification }, x: index, y: index,
      })),
    { node: { id: 99, classification: 'brilliant' }, x: 99, y: 99 },
  ];
  assert.deepEqual(
    chartMarkerPoints(points).map(point => point.node.classification),
    [...REVIEW_CHART_MARKERS],
  );
});

test('graph selection follows a side variation to its nearest main-line ancestor', () => {
  const root = { id: 0, parent: null };
  const first = { id: 1, parent: root };
  const second = { id: 2, parent: first };
  const sideLine = { id: 3, parent: first };
  const deeperSideLine = { id: 4, parent: sideLine };
  const path = [root, first, second];

  assert.equal(chartSelectionFor(deeperSideLine, path), first);
  assert.equal(chartSelectionFor(second, path), second);
  assert.equal(chartSelectionFor(null, path), root);
  assert.equal(chartSelectionFor(deeperSideLine, []), null);
});
