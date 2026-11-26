import { readFileSync, writeFileSync } from 'node:fs';
import { ratingEvidence, chessComGameRating } from '../dist/game-rating.js';
import { splitGamesByPlayer } from './rating-split.mjs';

const [input = '.calibration/caps2-analysis.json', fixtureId] = process.argv.slice(2);
const { games, depth } = JSON.parse(readFileSync(input, 'utf8'));
const isFixture = game => fixtureId && String(game.url).endsWith('/' + fixtureId);
const fixture = games.find(isFixture);
const players = game => [game.white.username, game.black.username].map(name => name.toLowerCase());
const fixturePlayers = new Set(fixture ? players(fixture) : []);
const supported = new Set(['rapid', 'blitz']);
const eligible = games.filter(game => supported.has(game.timeClass) && game.moves.length >= 24);
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
const trainRows = rowsFor(split.train.filter(keepAwayFromFixture));
const heldRows = rowsFor(split.holdout.filter(keepAwayFromFixture));
const reference = [...trainRows, ...heldRows];
if (trainRows.length < 100 || heldRows.length < 30) {
  throw new Error('Insufficient player-disjoint data: need at least 100 training sides and 30 holdout sides; collect more reviewed games.');
}

function quantile(sorted, q) {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

function fit(sample) {
  const groups = Object.fromEntries(Array.from(supported, speed => {
    const rated = sample.filter(row => row.game.timeClass === speed);
    const bands = [];
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
    }
    if (bands.length < 2) throw new Error('Insufficient bands for ' + speed);
    return [speed, bands];
  }));
  return groups;
}

const validationBands = fit(trainRows);
const heldOut = heldRows.flatMap(({ game, player, evidence }) => {
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
function audit(sample) {
  const deltas = sample.map(row => row.delta);
  return {
    n: sample.length,
    meanAdjustment: deltas.length ? round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length) : null,
    meanAbsoluteAdjustment: deltas.length ? round(deltas.reduce((sum, value) => sum + Math.abs(value), 0) / deltas.length) : null,
    medianAbsoluteAdjustment: median(deltas.map(Math.abs)),
    over300: deltas.filter(value => value > 300).length,
    beyond300: deltas.filter(value => Math.abs(value) > 300).length,
  };
}

const bands = fit(reference);
const playerCount = sample => new Set(sample.flatMap(game => players(game))).size;
const fixtureRows = fixture && supported.has(fixture.timeClass) ? rowsFor([fixture]) : [];
const report = {
  depth,
  split: {
    method: '80/20 deterministic player-disjoint holdout',
    trainingGames: new Set(trainRows.map(row => row.game.url)).size,
    holdoutGames: new Set(heldRows.map(row => row.game.url)).size,
    excludedCrossSplitGames: split.excluded.length,
    fixturePlayerGamesExcluded: eligible.filter(game => players(game).some(name => fixturePlayers.has(name))).length,
    trainingPlayers: playerCount(split.train.filter(keepAwayFromFixture)),
    holdoutPlayers: playerCount(split.holdout.filter(keepAwayFromFixture)),
    trainingSides: trainRows.length,
    holdoutSides: heldRows.length,
    predictedHoldoutSides: heldOut.length,
  },
  games: new Set(reference.map(row => row.game.url)).size,
  sides: reference.length,
  heldOut: {
    all: audit(heldOut),
    under800: audit(heldOut.filter(row => row.anchor < 800)),
    rapid: audit(heldOut.filter(row => row.speed === 'rapid')),
    blitz: audit(heldOut.filter(row => row.speed === 'blitz')),
  },
  fixture: fixtureRows.map(({ game, player, evidence }) => ({
    anchor: player.rating,
    estimated: chessComGameRating(evidence, player.rating, game.timeClass, bands[game.timeClass])?.rating,
  })),
};
const moduleText = '// Public Chess.com games scored with Stockfish 19 Lite. [rating, median quality, IQR]\n'
  + 'export const chessComRatingReference = {\n'
  + Object.entries(bands).map(([speed, curve]) => '  ' + speed + ': ' + JSON.stringify(curve) + ',\n').join('')
  + '};\n';
writeFileSync(new URL('../dist/chesscom-rating-reference.js', import.meta.url), moduleText);
console.log(JSON.stringify(report, null, 2));
