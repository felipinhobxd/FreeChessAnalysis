// Categories intentionally shown as markers on the game evaluation graph.
// Keep ordinary classifications (best, excellent and good) out of the marker layer.
export const REVIEW_CHART_MARKERS = new Set([
  'brilliant',
  'great',
  'inaccuracy',
  'mistake',
  'chance-lost',
  'blunder',
  'theory',
]);

export function chartMarkerPoints(points) {
  return points.filter(point =>
    point?.node?.move && REVIEW_CHART_MARKERS.has(point.node.classification)
  );
}

// A selected side-line position has no x-coordinate on the main graph.
// Highlight its nearest ancestor that does belong to the displayed path.
export function chartSelectionFor(cursor, nodes) {
  const included = new Set(nodes);
  for (let node = cursor; node; node = node.parent) {
    if (included.has(node)) return node;
  }
  return nodes[0] ?? null;
}
