// Sharing of engine results between the full-game review and the live
// position analysis. A stored reviewData result is only reusable when it was
// produced by the same engine build (identical cache key) for the same
// position at the same search depth; the requested number of lines is the
// only degree of freedom, because the first N lines of a MultiPV search at
// depth D are exactly the result an equivalent search asking for N lines
// would return. No classification formula or limit changes: consumers keep
// receiving plain node.lines arrays from the same build.

// Review consumption: accepts any stored non-empty result and caps it at the
// review line count, so classification inputs stay identical to a fresh
// three-line search even when the stored result carries extra live lines.
export function reviewLinesFor(reviewData, cache, depth, maxLines = 3) {
  const lines = reviewData?.result?.lines;
  if (!reviewData || reviewData.cache !== cache || reviewData.depth !== depth) return null;
  if (!Array.isArray(lines) || !lines.length) return null;
  return lines.length > maxLines ? lines.slice(0, maxLines) : lines;
}

// Live consumption: a stored review result can serve a live request only when
// it carries at least the requested number of lines at the same depth.
export function liveLinesFor(reviewData, cache, depth, count) {
  const lines = reviewData?.result?.lines;
  if (!reviewData || reviewData.cache !== cache || reviewData.depth !== depth) return null;
  if (!Array.isArray(lines) || lines.length < count) return null;
  return lines.slice(0, count);
}

// A finished live analysis with at least three lines can seed the review
// cache, because a review always requests exactly three lines at its own
// depth from the same build. Callers must not overwrite an existing stored
// review with a live result, so re-running the review keeps its own cache.
export function reviewDataFromLive(cache, depth, best, lines) {
  if (!Array.isArray(lines) || lines.length < 3) return null;
  return { cache, depth, result: { best, lines } };
}
