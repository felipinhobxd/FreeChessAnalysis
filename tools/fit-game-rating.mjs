import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { ratingEvidence, chessComGameRating } from '../dist/game-rating.js';

const [input = '.calibration/caps2-analysis.json', fixtureId] = process.argv.slice(2);
const { games, depth } = JSON.parse(readFileSync(input, 'utf8'));
const isFixture = game => fixtureId && game.url.endsWith('/' + fixtureId);
const fixture = games.find(isFixture);
const players = game => [game.white.username, game.black.username].map(name => name.toLowerCase());
const excluded = new Set(fixture ? players(fixture) : []);
const supported = new Set(['rapid', 'blitz']);
const eligible = games.filter(game => supported.has(game.timeClass) && game.moves.length >= 24);
const rows = eligible.flatMap(game => {
  const names = players(game);
  return ['w', 'b'].flatMap(side => {
    const player = side === 'w' ? game.white : game.black;
    const decisions = game.moves.slice(2).filter(move => move.color === side);
    const evidence = ratingEvidence(decisions, side === 'w' ? 1 : -1);
    return evidence ? [{ game, names, player, evidence }] : [];
  });
});
const reference = rows.filter(row => row.names.every(name => !excluded.has(name)));

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

const fold = url => createHash('sha256').update(url).digest()[0] % 5;
const heldOut = [];
for (let index = 0; index < 5; index++) {
  const test = reference.filter(row => fold(row.game.url) === index);
  const testPlayers = new Set(test.flatMap(row => row.names));
  const train = reference.filter(row => row.names.every(name => !testPlayers.has(name)));
  const bands = fit(train);
  for (const { game, player, evidence } of test) {
    const estimate = chessComGameRating(evidence, player.rating, game.timeClass, bands[game.timeClass]);
    if (estimate) heldOut.push({ speed: game.timeClass, anchor: player.rating, delta: estimate.rating - player.rating });
  }
}

const round = value => Math.round(value * 10) / 10;
function audit(sample) {
  return {
    n: sample.length,
    meanAdjustment: round(sample.reduce((sum, row) => sum + row.delta, 0) / sample.length),
    meanAbsoluteAdjustment: round(sample.reduce((sum, row) => sum + Math.abs(row.delta), 0) / sample.length),
    over300: sample.filter(row => row.delta > 300).length,
  };
}

const bands = fit(reference);
const report = {
  depth,
  games: new Set(reference.map(row => row.game.url)).size,
  sides: reference.length,
  heldOut: {
    all: audit(heldOut),
    under800: audit(heldOut.filter(row => row.anchor < 800)),
    rapid: audit(heldOut.filter(row => row.speed === 'rapid')),
    blitz: audit(heldOut.filter(row => row.speed === 'blitz')),
  },
  fixture: rows.filter(row => isFixture(row.game)).map(({ game, player, evidence }) => ({
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
