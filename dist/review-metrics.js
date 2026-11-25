// Chess.com-oriented review metrics.
//
// Accuracy and rating are separate models. CAPS2 is proprietary; the runtime
// score below is an explicitly provisional fit shape until the included
// calibration pipeline is run against a large, player-disjoint Chess.com sample.
// Rating curves are independently derived from ~16,000 player-game observations from publicly reviewed
// Chess.com games (Ginzoh/chess-review, rating-samples* and rating-table).
const RATING_CURVES = {
  blitz: [
    [100,48.78,62.24,73.49],[300,58.52,66.28,75.81],[500,58.73,68.70,77.31],
    [700,61.54,71.32,78.61],[900,64.49,73.02,79.67],[1100,66.94,74.80,81.78],
    [1300,68.73,75.25,81.87],[1500,69.04,75.57,83.24],[1700,71.55,77.48,83.24],
    [1900,71.55,77.98,83.36],[2100,73.31,79.12,84.21],[2300,75.18,81.06,87.50],
    [2500,77.62,82.49,87.50],[2700,78.29,82.64,87.50],[2900,79.84,84.18,88.40],
    [3100,80.86,86.46,91.72],[3300,83.82,88.63,92.74]
  ],
  rapid: [
    [100,46.40,57.35,64.64],[300,49.09,60.52,69.80],[500,55.85,64.82,73.87],
    [700,61.76,69.72,77.09],[900,65.43,72.08,79.30],[1100,65.86,73.61,80.50],
    [1300,67.91,73.92,80.94],[1500,69.68,76.42,83.02],[1700,69.81,76.42,83.02],
    [1900,71.11,76.82,83.81],[2100,75.26,80.81,86.04],[2300,80.26,84.20,87.61],
    [2500,80.26,85.87,89.71],[2700,83.68,88.56,92.44]
  ]
};
const TYPICAL_ABSOLUTE_ERROR = { blitz: 711, rapid: 519 };
import { calibrationModel } from './caps2-model.js';
const ACCURACY_STORAGE_KEY = 'move-by-move/caps2-model';
const DEFAULT_ACCURACY_MODEL = calibrationModel;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function getAccuracyModel() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCURACY_STORAGE_KEY));
    if (saved?.version === 1 && Number.isFinite(saved.decay) &&
        Number.isFinite(saved.winK) && ['mean','harmonic','blend80'].includes(saved.aggregation)) {
      return { ...DEFAULT_ACCURACY_MODEL, ...saved };
    }
  } catch { /* Local calibration is optional. */ }
  return DEFAULT_ACCURACY_MODEL;
}

export function installAccuracyModel(model) {
  if (!model || model.version !== 1 || !Number.isFinite(model.decay) ||
      model.decay < 0.005 || model.decay > 0.3 ||
      !Number.isFinite(model.winK) || model.winK < 0.0005 || model.winK > 0.01 ||
      !['mean','harmonic','blend80'].includes(model.aggregation)) {
    throw new TypeError('Invalid Move by Move calibration model.');
  }
  const normalized = {
    version: 1, status: 'calibrated', winK: model.winK, decay: model.decay,
    floor: clamp(Number(model.floor) || 0, 0, 60),
    offset: clamp(Number(model.offset) || 0, -10, 10),
    aggregation: model.aggregation,
    forcedPolicy: model.forcedPolicy === 'exclude' ? 'exclude' : 'include',
    trainedGames: Math.max(0, Math.floor(Number(model.trainedGames) || 0)),
    heldOutSides: Math.max(0, Math.floor(Number(model.heldOutSides) || 0)),
    heldOutMae: Number.isFinite(model.heldOutMae) ? model.heldOutMae : null,
    engine: model.engine || 'Stockfish 19'
  };
  try { localStorage.setItem(ACCURACY_STORAGE_KEY, JSON.stringify(normalized)); } catch {}
  return normalized;
}

function expectedScore(evaluation, side, k) {
  if (!evaluation) return 50;
  const sign = side === 'w' ? 1 : -1;
  const value = Number(evaluation.white ?? evaluation.value ?? 0) * sign;
  if (evaluation.type === 'mate') return value > 0 ? 100 : value < 0 ? 0 : 50;
  const cp = clamp(value, -1000, 1000);
  return 100 / (1 + Math.exp(-k * cp));
}

export function moveAccuracyFromWinLoss(loss) {
  if (!Number.isFinite(loss)) return null;
  const model = getAccuracyModel();
  const raw = 103.1668100711649 * Math.exp(-model.decay * Math.max(0, loss)) - 3.166924740191411 + 1;
  return Math.round(clamp(raw + model.offset, model.floor, 100) * 10) / 10;
}

export function moveAccuracyBetween(before, after, side) {
  if (!before || !after) return null;
  const model = getAccuracyModel();
  const beforeChance = expectedScore(before, side, model.winK);
  const afterChance = expectedScore(after, side, model.winK);
  return moveAccuracyFromWinLoss(Math.max(0, beforeChance - afterChance));
}

function aggregateScores(scores, aggregation) {
  if (!scores.length) return null;
  const arithmetic = mean(scores);
  if (aggregation === 'mean') return arithmetic;
  const harmonic = scores.length / scores.reduce((sum, score) => sum + 1 / Math.max(1, score), 0);
  return aggregation === 'harmonic' ? harmonic : arithmetic * 0.8 + harmonic * 0.2;
}

export function aggregateGameAccuracy(path, side) {
  const scores = path.slice(1)
    .filter(node => node?.move?.color === side && Number.isFinite(node.accuracy) && !(getAccuracyModel().forcedPolicy === 'exclude' && node.forced))
    .map(node => node.accuracy);
  const result = aggregateScores(scores, getAccuracyModel().aggregation);
  return result === null ? null : Math.round(result * 10) / 10;
}

export function gameTimeClass(headers = {}) {
  const raw = String(headers.TimeControl || '').trim();
  const match = /^(\d+)(?:\+(\d+))?$/.exec(raw);
  if (!match) return null;
  const base = Number(match[1]);
  const increment = Number(match[2] || 0);
  const estimated = base + increment * 40;
  if (estimated < 180) return 'bullet';
  if (estimated < 600) return 'blitz';
  if (estimated <= 1500) return 'rapid';
  return 'classical';
}

function invertCurve(rows, column, accuracy) {
  const first = rows[0], last = rows.at(-1);
  if (accuracy <= first[column]) return { value: first[0] - 100, bound: 'below' };
  if (accuracy >= last[column]) return { value: last[0] + 100, bound: 'above' };
  for (let index = 1; index < rows.length; index++) {
    const a = rows[index - 1], b = rows[index];
    if (accuracy <= b[column]) {
      const span = b[column] - a[column];
      const fraction = span > 0 ? (accuracy - a[column]) / span : 1;
      return { value: a[0] + fraction * (b[0] - a[0]), bound: null };
    }
  }
  return { value: last[0], bound: null };
}

// Dedicated rating-performance score. The public rating curves below were
// built from Chess.com's published per-game accuracy, so this score is kept
// separate from the app's provisional review accuracy/CAPS2 display.
//
// Based on Ginzoh/chess-review's measured Stockfish 19 calibration:
// - 0.8 centipawn rescale for SF19;
// - at least 4 accuracy-loss points per pawn lost;
// - explicit missed/allowed-mate penalties and an 80 cap while already mated;
// - arithmetic mean followed by the published linear map (1.944x - 93.5).
// Their accuracy fit used 34 games / 68 player-sides, so this is a useful
// public calibration, not an official Chess.com formula or a large validation.
const PERFORMANCE_SCORE = Object.freeze({
  winK: 0.00368208,
  engineCpScale: 0.8,
  cpLossPerPawn: 4,
  missedMateLoss: 25,
  missedOpportunityLoss: 23,
  lossCap: 60,
  alreadyMatedAccuracyCap: 80,
  calibrationSlope: 1.944,
  calibrationIntercept: -93.5
});

function performanceWinScore(evaluation, side) {
  if (!evaluation) return 50;
  const sign = side === 'w' ? 1 : -1;
  const value = Number(evaluation.white ?? evaluation.value ?? 0) * sign;
  if (evaluation.type === 'mate') return value > 0 ? 100 : value < 0 ? 0 : 50;
  const cp = clamp(value * PERFORMANCE_SCORE.engineCpScale, -1000, 1000);
  return 100 / (1 + Math.exp(-PERFORMANCE_SCORE.winK * cp));
}

function performanceMoveAccuracy(node, side) {
  const beforeNode = node?.parent;
  const before = beforeNode?.evaluation;
  const after = node?.evaluation;
  if (!before || !after) return null;

  const sign = side === 'w' ? 1 : -1;
  const beforeForMover = Number(before.white ?? before.value ?? 0) * sign;
  const afterForMover = Number(after.white ?? after.value ?? 0) * sign;
  const beforeChance = performanceWinScore(before, side);
  const afterChance = performanceWinScore(after, side);
  const playedUci = node.move
    ? node.move.from + node.move.to + (node.move.promotion || '')
    : '';
  const bestUci = beforeNode.best || beforeNode.lines?.[0]?.pv?.[0] || null;
  const isBest = Boolean(bestUci && playedUci === bestUci);

  const alreadyMated = before.type === 'mate' && beforeForMover < 0;
  const hadForcedMate = before.type === 'mate' && beforeForMover > 0;
  const keptForcedMate = after.type === 'mate' && afterForMover > 0;
  const missedMate = hadForcedMate && !keptForcedMate && !isBest;
  const allowedMate = after.type === 'mate' && afterForMover < 0 && !alreadyMated;
  const missedOpportunity = Boolean(node.chanceLost);

  let loss = Math.max(0, beforeChance - afterChance);
  if (missedMate || node.chanceLost?.kind === 'mate') {
    loss = Math.max(loss, PERFORMANCE_SCORE.missedMateLoss);
  } else if (missedOpportunity) {
    loss = Math.max(loss, PERFORMANCE_SCORE.missedOpportunityLoss);
  } else {
    const beforeCp = clamp(beforeForMover * PERFORMANCE_SCORE.engineCpScale, -1500, 1500);
    const afterCp = clamp(afterForMover * PERFORMANCE_SCORE.engineCpScale, -1500, 1500);
    const cpLoss = Math.max(0, beforeCp - afterCp);
    loss = Math.max(loss, cpLoss / 100 * PERFORMANCE_SCORE.cpLossPerPawn);
    if (allowedMate) loss = Math.max(loss, PERFORMANCE_SCORE.missedMateLoss);
  }

  if (isBest && !missedMate && !missedOpportunity && !allowedMate) loss = 0;
  loss = Math.min(loss, PERFORMANCE_SCORE.lossCap);

  const raw = clamp(
    103.1668 * Math.exp(-0.04354 * loss) - 3.1669,
    0,
    100
  );
  return alreadyMated
    ? Math.min(raw, PERFORMANCE_SCORE.alreadyMatedAccuracyCap)
    : raw;
}

function performanceAccuracyForGame(path, side) {
  const scores = path.slice(1)
    .filter(node => node?.move?.color === side)
    .map(node => performanceMoveAccuracy(node, side))
    .filter(Number.isFinite);
  if (!scores.length) return null;
  const raw = mean(scores);
  return {
    raw,
    calibrated: clamp(
      PERFORMANCE_SCORE.calibrationSlope * raw + PERFORMANCE_SCORE.calibrationIntercept,
      0,
      100
    ),
    moves: scores.length
  };
}

export function estimatePerformance(path, side, headers = {}) {
  const timeClass = gameTimeClass(headers);
  const sideMoveCount = path.slice(1).filter(node => node?.move?.color === side).length;
  if (sideMoveCount < 10 || path.length - 1 < 20) {
    return { available: false, reason: 'short', moves: sideMoveCount };
  }
  if (!timeClass) return { available: false, reason: 'time-control', moves: sideMoveCount };
  if (timeClass === 'bullet') return { available: false, reason: 'bullet', moves: sideMoveCount };
  if (timeClass === 'classical') return { available: false, reason: 'classical', moves: sideMoveCount };

  const score = performanceAccuracyForGame(path, side);
  if (!score || score.moves < 10) {
    return { available: false, reason: 'short', moves: score?.moves || 0 };
  }
  const accuracy = score.calibrated;
  const table = RATING_CURVES[timeClass];
  if (accuracy < table[0][2] || accuracy > table.at(-1)[2]) {
    return {
      available: false,
      reason: 'outside-range',
      moves: score.moves,
      accuracy,
      rawAccuracy: score.raw
    };
  }

  const median = invertCurve(table, 2, accuracy);
  const low = invertCurve(table, 3, accuracy);
  const high = invertCurve(table, 1, accuracy);
  const round = value => Math.round(value / 25) * 25;
  return {
    available: true,
    rating: round(median.value),
    low: round(Math.min(low.value, median.value)),
    high: round(Math.max(high.value, median.value)),
    lowBound: low.bound,
    highBound: high.bound,
    timeClass,
    accuracy,
    rawAccuracy: Math.round(score.raw * 10) / 10,
    moves: score.moves,
    typicalAbsoluteError: TYPICAL_ABSOLUTE_ERROR[timeClass],
    dataSourcePlayerGameSamples: 16000,
    calibrationSamplePlayerGames: 68,
    method: 'sf19-cp-floor-public-accuracy-calibration'
  };
}

export function phaseForPosition(fen, ply) {
  const board = String(fen || '').split(' ')[0].replace(/[1-8/]/g, '');
  const value = { q: 9, r: 5, b: 3, n: 3 };
  const material = [...board].reduce((sum, piece) => sum + (value[piece.toLowerCase()] || 0), 0);
  if (material <= 13) return 'endgame';
  if (ply <= 20) return 'opening';
  return 'middlegame';
}
