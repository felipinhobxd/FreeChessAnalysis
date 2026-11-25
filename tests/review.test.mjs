import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { missedOpportunity, aspectEvidence } from '../dist/review-evidence.js';
import { estimatePerformance, phaseForPosition, gameTimeClass } from '../dist/review-metrics.js';
import { decisionProfile, predictBand } from '../dist/decision-profile.js';
import { performanceModel } from '../dist/performance-model.js';

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

test('a winning mate remains available after the move', () => {
  const fen='7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
  const before=mate(1,['g6g7']);
  const retained=position(fen,'Qh5+',before,mate(3));
  const previouslySeen=position(fen,'Qh5+',before,cp(0,[],10),[mate(3,['g6h5'])]);
  assert.equal(missedOpportunity(Chess,retained.parent,retained),null);
  assert.equal(missedOpportunity(Chess,previouslySeen.parent,previouslySeen),null);
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
  assert.equal(estimatePerformance([{}],'b',{TimeControl:'60+0'}).reason,'time-control');
  assert.equal(gameTimeClass({TimeControl:'300+5'}),'blitz');
  assert.equal(gameTimeClass({TimeControl:'900+10'}),'rapid');
  const band=predictBand(performanceModel.center,performanceModel);
  assert.ok(band.low<band.rating && band.rating<band.high);
  assert.equal(predictBand(performanceModel.center.map(x=>x+100),performanceModel),null);
});
