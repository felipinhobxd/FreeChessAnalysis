import { winPercent } from './review-classification.js';

export const MOBILE_REVIEW_SCAN_DEPTH = 12;

export function isMobileReviewDevice(environment = globalThis) {
  const navigator = environment?.navigator || {};
  const userAgent = String(navigator.userAgent || '');
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;

  const width = Number(environment?.innerWidth ?? environment?.screen?.width);
  const narrow = !Number.isFinite(width) || width <= 900;
  const touch = Number(navigator.maxTouchPoints) > 0;
  let coarsePointer = false;
  try {
    coarsePointer = environment?.matchMedia?.('(pointer: coarse)')?.matches === true;
  } catch {
    // A missing or restricted matchMedia implementation is not fatal.
  }
  return narrow && (touch || coarsePointer);
}

export function mobileReviewScanDepth(requestedDepth) {
  const depth = Number(requestedDepth);
  const normalized = Number.isFinite(depth) ? Math.max(1, Math.floor(depth)) : 14;
  return Math.min(normalized, MOBILE_REVIEW_SCAN_DEPTH);
}

export function shouldRefineMobileReview({
  before,
  after,
  move,
  bestMove,
  classification,
  forced = false,
  chanceLost = false,
} = {}) {
  if (forced || !move || !before || !after) return false;

  if (chanceLost || ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder'].includes(classification)) {
    return true;
  }

  const actual = String(move.from || '') + String(move.to || '') + String(move.promotion || '');
  const exactBest = Boolean(bestMove) && actual === bestMove;
  if (exactBest) return false;

  if (before.type === 'mate' || after.type === 'mate') return true;

  const sign = move.color === 'b' ? -1 : 1;
  const beforeChance = sign > 0 ? winPercent(before) : 100 - winPercent(before);
  const afterChance = sign > 0 ? winPercent(after) : 100 - winPercent(after);
  const loss = Math.max(0, beforeChance - afterChance);
  if (loss >= 2) return true;

  const tactical = Boolean(move.captured || move.promotion || /[+#]/.test(move.san || ''));
  return tactical;
}
