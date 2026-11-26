import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCommunityReviewSample,enqueueCommunityReview,flushCommunityQueue,clearCommunityQueue} from '../dist/community-data.js';

const data=new Map();
globalThis.localStorage={
 getItem:key=>data.has(key)?data.get(key):null,
 setItem:(key,value)=>data.set(key,String(value)),
 removeItem:key=>data.delete(key)
};
const START_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const CONSENT='move-by-move/community-consent/v2';
const PREFERENCES='livro-de-lances/preferencias/v1';

function allowConsent(){
 data.set(CONSENT,'accepted');
 data.set(PREFERENCES,JSON.stringify({'community-data':true}));
}
function fixture(plies=50){
 const path=[{move:null,fen:START_FEN}];
 const fromTo=['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6'];
 for(let i=0;i<plies;i++){
  const move=fromTo[i%fromTo.length];
  const side=i%2?'b':'w';
  const next=fromTo[(i+1)%fromTo.length];
  path.push({
   move:{from:move.slice(0,2),to:move.slice(2,4),color:side},
   accuracy:91,
   classification:['good','inaccuracy','mistake','blunder','chance-lost'][i%5],
   forced:i%11===0,
   coach:{
    before:{type:'cp',value:30,white:30},
    after:{type:'cp',value:20,white:-20},
    best:next,
    choices:[{pv:[next]}]
   }
  });
 }
 const headers={
  Result:'1-0',Site:'https://www.chess.com/game/live/12345',TimeControl:'180+2',
  White:'Private White Name',Black:'Private Black Name',WhiteElo:'1500',BlackElo:'1600',
  Event:'Private event',Annotator:'Private annotation'
 };
 const engine={version:'19.0.1',mode:'lite',name:'Lite'};
 return {path,headers,engine};
}

test('full-game sample contains every ply and compact per-move metrics without identity',async()=>{
 const {path,headers,engine}=fixture(50);
 const sample=await createCommunityReviewSample(path,headers,engine,14,true);
 assert.ok(sample);
 assert.match(sample.game_hash,/^[a-f0-9]{64}$/);
 assert.equal(sample.ply_count,50);
 assert.equal(sample.moves_uci.split('.').length,50);
 assert.equal(sample.moves_uci.split('.')[0],'e2e4');
 assert.equal(sample.opening_uci, sample.moves_uci.split('.').slice(0,24).join(''));
 assert.equal(sample.start_fen,null);
 const bytes=Buffer.from(sample.move_data_base64,'base64');
 assert.equal(bytes.length,50*10);
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert.equal(view.getInt16(0,true),30);
 assert.equal(view.getInt16(2,true),-20);
 assert.equal(view.getUint16(4,true),910);
 assert.equal(view.getUint8(6),6);
 assert.equal(sample.rating_source,'pgn_unverified');
 const serialized=JSON.stringify(sample);
 for(const privateValue of ['Private White Name','Private Black Name','Private event','Private annotation','chess.com/game','PGN','FEN','username','TimeControl']) {
  assert.equal(serialized.includes(privateValue),false,privateValue+' leaked');
 }
});

test('custom initial FEN is preserved only when the game does not start from the standard board',async()=>{
 const {path,headers,engine}=fixture(12);
 path[0].fen='4k3/8/8/8/8/8/8/4K3 w - - 0 1';
 const sample=await createCommunityReviewSample(path,headers,engine,14,true);
 assert.equal(sample.start_fen,path[0].fen);
});

test('ineligible local, incomplete, oversized, unfinished and unsupported-engine games are not collected',async()=>{
 const {path,headers,engine}=fixture();
 assert.equal(await createCommunityReviewSample(path,headers,engine,14,false),null);
 assert.equal(await createCommunityReviewSample(path.slice(0,8),headers,engine,14,true),null);
 assert.equal(await createCommunityReviewSample(path.slice(0,20).map((node,index)=>index?{...node,coach:null}:node),headers,engine,14,true),null);
 const oversized=fixture(500);
 assert.equal(await createCommunityReviewSample([...oversized.path,...oversized.path.slice(1)],headers,engine,14,true),null);
 assert.equal(await createCommunityReviewSample(path,{...headers,Result:'*'},engine,14,true),null);
 assert.equal(await createCommunityReviewSample(path,headers,{...engine,version:'17.1'},14,true),null);
});

test('collection is consent-gated even when an old preference is true',async()=>{
 data.clear();
 data.set(PREFERENCES,JSON.stringify({'community-data':true}));
 const {path,headers,engine}=fixture();
 assert.equal((await enqueueCommunityReview(path,headers,engine,14,true)).reason,'consent-required');
 assert.equal(data.has('move-by-move/community-pending/v2'),false);
});

test('queue batches, sends complete games and deduplicates reviews',async()=>{
 data.clear();
 allowConsent();
 clearCommunityQueue();
 const {path,headers,engine}=fixture();
 assert.equal((await enqueueCommunityReview(path,headers,engine,14,true)).queued,true);
 let body;
 const result=await flushCommunityQueue(async(_url,options)=>{
  body=JSON.parse(options.body);
  return {ok:true,status:200,json:async()=>({accepted:1,remaining_capacity:49999})};
 });
 assert.equal(result.sent,1);
 assert.equal(body.samples.length,1);
 assert.equal(body.samples[0].ply_count,50);
 assert.equal(body.samples[0].moves_uci.split('.').length,50);
 assert.match(body.client_id,/^[0-9a-f-]{36}$/i);
 assert.equal(JSON.stringify(body).includes('Private White Name'),false);
 assert.deepEqual(JSON.parse(data.get('move-by-move/community-pending/v2')||'[]'),[]);
 assert.equal((await enqueueCommunityReview(path,headers,engine,14,true)).reason,'duplicate');
 clearCommunityQueue();
});

test('revoking consent stops transmission and clears queued full games',async()=>{
 data.clear();
 allowConsent();
 const {path,headers,engine}=fixture();
 await enqueueCommunityReview(path,headers,engine,14,true);
 data.set(CONSENT,'declined');
 let calls=0;
 const result=await flushCommunityQueue(async()=>{calls++;return {ok:true,status:200,json:async()=>({accepted:1})};});
 assert.equal(result.reason,'consent-required');
 assert.equal(calls,0);
 assert.deepEqual(JSON.parse(data.get('move-by-move/community-pending/v2')||'[]'),[]);
});
