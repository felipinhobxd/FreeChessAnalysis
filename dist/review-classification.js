import { classifyByLoss } from './move-classification.js';

export function winPercent(score) {
  if (!score) return 50;
  if (score.type === 'mate') return score.white > 0 ? 100 : 0;
  const white = Number(score.white);
  if (!Number.isFinite(white)) return 50;
  return 100 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, white))));
}

export function multiPvMargin(lines, side) {
  const best = lines?.[0];
  const second = lines?.[1];
  if (!best || !second || !Number.isFinite(best.depth) ||
      best.depth !== second.depth) return 0;
  const sign = side === 'w' ? 1 : -1;
  return sign * (winPercent(best) - winPercent(second));
}

export function classifyReviewMove({
  side,
  before,
  after,
  actual,
  bestMove,
  accepted = false,
  chanceLost = false,
  opening = false,
  alternatives = [],
  commitment = false,
}) {
  const sign = side === 'w' ? 1 : -1;
  const loss = Math.max(0, sign * (winPercent(before) - winPercent(after)));
  if (chanceLost) return 'chance-lost';
  if (opening) return 'theory';

  const margin = multiPvMargin(alternatives, side);
  const beforeChance = side === 'w' ? winPercent(before) : 100 - winPercent(before);
  if (accepted && margin >= 12 && commitment &&
      beforeChance > 18 && beforeChance < 82) return 'brilliant';
  if (accepted && margin >= 14 &&
      beforeChance > 15 && beforeChance < 85) return 'great';

  return classifyByLoss({ loss, exactBest: actual === bestMove, accepted });
}
