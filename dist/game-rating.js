import { chessComRatingReference } from './chesscom-rating-reference.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function winChance(score, sign) {
  const white = score.white ?? score.value;
  if (!Number.isFinite(white)) return null;
  if (score.type === 'mate') return white * sign > 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-0.00368208 * clamp(white * sign, -1500, 1500)));
}

export function ratingEvidence(decisions, sign) {
  let weightedScore = 0;
  let weightSum = 0;
  let critical = 0;
  let moves = 0;
  for (const { before, after, forced } of decisions) {
    if (forced || !before || !after) continue;
    const start = winChance(before, sign);
    const end = winChance(after, sign);
    if (start === null || end === null) continue;
    const loss = Math.max(0, start - end);
    const collapses = start >= 0.30 && end <= 0.22 && loss >= 0.24;
    const dropsWin = start >= 0.77 && end <= 0.62 && loss >= 0.23;
    const turningPoint = collapses || dropsWin;
    const weight = turningPoint ? 1 : Math.max(0.07, 1 - 2.05 * Math.abs(start - 0.5));
    const quality = clamp(103.1668 * Math.exp(-5.5 * loss) - 2.1669, 0, 100);
    if (turningPoint) critical++;
    weightedScore += quality * weight;
    weightSum += weight;
    moves++;
  }
  if (moves < 10 || weightSum < 3) return null;
  return { quality: weightedScore / weightSum, weightSum, critical, moves };
}

function interpolate(bands, anchor, column) {
  const first = bands[0];
  if (anchor <= first[0]) return first[column];
  for (let index = 1; index < bands.length; index++) {
    const [upper, lower] = [bands[index], bands[index - 1]];
    if (anchor <= upper[0]) {
      const fraction = (anchor - lower[0]) / (upper[0] - lower[0]);
      return lower[column] + (upper[column] - lower[column]) * fraction;
    }
  }
  return bands.at(-1)[column];
}

export function chessComGameRating(evidence, anchor, timeClass, bands = chessComRatingReference[timeClass]) {
  if (!bands || !evidence || !Number.isFinite(anchor) || anchor < 100 || anchor > 3600) return null;
  if (anchor > bands.at(-1)[0] + 400) return null;
  const typicalQuality = interpolate(bands, anchor, 1);
  const qualitySpread = Math.max(9, interpolate(bands, anchor, 2));
  const relativeQuality = (evidence.quality - typicalQuality) / qualitySpread;
  const evidenceWeight = evidence.weightSum / (evidence.weightSum + 8);
  const adjustment = 450 * evidenceWeight * Math.tanh(relativeQuality);
  // A swing that throws away a playable game carries more information than
  // piling up small losses or accurate moves after the game is decided.
  const criticalPenalty = Math.min(180, Math.max(0, evidence.critical - 1) * 65);
  const rating = Math.max(100, Math.round((anchor + adjustment - criticalPenalty) / 50) * 50);
  const radius = 275 + 175 * (1 - evidenceWeight);
  return {
    rating,
    low: Math.max(100, Math.floor((rating - radius) / 50) * 50),
    high: Math.ceil((rating + radius) / 50) * 50,
  };
}

export function sourcePool(headers) {
  for (const text of [headers.Link, headers.Site]) {
    if (typeof text !== 'string') continue;
    const value = text.trim();
    if (/^(?:www\.)?chess\.com$/i.test(value)) return 'chesscom';
    if (/^(?:www\.)?lichess\.org$/i.test(value)) return 'lichess';
    try {
      const { hostname } = new URL(value);
      if (hostname === 'chess.com' || hostname.endsWith('.chess.com')) return 'chesscom';
      if (hostname === 'lichess.org' || hostname.endsWith('.lichess.org')) return 'lichess';
    } catch { /* Imported PGN site tags also accept arbitrary text. */ }
  }
  return null;
}

export function recordedRating(value) {
  if (!/^\d{3,4}$/.test(String(value ?? ''))) return null;
  const rating = Number(value);
  return rating >= 100 && rating <= 4000 ? rating : null;
}
