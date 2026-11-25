import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { missedOpportunity, shortMateAfter, aspectEvidence, aspectGrade } from '../dist/review-evidence.js';
import { estimatePerformance, phaseForPosition, gameTimeClass } from '../dist/review-metrics.js';
import { decisionProfile, predictBand } from '../dist/decision-profile.js';
import { performanceModel } from '../dist/performance-model.js';
import { moveSound } from '../dist/board-ui.js';

const cp = (white, pv = [], depth = 16) => ({type:'cp', white, pv, depth});
const mate = (white, pv = [], depth = 16) => ({type:'mate', white, value:white, pv, depth});

function position(fen, played, before, after, alternatives = []) {
  const board = new Chess(fen);
  const parent = {fen:board.fen()};
  const move = board.move(played);
  return {move, parent, coach:{before, after, best:before.pv[0], choices:[before, ...alternatives]}};
}

test('mate in one is checked on the board, in both perspectives', () => {
  const white = position('7k/8/5KQ1/8/8/8/8/8 w - - 0 1', 'Qh5+', mate(1,['g6g7']), cp(0));
  assert.equal(missedOpportunity(Chess,white.parent,white)?.distance,1);
  const board = new Chess();
  for(const san of ['f3','e5','g4']) board.move(san);
  const black = position(board.fen(),'Nf6',mate(-1,['d8h4']),cp(0));
  assert.equal(missedOpportunity(Chess,black.parent,black)?.san,'Qh4#');
});

test('a missed shorter mate is detected even when the position is still winning', () => {
  const fen = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
  const before = mate(1, ['g6g7']);
  const retained = position(fen, 'Qh5+', before, mate(3));
  const alsoSeen = position(fen, 'Qh5+', before, cp(0, [], 10), [mate(3, ['g6h5'])]);
  for (const node of [retained, alsoSeen]) {
    const result = missedOpportunity(Chess, node.parent, node);
    assert.equal(result?.kind, 'faster-mate');
    assert.equal(result.distance, 1);
    assert.ok(result.playedDistance > 1);
  }
});

test('an equally fast mate remains correct even outside the displayed alternatives', () => {
  const fen = '4n3/2q3k1/6pp/3K4/1p6/p7/7r/8 b - - 1 45';
  const before = mate(-2, ['e8f6', 'd5e6', 'h2e2']);
  const alternate = position(fen, 'Rh4', before, mate(-1));
  assert.ok(shortMateAfter(Chess, alternate.move.after, 2));
  assert.equal(missedOpportunity(Chess, alternate.parent, alternate), null);
});

test('the seven reference positions are recognized at the default review depth', () => {
  const examples = [
    { fen: 'rnb1kbnr/ppp1pppp/q7/8/1P6/2N5/1BQPPPPP/4KBNR w Kkq - 2 7', san: 'Qd3',
      before: cp(-134, ["e2e4","a6d6","c3b5"], 14), after: cp(-851, [], 14), expected: 'attack' },
    { fen: '4n3/p1q3k1/1p4pp/3K4/8/8/7r/8 b - - 3 40', san: 'a5',
      before: mate(-2, ["h2h4","d5e6","c7d6"], 14), after: mate(-3, [], 14), expected: 'faster-mate' },
    { fen: '4n3/2q3k1/6pp/pp6/8/3K4/7r/8 b - - 1 42', san: 'b4',
      before: mate(-2, ["c7f4","d3c3","f4c4"], 14), after: mate(-3, [], 14), expected: 'faster-mate' },
    { fen: '4n3/2q3k1/6pp/3K4/1p6/p7/7r/8 b - - 1 45', san: 'b3',
      before: mate(-2, ["e8f6","d5e6","h2e2"], 14), after: mate(-4, [], 14), expected: 'faster-mate' },
    { fen: '4n3/2q3k1/4K1pp/8/8/pp6/7r/8 b - - 1 46', san: 'b2',
      before: mate(-1, ["c7d6"], 14), after: mate(-2, [], 14), expected: 'faster-mate' },
    { fen: '4n3/2q3k1/6pp/3K4/8/p7/1p5r/8 b - - 1 47', san: 'a2',
      before: mate(-2, ["h2h4","d5e6","c7d6"], 14), after: mate(-3, [], 14), expected: 'faster-mate' },
    { fen: '4n3/2q3k1/4K1pp/8/8/8/pp5r/8 b - - 1 48', san: 'a1=Q',
      before: mate(-1, ["c7d6"], 14), after: mate(-2, [], 14), expected: 'faster-mate' },
  ];
  for (const { fen, san, before, after, expected } of examples) {
    const node = position(fen, san, before, after);
    const result = missedOpportunity(Chess, node.parent, node);
    assert.equal(result?.kind, expected, san);
    if (expected === 'attack') assert.match(result.reason, /ataque descoberto.*a6/);
    else assert.ok(result.playedDistance > result.distance, san);
  }
});

test('hanging material only counts when the gain survives replies', () => {
  const freeKnight=position('7k/p5pp/8/8/3n4/8/PP4PP/3R2K1 w - - 0 1','a3',
    cp(320,['d1d4','h7h6','a2a3','a7a6']),cp(0,['d4c6','h2h3','a7a6']));
  const recapture=position('3r3k/p5pp/8/8/3n4/8/PP4PP/3R2K1 w - - 0 1','a3',
    cp(290,['d1d4','d8d4','a2a3','a7a6']),cp(0,['d4c6','h2h3','a7a6']));
  assert.equal(missedOpportunity(Chess,freeKnight.parent,freeKnight)?.piece,'n');
  assert.equal(missedOpportunity(Chess,recapture.parent,recapture),null);
});

test('a durable conversion loss requires enough engine evidence', () => {
  const fen='7k/p5pp/8/8/3n4/8/PP4PP/3R2K1 w - - 0 1';
  const best=['h2h3','d4c6','a2a3','a7a6'];
  const decisive=position(fen,'a3',cp(380,best),cp(40,['d4c6','h2h3','a7a6']));
  const shallow=position(fen,'a3',cp(380,best,8),cp(40,['d4c6']));
  assert.equal(missedOpportunity(Chess,decisive.parent,decisive)?.kind,'advantage');
  assert.equal(missedOpportunity(Chess,shallow.parent,shallow),null);
});

test('phase and examples reflect the board, including standalone FENs', () => {
  const board=new Chess();
  const development=position(board.fen(),'Nf3',cp(25,['g1f3']),cp(25));
  assert.equal(phaseForPosition(board.fen(),0),'opening');
  assert.equal(aspectEvidence(development,'opening').get('Princípios'),'Desenvolvimento');
  assert.equal(phaseForPosition(board.fen().replace(/1$/,'29'),0),'middlegame');
  assert.equal(aspectEvidence(development,'opening').has('Final'),false);
  const ending=position('8/7k/8/8/8/6K1/P7/8 w - - 0 53','a4',cp(160,['a2a4']),cp(160));
  assert.equal(phaseForPosition(ending.parent.fen,0),'endgame');
  assert.equal(aspectEvidence(ending,'endgame').get('Final'),'Peão passado');
});

test('performance uses signed decisions and abstains on short or unsupported games', () => {
  const decisions=sign=>Array.from({length:16},()=>({before:cp(sign*100),after:cp(sign*50),sign,san:'Nc3'}));
  assert.deepEqual(decisionProfile(decisions(1)),decisionProfile(decisions(-1)));
  assert.equal(decisionProfile(decisions(1).slice(0,11)),null);
  assert.equal(estimatePerformance([{}],'w',{TimeControl:'600+0'}).reason,'short');
  assert.equal(estimatePerformance([{}],'b',{TimeControl:'60+0'}).reason,'bullet');
  assert.equal(gameTimeClass({TimeControl:'300+5'}),'blitz');
  assert.equal(gameTimeClass({TimeControl:'900+10'}),'rapid');
  const band=predictBand(performanceModel.center,performanceModel);
  assert.ok(band.low<band.rating && band.rating<band.high);
  assert.equal(predictBand(performanceModel.center.map(x=>x+100),performanceModel),null);
});


test('missed-opportunity detector ignores near-equivalent MultiPV alternatives', () => {
  const fen = '7k/p5pp/8/8/3n4/8/PP4PP/3R2K1 w - - 0 1';
  const close = position(fen, 'a3', cp(320,['d1d4','h7h6','a2a3','a7a6']),
    cp(0,['d4c6','h2h3','a7a6']),
    [cp(285,['a2a3','h7h6','d1d4','a7a6'])]);
  close.coach.choices[1].depth = 16;
  assert.equal(missedOpportunity(Chess,close.parent,close), null);
});

test('aspect grades reflect excellent play and serious mistakes', () => {
  const excellent = aspectGrade([{classification:'excellent'},{classification:'best'},{classification:'great'}]);
  const veryBad = aspectGrade([{classification:'blunder'},{classification:'chance-lost'},{classification:'mistake'}]);
  assert.equal(excellent.key,'excellent');
  assert.equal(veryBad.key,'blunder');
  assert.equal(veryBad.misses,1);
  assert.equal(aspectGrade([]),null);
});

test('aspect evidence separates opening and endgame decision groups', () => {
  const board = new Chess();
  const development = position(board.fen(),'Nf3',cp(25,['g1f3']),cp(25));
  development.classification = 'best';
  assert.equal(aspectEvidence(development,'opening',Chess).has('Abertura'),true);
  assert.equal(aspectEvidence(development,'opening',Chess).has('Princípios'),true);
  const ending = position('8/7k/8/8/8/6K1/P7/8 w - - 0 53','a4',cp(160,['a2a4']),cp(160));
  ending.classification = 'good';
  assert.equal(aspectEvidence(ending,'endgame',Chess).has('Final'),true);
});

test('Chess.com game rating uses the PGN as an anchor and ignores play in decided games', () => {
  const headers = { Site: 'Chess.com', TimeControl: '600', WhiteElo: '400', BlackElo: '486' };
  const before = cp(30);
  const good = [{}, ...Array.from({ length: 40 }, (_, i) => ({
    move: { color: i % 2 ? 'b' : 'w' },
    coach: { before, after: before },
  }))];
  const strong = estimatePerformance(good, 'w', headers);
  const forced = good.map((node, i) => i && i % 4 === 1 ? { ...node, forced: true } : node);
  const decided = [{}, ...good.slice(1).map(node => ({ ...node, coach: { before: cp(2400), after: cp(2400) } }))];
  const bad = [{}, ...good.slice(1).map(node => node.move.color === 'b' ? node : ({
    ...node, coach: { before, after: cp(-600) },
  }))];
  assert.ok(strong.available && strong.rating > 400 && strong.rating < 800);
  assert.ok(estimatePerformance(forced, 'w', headers).rating <= strong.rating);
  assert.ok(estimatePerformance(bad, 'w', headers).rating < 400);
  assert.equal(estimatePerformance(decided, 'w', headers).reason, 'short');
  assert.equal(estimatePerformance(good, 'w', { ...headers, WhiteElo: '?' }).reason, 'rating');
  assert.equal(estimatePerformance(good, 'w', { ...headers, Site: '?' }).reason, 'pool');
});

test('board sound effects cover moves, special moves and results', () => {
  assert.equal(moveSound({ san: 'e4' }), 'move');
  assert.equal(moveSound({ san: 'Nxe4', captured: 'p' }), 'capture');
  assert.equal(moveSound({ san: 'Bxf7+', captured: 'p' }), 'check');
  assert.equal(moveSound({ san: 'O-O', flags: 'k' }), 'castle');
  assert.equal(moveSound({ san: 'g8=Q+', promotion: 'q' }), 'promotion');
  assert.equal(moveSound({ san: 'exd6', flags: 'e' }), 'enPassant');
  assert.equal(moveSound({ san: 'Qh7#' }), 'win');
  assert.equal(moveSound({ san: 'e4' }, '1-0'), 'win');
  assert.equal(moveSound({ san: 'e4' }, '1/2-1/2'), 'draw');
});
