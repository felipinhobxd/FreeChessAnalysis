// Share completed evaluations between live analysis and full-game review.
//
// Reuse is intentionally strict: Stockfish's MultiPV setting changes search
// behavior, so the first three lines of a 5-line search are not assumed to be
// equivalent to a dedicated 3-line search. A result is reusable only when the
// engine build, depth and exact MultiPV count match.
export function reviewLinesFor(reviewData, cache, depth, multiPV = 3) {
  const lines = reviewData?.result?.lines;
  if (!reviewData || reviewData.cache !== cache || reviewData.depth !== depth) return null;
  if (reviewData.multiPV !== multiPV || multiPV !== 3) return null;
  if (!Array.isArray(lines) || lines.length !== multiPV) return null;
  return lines;
}

export function liveLinesFor(reviewData, cache, depth, count) {
  const lines = reviewData?.result?.lines;
  if (!reviewData || reviewData.cache !== cache || reviewData.depth !== depth) return null;
  if (reviewData.multiPV !== count || !Number.isInteger(count) || count < 1) return null;
  if (!Array.isArray(lines) || lines.length !== count) return null;
  return lines;
}

// Live analysis may seed the review cache only when it performed the exact
// three-line search that a full review would request.
export function reviewDataFromLive(cache, depth, best, lines, multiPV) {
  if (multiPV !== 3 || !Array.isArray(lines) || lines.length !== 3) return null;
  return { cache, depth, multiPV: 3, result: { best, lines } };
}
