import {decisionProfile,sideDecisions,predictBand} from './decision-profile.js';
import {performanceModel as rapid} from './performance-model.js';
import {performanceModel as blitz} from './blitz-model.js';
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

export function estimatePerformance(path,side,headers={}) {
  const timeClass=gameTimeClass(headers);
  if(!['blitz','rapid'].includes(timeClass))return {available:false,reason:'time-control'};
  if(path.slice(1).some(n=>!n.coach))return {available:false,reason:'pending'};
  if(path.length<31)return {available:false,reason:'short'};
  const decisions=sideDecisions(path,side);
  const features=decisionProfile(decisions);
  if(!features)return {available:false,reason:'short'};
  const band=predictBand(features,timeClass==='rapid'?rapid:blitz);
  return band?{available:true,...band,timeClass,moves:decisions.length}:{available:false,reason:'outside-range'};
}

export function phaseForPosition(fen, ply) {
  const board = String(fen || '').split(' ')[0].replace(/[1-8/]/g, '');
  const value = { q: 9, r: 5, b: 3, n: 3 };
  const material = [...board].reduce((sum, piece) => sum + (value[piece.toLowerCase()] || 0), 0);
  if (material <= 13 || (!/[Qq]/.test(board) && material <= 22)) return 'endgame';
  const fullmove = Number(String(fen || '').split(' ')[5]);
  if (ply <= 20 && (!fullmove || fullmove <= 11)) return 'opening';
  return 'middlegame';
}
