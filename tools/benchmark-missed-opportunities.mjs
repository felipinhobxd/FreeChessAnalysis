import { Chess } from 'chess.js';
import { missedOpportunity } from '../dist/review-evidence.js';

const cp = (white, pv = [], depth = 16) => ({ type: 'cp', white, pv, depth });
const mate = (white, pv = [], depth = 16) => ({ type: 'mate', white, value: white, pv, depth });
function makeNode(fen, played, before, after, alternatives = []) {
  const board = new Chess(fen);
  const parent = { fen: board.fen() };
  const move = board.move(played);
  return { move, parent, fen: move.after, coach: { before, after, best: before.pv[0], choices: [before, ...alternatives] } };
}

const fixtures = [
  { id: 'mate-in-one-white', positive: true, fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', played: 'Qh5+', before: mate(1, ['g6g7']), after: cp(0), expected: 'mate' },
  { id: 'missed-shorter-mate', positive: true, fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', played: 'Qh5+', before: mate(1, ['g6g7']), after: mate(3), expected: 'faster-mate' },
  { id: 'queen-attack-opportunity', positive: true, fen: 'rnb1kbnr/ppp1pppp/q7/8/1P6/2N5/1BQPPPPP/4KBNR w Kkq - 2 7', played: 'Qd3', before: cp(-134, ['e2e4','a6d6','c3b5'], 14), after: cp(-851, [], 14), expected: 'attack' },
  { id: 'missed-mate-position-40', positive: true, fen: '4n3/p1q3k1/1p4pp/3K4/8/8/7r/8 b - - 3 40', played: 'a5', before: mate(-2, ['h2h4','d5e6','c7d6'], 14), after: mate(-3, [], 14), expected: 'faster-mate' },
  { id: 'missed-mate-position-42', positive: true, fen: '4n3/2q3k1/6pp/pp6/8/3K4/7r/8 b - - 1 42', played: 'b4', before: mate(-2, ['c7f4','d3c3','f4c4'], 14), after: mate(-3, [], 14), expected: 'faster-mate' },
  { id: 'missed-mate-position-45', positive: true, fen: '4n3/2q3k1/6pp/3K4/1p6/p7/7r/8 b - - 1 45', played: 'b3', before: mate(-2, ['e8f6','d5e6','h2e2'], 14), after: mate(-3, [], 14), expected: 'faster-mate' },
  { id: 'missed-mate-position-46', positive: true, fen: '4n3/2q3k1/4K1pp/8/8/pp6/7r/8 b - - 1 46', played: 'b2', before: mate(-1, ['c7d6'], 14), after: mate(-2, [], 14), expected: 'faster-mate' },
  { id: 'missed-mate-position-47', positive: true, fen: '4n3/2q3k1/6pp/3K4/8/p7/1p5r/8 b - - 1 47', played: 'a2', before: mate(-2, ['h2h4','d5e6','c7d6'], 14), after: mate(-3, [], 14), expected: 'faster-mate' },
  { id: 'missed-mate-position-48', positive: true, fen: '4n3/2q3k1/4K1pp/8/8/8/pp5r/8 b - - 1 48', played: 'a1=Q', before: mate(-1, ['c7d6'], 14), after: mate(-2, [], 14), expected: 'faster-mate' },
  { id: 'durable-knight-gain', positive: true, fen: '7k/p5pp/8/8/3n4/8/PP4PP/3R2K1 w - - 0 1', played: 'a3', before: cp(320,['d1d4','h7h6','a2a3','a7a6']), after: cp(0,['d4c6','h2h3','a7a6']), expected: 'piece' },
  { id: 'recapture-cancels-gain', positive: false, fen: '3r3k/p5pp/8/8/3n4/8/PP4PP/3R2K1 w - - 0 1', played: 'a3', before: cp(290,['d1d4','d8d4','a2a3','a7a6']), after: cp(0,['d4c6','h2h3','a7a6']) },
  { id: 'equivalent-multipv', positive: false, fen: '7k/p5pp/8/8/3n4/8/PP4PP/3R2K1 w - - 0 1', played: 'a3', before: cp(320,['d1d4','h7h6','a2a3','a7a6']), after: cp(0,['d4c6','h2h3','a7a6']), alternatives: [cp(285,['a2a3','h7h6','d1d4','a7a6'])] },
  { id: 'insufficient-search-depth', positive: false, fen: '7k/p5pp/8/8/3n4/8/PP4PP/3R2K1 w - - 0 1', played: 'a3', before: cp(380,['d1d4','h7h6','a2a3','a7a6'],8), after: cp(40,['d4c6'],8) },
];

const results = fixtures.map(fixture => {
  const node = makeNode(fixture.fen, fixture.played, fixture.before, fixture.after, fixture.alternatives || []);
  const detected = missedOpportunity(Chess, node.parent, node);
  const pass = fixture.positive ? detected?.kind === fixture.expected : detected === null;
  return { id: fixture.id, positive: fixture.positive, expected: fixture.expected || 'none', detected: detected?.kind || 'none', pass };
});
const tp = results.filter(r => r.positive && r.pass).length;
const fp = results.filter(r => !r.positive && !r.pass).length;
const positives = results.filter(r => r.positive).length;
const negatives = results.filter(r => !r.positive).length;
const missed = positives - tp;
const precision = tp + fp ? tp / (tp + fp) : 0;
const recall = positives ? tp / positives : 0;
console.log('Missed-opportunity detector benchmark (synthetic engine evidence; not engine-generated)');
console.log(JSON.stringify({ cases: results.length, positiveCases: positives, negativeCases: negatives, truePositive: tp, falseNegative: missed, falsePositive: fp, precision: Number(precision.toFixed(3)), recall: Number(recall.toFixed(3)), results }, null, 2));
if (results.some(r => !r.pass)) process.exitCode = 1;
