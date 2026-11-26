import { readFileSync, writeFileSync } from 'node:fs';
import { ratingEvidence, chessComGameRating } from '../dist/game-rating.js';
import { splitGamesByPlayer } from './rating-split.mjs';
import { validateRatingReference, ratingReferenceAcceptance } from './rating-reference-validation.mjs';

const [input = '.calibration/caps2-analysis.json', fixtureId] = process.argv.slice(2);
const dataset = JSON.parse(readFileSync(input, 'utf8'));
const games = Array.isArray(dataset.games) ? dataset.games : [];
const depth = dataset.depth;
const isFixture = game => fixtureId && String(game.url).endsWith('/' + fixtureId);
const fixture = games.find(isFixture);
const players = game => [game.white.username, game.black.username].map(name => String(name).trim().toLowerCase());
const fixturePlayers = new Set(fixture ? players(fixture) : []);
const supported = new Set(['rapid', 'blitz']);
const eligible = games.filter(game => supported.has(game.timeClass) && Array.isArray(game.moves) &&
  game.moves.length >= 24 && typeof game.white?.username === 'string' &&
  typeof game.black?.username === 'string' && Number.isFinite(game.white?.rating) &&
  Number.isFinite(game.black?.rating));
const split = splitGamesByPlayer(eligible, 20);
const keepAwayFromFixture = game => players(game).every(name => !fixturePlayers.has(name));

const rowsFor = sample => sample.flatMap(game => {
  const names = players(game);
  return ['w', 'b'].flatMap(side => {
    const player = side === 'w' ? game.white : game.black;
    const decisions = game.moves.slice(2).filter(move => move.color === side);
    const evidence = ratingEvidence(decisions, side === 'w' ? 1 : -1);
    return evidence ? [{ game, names, player, evidence }] : [];
  });
});
const cleanTrainGames = split.train.filter(keepAwayFromFixture);
const cleanHoldoutGames = split.holdout.filter(keepAwayFromFixture);
const trainRows = rowsFor(cleanTrainGames);
const heldRows = rowsFor(cleanHoldoutGames);
if (!trainRows.length || !heldRows.length) {
  throw new Error('Insufficient player-disjoint data: collect more games from independent Chess.com players.');
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

function fit(sample, bucketStats = null) {
  const groups = Object.fromEntries(Array.from(supported, speed => {
    const rated = sample.filter(row => row.game.timeClass === speed);
    const bands = [];
    const stats = [];
    for (let start = 0; start < 3600; start += 400) {
      const bucket = rated.filter(row => row.player.rating >= start && row.player.rating < start + 400);
      if (bucket.length < 14) continue;
      const ratings = bucket.map(row => row.player.rating).sort((a, b) => a - b);
      const scores = bucket.map(row => row.evidence.quality).sort((a, b) => a - b);
      bands.push([
        Math.round(quantile(ratings, 0.5)),
        +quantile(scores, 0.5).toFixed(2),
        +(quantile(scores, 0.75) - quantile(scores, 0.25)).toFixed(2),
      ]);
      stats.push({ minRating: start, maxRating: start + 399, sides: bucket.length });
    }
    if (bands.length < 2) throw new Error('Insufficient rating bands for ' + speed + '; collect more players across rating levels.');
    if (bucketStats) bucketStats[speed] = stats;
    return [speed, bands];
  }));
  return groups;
}

const validationBands = fit(trainRows);
const qualityValidation = validateRatingReference(trainRows, heldRows, validationBands);
const acceptance = ratingReferenceAcceptance(qualityValidation);
const referenceStats = {};
const bands = fit([...trainRows, ...heldRows], referenceStats);

const heldOutAdjustments = heldRows.flatMap(({ game, player, evidence }) => {
  const estimate = chessComGameRating(evidence, player.rating, game.timeClass, validationBands[game.timeClass]);
  return estimate ? [{ speed: game.timeClass, anchor: player.rating, delta: estimate.rating - player.rating }] : [];
});

const round = value => Math.round(value * 10) / 10;
const median = values => {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
function auditAdjustments(sample) {
  const deltas = sample.map(row => row.delta);
  return {
    n: deltas.length,
    meanAdjustment: deltas.length ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length) : null,
    meanAbsoluteAdjustment: deltas.length ? round(deltas.reduce((sum, value) => sum + Math.abs(value), 0) / deltas.length) : null,
    medianAbsoluteAdjustment: median(deltas.map(Math.abs)),
    beyond300: deltas.filter(value => Math.abs(value) > 300).length,
  };
}

const playerCount = sample => new Set(sample.flatMap(game => players(game))).size;
const fixtureRows = fixture && supported.has(fixture.timeClass) ? rowsFor([fixture]) : [];
const report = {
  schema: 2,
  createdAt: new Date().toISOString(),
  target: 'Stockfish-derived move-quality reference conditioned on recorded Chess.com rating and time control',
  disclaimer: 'This validation predicts engine-derived move quality on unseen players. It does not validate against the proprietary Chess.com Game Review performance-rating label, which is not present in the public dataset.',
  source: dataset.source || 'Chess.com public game archive',
  depth,
  split: {
    method: '80/20 deterministic player-disjoint holdout',
    trainingGames: new Set(trainRows.map(row => row.game.url)).size,
    holdoutGames: new Set(heldRows.map(row => row.game.url)).size,
    excludedCrossSplitGames: split.excluded.length,
    fixturePlayerGamesExcluded: eligible.filter(game => players(game).some(name => fixturePlayers.has(name))).length,
    trainingPlayers: playerCount(cleanTrainGames),
    holdoutPlayers: playerCount(cleanHoldoutGames),
    trainingSides: trainRows.length,
    holdoutSides: heldRows.length,
    ratingBuckets: referenceStats,
  },
  qualityReferenceValidation: {
    target: 'Per-game Stockfish-derived quality',
    metrics: qualityValidation,
    acceptance,
  },
  adjustmentDiagnostics: {
    description: 'Describes the heuristic adjustment applied to the PGN rating anchor. It is not an error metric against official Game Review ratings.',
    heldOut: {
      all: auditAdjustments(heldOutAdjustments),
      under800: auditAdjustments(heldOutAdjustments.filter(row => row.anchor < 800)),
      rapid: auditAdjustments(heldOutAdjustments.filter(row => row.speed === 'rapid')),
      blitz: auditAdjustments(heldOutAdjustments.filter(row => row.speed === 'blitz')),
    },
  },
  fixture: fixtureRows.map(({ game, player, evidence }) => ({
    anchor: player.rating,
    estimated: chessComGameRating(evidence, player.rating, game.timeClass, bands[game.timeClass])?.rating,
  })),
};
const reportFile = new URL('../dist/chesscom-rating-validation.json', import.meta.url);
writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');

if (acceptance.accepted) {
  const moduleText = '// Generated by tools/fit-game-rating.mjs after player-disjoint quality validation.\n'
    + 'export const chessComRatingReference = {\n'
    + Object.entries(bands).map(([speed, curve]) => '  ' + speed + ': ' + JSON.stringify(curve) + ',\n').join('')
    + '};\n'
    + 'export const chessComRatingReferenceMeta = Object.freeze('
    + JSON.stringify({
      source: 'Chess.com public game archive',
      sourceGames: new Set([...trainRows, ...heldRows].map(row => row.game.url)).size,
      stockfishDepth: depth,
      trainingSides: qualityValidation.trainingSides,
      holdoutSides: qualityValidation.holdoutSides,
      holdoutPlayers: qualityValidation.holdoutPlayers,
      holdoutQualityMae: qualityValidation.overall.model.mae,
      baselineQualityMae: qualityValidation.overall.baseline.mae,
      target: 'Stockfish-derived move quality, not official Chess.com Game Review performance rating',
    }, null, 2)
    + ');\n';
  writeFileSync(new URL('../dist/chesscom-rating-reference.js', import.meta.url), moduleText);
  console.log('Published a rating reference that passed player-disjoint quality validation.');
} else {
  console.error('Kept the existing production rating reference. See dist/chesscom-rating-validation.json.');
}
console.log(JSON.stringify({
  accepted: acceptance.accepted,
  reason: acceptance.reason,
  qualityReferenceValidation: qualityValidation,
  report: reportFile.pathname,
}, null, 2));
