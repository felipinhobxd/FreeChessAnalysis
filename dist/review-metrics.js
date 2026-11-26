import {decisionProfile,sideDecisions,predictBand} from './decision-profile.js';
import {performanceModel as rapid} from './performance-model.js';
import {performanceModel as blitz} from './blitz-model.js';
import { calibrationModel } from './caps2-model.js';
import { chessComGameRating, ratingEvidence, recordedRating, sourcePool } from './game-rating.js';
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
  const pool = sourcePool(headers);
  const raw = String(headers.TimeControl || '').trim();
  const match = /^(\d+)(?:\+(\d+))?$/.exec(raw);
  if (!match) return null;
  const base = Number(match[1]);
  const increment = Number(match[2] || 0);
  const estimated = base + increment * 40;
  if (estimated < 180) return 'bullet';
  if (estimated < (pool === 'lichess' ? 480 : 600)) return 'blitz';
  if (pool === 'chesscom' || estimated < 1500) return 'rapid';
  return 'classical';
}

export function estimatePerformance(path, side, headers = {}) {
  const timeClass = gameTimeClass(headers);
  if (!timeClass) return { available: false, reason: 'time-control' };
  if (!['blitz', 'rapid'].includes(timeClass)) return { available: false, reason: timeClass };
  if (path.slice(1).some(node => !node.coach)) return { available: false, reason: 'pending' };
  if (path.length < 25) return { available: false, reason: 'short' };
  const pool = sourcePool(headers);
  const actual = recordedRating(headers[side === 'w' ? 'WhiteElo' : 'BlackElo']);
  if (!pool) return { available: false, reason: 'pool' };
  if (pool === 'chesscom') {
    if (!actual) return { available: false, reason: 'rating' };
    const moves = path.slice(3).filter(node => node.move?.color === side);
    const evidence = ratingEvidence(moves.map(node => ({ ...node.coach, forced: node.forced })), side === 'w' ? 1 : -1);
    if (!evidence) return { available: false, reason: 'short' };
    const band = chessComGameRating(evidence, actual, timeClass);
    return band
      ? { available: true, ...band, pool, actual, timeClass, moves: evidence.moves }
      : { available: false, reason: 'outside-range' };
  }
  const decisions = sideDecisions(path, side);
  const features = decisionProfile(decisions);
  if (!features) return { available: false, reason: 'short' };
  const model = timeClass === 'rapid' ? rapid : blitz;
  const band = predictBand(features, model);
  return band
    ? { available: true, ...band, pool, actual, timeClass, moves: decisions.length, validation: model.validation }
    : { available: false, reason: 'outside-range' };
}

export function phaseForPosition(fen, ply) {
  const fields = String(fen || '').trim().split(/\s+/);
  const ranks = (fields[0] || '').split('/');
  if (ranks.length !== 8) return 'middlegame';

  const phaseValue = { n: 1, b: 1, r: 2, q: 4 };
  let phase = 0;
  let queens = 0;
  let occupied = 0;
  let whiteKings = 0;
  let blackKings = 0;
  for (const rank of ranks) {
    let files = 0;
    for (const symbol of rank) {
      if (/[1-8]/.test(symbol)) {
        files += Number(symbol);
      } else if (/[prnbqkPRNBQK]/.test(symbol)) {
        files++;
        occupied++;
        const type = symbol.toLowerCase();
        phase += phaseValue[type] || 0;
        if (type === 'q') queens++;
        if (type === 'k') {
          if (symbol === symbol.toUpperCase()) whiteKings++;
          else blackKings++;
        }
      } else {
        return 'middlegame';
      }
    }
    if (files !== 8) return 'middlegame';
  }
  const fullmove = Number(fields[5]);
  if (occupied > 64 || whiteKings !== 1 || blackKings !== 1 ||
      !Number.isInteger(fullmove) || fullmove < 1 || !['w', 'b'].includes(fields[1])) {
    return 'middlegame';
  }

  // The conventional game-phase scale starts at 24 (both sides fully developed).
  // Eight or fewer points indicates that most heavy/minor material has left.
  if (phase <= 8) return 'endgame';

  const movesPlayed = Number.isFinite(ply) && ply >= 0
    ? ply
    : Math.max(0, (fullmove - 1) * 2 + (fields[1] === 'b' ? 1 : 0));
  if (movesPlayed <= 20 && fullmove <= 11 && queens === 2 && phase >= 18) {
    return 'opening';
  }
  return 'middlegame';
}
