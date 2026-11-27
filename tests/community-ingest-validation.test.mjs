import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {Chess} from 'chess.js';
import {cleanCommunitySample} from '../supabase/functions/ingest-review/validation.js';

globalThis.crypto??=webcrypto;

const MOVES=[
 'e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6',
 'e1g1','f8e7','f1e1','b7b5','a4b3','d7d6','c2c3','e8g8',
 'h2h3','c8b7','d2d4'
];
const PROMOTION_CODE={q:1,r:2,b:3,n:4};

function packedMove(uci){
 const from=(uci.charCodeAt(0)-97)+8*(Number(uci[1])-1);
 const to=(uci.charCodeAt(2)-97)+8*(Number(uci[3])-1);
 return (from<<10)|(to<<4)|(PROMOTION_CODE[uci[4]]||0);
}
function countClass(target,classification,side){
 if(classification===10)target[side].blunders++;
 if(classification===8)target[side].mistakes++;
 if(classification===7)target[side].inaccuracies++;
 if(classification===9)target[side].chances_lost++;
}
async function hashFor(result,startFen,engineVersion,engineMode,depth,moves){
 const raw=['fca-community-v2',result,startFen||'standard-start',engineVersion,engineMode,String(depth),moves.join('.')].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 return Buffer.from(digest).toString('hex');
}
async function buildSample({moves=MOVES,startFen=null,result='w'}={}){
 const chess=startFen?new Chess(startFen):new Chess();
 const bytes=new Uint8Array(moves.length*10);
 const view=new DataView(bytes.buffer);
 const stats={
  w:{moves:0,blunders:0,mistakes:0,inaccuracies:0,chances_lost:0},
  b:{moves:0,blunders:0,mistakes:0,inaccuracies:0,chances_lost:0}
 };
 const ids=[6,7,8,10,9];
 let currentScore=30;
 for(let index=0;index<moves.length;index++){
  const uci=moves[index];
  const side=chess.turn();
  const legal=chess.moves({verbose:true});
  const actual=legal.find(move=>move.from===uci.slice(0,2)&&move.to===uci.slice(2,4)&&
   (move.promotion||'')===(uci[4]||''));
  const best=actual||legal[0];
  const offset=index*10;
  const beforeScore=currentScore;
  const afterScore=currentScore+((index%3)-1)*5;
  view.setInt16(offset,beforeScore,true);
  view.setInt16(offset+2,afterScore,true);
  currentScore=afterScore;
  view.setUint16(offset+4,900,true);
  const classification=ids[index%ids.length];
  view.setUint8(offset+6,classification);
  view.setUint8(offset+7,3);
  if(best)view.setUint16(offset+8,packedMove(best.from+best.to+(best.promotion||'')),true);
  else view.setUint16(offset+8,0xffff,true);
  stats[side].moves++;
  countClass(stats,classification,side);
  if(actual)chess.move({from:actual.from,to:actual.to,...(actual.promotion?{promotion:actual.promotion}:{})});
 }
 const engineVersion='19.0.1',engineMode='lite',analysisDepth=14;
 return {
  game_hash:await hashFor(result,startFen,engineVersion,engineMode,analysisDepth,moves),
  opening_uci:moves.slice(0,24).join(''),
  moves_uci:moves.join('.'),
  ply_count:moves.length,
  start_fen:startFen,
  move_data_base64:Buffer.from(bytes).toString('base64'),
  result,time_class:'rapid',source_pool:'chesscom',
  white_rating:1600,black_rating:1550,rating_source:'pgn_unverified',
  white_accuracy_tenths:900,black_accuracy_tenths:900,
  white_estimate:1550,black_estimate:1500,
  white_moves:stats.w.moves,black_moves:stats.b.moves,
  white_blunders:stats.w.blunders,black_blunders:stats.b.blunders,
  white_mistakes:stats.w.mistakes,black_mistakes:stats.b.mistakes,
  white_inaccuracies:stats.w.inaccuracies,black_inaccuracies:stats.b.inaccuracies,
  white_chances_lost:stats.w.chances_lost,black_chances_lost:stats.b.chances_lost,
  engine_version:engineVersion,engine_mode:engineMode,analysis_depth:analysisDepth
 };
}
async function rewriteHash(sample){
 const moves=sample.moves_uci.split('.');
 sample.game_hash=await hashFor(
  sample.result,sample.start_fen,sample.engine_version,sample.engine_mode,sample.analysis_depth,moves
 );
 return sample;
}

test('a complete legal Ruy Lopez mainline with consistent per-ply metadata is accepted',async()=>{
 const sample=await buildSample();
 const clean=await cleanCommunitySample(sample);
 assert.ok(clean);
 assert.equal(clean.ply_count,19);
 assert.equal(clean.white_moves,10);
 assert.equal(clean.black_moves,9);
 assert.equal(clean.opening_uci,MOVES.slice(0,24).join(''));
});

test('illegal UCI moves are rejected even when the attacker recomputes the public game hash',async()=>{
 const sample=await buildSample();
 const moves=sample.moves_uci.split('.');
 moves[0]='e2e5';
 sample.moves_uci=moves.join('.');
 sample.opening_uci=moves.slice(0,24).join('');
 await rewriteHash(sample);
 assert.equal(await cleanCommunitySample(sample),null);
});

test('the server recomputes the canonical hash rather than trusting a client-provided hash',async()=>{
 const sample=await buildSample();
 sample.game_hash='a'.repeat(64);
 assert.equal(await cleanCommunitySample(sample),null);
});

test('valid non-standard FEN positions are accepted after legal replay',async()=>{
 const fen='4k2r/8/8/8/8/8/8/R3K2R w KQk - 0 1';
 const chess=new Chess(fen);
 const moves=[];
 for(let i=0;i<12;i++){
  const legal=chess.moves({verbose:true});
  assert.ok(legal.length);
  const move=legal[(i*7+3)%legal.length];
  moves.push(move.from+move.to+(move.promotion||''));
  chess.move({from:move.from,to:move.to,...(move.promotion?{promotion:move.promotion}:{})});
 }
 const sample=await buildSample({moves,startFen:fen});
 assert.ok(await cleanCommunitySample(sample));
});

test('invalid FEN positions are rejected',async()=>{
 const sample=await buildSample();
 sample.start_fen='8/8/8/8/8/8/8/8 w - - 0 1';
 await rewriteHash(sample);
 assert.equal(await cleanCommunitySample(sample),null);
});

test('inconsistent color move totals and classification totals are rejected',async()=>{
 const first=await buildSample();
 first.white_moves++;
 assert.equal(await cleanCommunitySample(first),null);
 const second=await buildSample();
 second.black_blunders++;
 assert.equal(await cleanCommunitySample(second),null);
});

test('packed best moves must be legal in the position before the played move',async()=>{
 const sample=await buildSample();
 const bytes=Buffer.from(sample.move_data_base64,'base64');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 view.setUint16(8,packedMove('a1a8'),true);
 sample.move_data_base64=bytes.toString('base64');
 assert.equal(await cleanCommunitySample(sample),null);
});

test('per-ply binary values reject reserved flags, unknown classes and out-of-range accuracy',async()=>{
 for(const mutation of [
  view=>view.setUint8(7,0x80),
  view=>view.setUint8(6,11),
  view=>view.setUint16(4,1001,true),
  view=>view.setInt16(0,32001,true),
  view=>view.setUint8(7,8)
 ]){
  const sample=await buildSample();
  const bytes=Buffer.from(sample.move_data_base64,'base64');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  mutation(view);
  sample.move_data_base64=bytes.toString('base64');
  assert.equal(await cleanCommunitySample(sample),null);
 }
});

test('time classes and source metadata cannot carry estimates the client model would not produce',async()=>{
 const sample=await buildSample();
 sample.time_class='classical';
 assert.equal(await cleanCommunitySample(sample),null);
 const unknown=await buildSample();
 unknown.source_pool='unknown';
 unknown.white_rating=null;
 unknown.black_rating=null;
 unknown.rating_source='none';
 assert.equal(await cleanCommunitySample(unknown),null);
});


test('evaluation values must remain continuous between one move and the next position',async()=>{
 const sample=await buildSample();
 const bytes=Buffer.from(sample.move_data_base64,'base64');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 view.setInt16(10,1500,true);
 sample.move_data_base64=bytes.toString('base64');
 assert.equal(await cleanCommunitySample(sample),null);
});
