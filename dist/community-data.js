import {aggregateGameAccuracy,estimatePerformance,gameTimeClass} from './review-metrics.js';
import {recordedRating,sourcePool} from './game-rating.js';
const BASE='https://iqlfryqkbmadmirkxlvv.supabase.co';
const PUB='sb_publishable_aibr2XZrnl8UOewm8sc3Jg_7BUDQTxG';
const ENDPOINT=BASE+'/functions/v1/ingest-review';
const PENDING='move-by-move/community-pending/v1',SENT='move-by-move/community-sent/v1',CLIENT='move-by-move/community-client/v1';
const BATCH=10,MAX_QUEUE=100,RECENT=256;
let timer=null,inflight=null;
const clamp=n=>Math.max(0,Math.min(250,Math.floor(Number(n)||0)));
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')??d;}catch{return d;}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}}
function clientId(){
 try{const old=localStorage.getItem(CLIENT);if(typeof old==='string'&&/^[0-9a-f-]{36}$/i.test(old))return old;
 const id=crypto.randomUUID();localStorage.setItem(CLIENT,id);return id;}catch{return crypto.randomUUID();}
}
function uci(m){if(!m||! /^[a-h][1-8]$/.test(m.from||'')||! /^[a-h][1-8]$/.test(m.to||''))return null;const p=m.promotion||'';if(p&&!/^[qrbn]$/.test(p))return null;return m.from+m.to+p;}
function stats(path,side){
 const moves=path.slice(1).filter(n=>n?.move?.color===side),count=k=>moves.filter(n=>n.classification===k).length;
 const accuracy=aggregateGameAccuracy(path,side);
 return {moves:clamp(moves.length),accuracy_tenths:Number.isFinite(accuracy)?Math.max(0,Math.min(1000,Math.round(accuracy*10))):null,
 blunders:clamp(count('blunder')),mistakes:clamp(count('mistake')),inaccuracies:clamp(count('inaccuracy')),chances_lost:clamp(count('chance-lost'))};
}
export async function createCommunityReviewSample(path,headers,engine,depth,isImported=true){
 if(!isImported||!Array.isArray(path)||path.length<25||!headers||typeof headers!=='object')return null;
 if(!['1-0','0-1','1/2-1/2'].includes(String(headers.Result||'')))return null;
 if(!engine||engine.version!=='19.0.1'||!['full','lite','economy'].includes(engine.mode))return null;
 if(!Number.isInteger(Number(depth))||Number(depth)<1||Number(depth)>30)return null;
 const moves=path.slice(1).map(n=>uci(n?.move));if(moves.length<24||moves.some(x=>!x))return null;
 const result=headers.Result==='1-0'?'w':headers.Result==='0-1'?'b':'d';
 const pool=sourcePool(headers)||'unknown',tc=gameTimeClass(headers)||'unknown';
 const wr=pool==='chesscom'||pool==='lichess'?recordedRating(headers.WhiteElo):null;
 const br=pool==='chesscom'||pool==='lichess'?recordedRating(headers.BlackElo):null;
 const ws=stats(path,'w'),bs=stats(path,'b');
 let we=null,be=null;
 try{const e=estimatePerformance(path,'w',headers);if(e?.available&&Number.isFinite(e.rating))we=Math.round(e.rating);}catch{}
 try{const e=estimatePerformance(path,'b',headers);if(e?.available&&Number.isFinite(e.rating))be=Math.round(e.rating);}catch{}
 const raw=['fca-community-v1',result,engine.version,engine.mode,String(depth),moves.join('.')].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 return {game_hash:hex(digest),opening_uci:moves.slice(0,24).join(''),result,time_class:tc,source_pool:pool,
 white_rating:wr,black_rating:br,rating_source:wr!==null||br!==null?'pgn_unverified':'none',
 white_accuracy_tenths:ws.accuracy_tenths,black_accuracy_tenths:bs.accuracy_tenths,white_estimate:we,black_estimate:be,
 white_moves:ws.moves,black_moves:bs.moves,white_blunders:ws.blunders,black_blunders:bs.blunders,
 white_mistakes:ws.mistakes,black_mistakes:bs.mistakes,white_inaccuracies:ws.inaccuracies,black_inaccuracies:bs.inaccuracies,
 white_chances_lost:ws.chances_lost,black_chances_lost:bs.chances_lost,
 engine_version:engine.version,engine_mode:engine.mode,analysis_depth:Number(depth)};
}
function queue(){const x=read(PENDING,[]);return Array.isArray(x)?x.filter(s=>s&&/^[a-f0-9]{64}$/.test(s.game_hash||'')):[];}
function schedule(ms=8000){if(timer!==null)return;timer=setTimeout(()=>{timer=null;void flushCommunityQueue();},ms);timer?.unref?.();}
export function clearCommunityQueue(){if(timer!==null)clearTimeout(timer);timer=null;try{localStorage.removeItem(PENDING);}catch{}}
export async function enqueueCommunityReview(path,headers,engine,depth,isImported=true){
 const sample=await createCommunityReviewSample(path,headers,engine,depth,isImported);if(!sample)return {queued:false,reason:'not-eligible'};
 const pending=queue(),sent=read(SENT,[]);
 if(pending.some(x=>x.game_hash===sample.game_hash)||(Array.isArray(sent)&&sent.includes(sample.game_hash)))return {queued:false,reason:'duplicate'};
 pending.push(sample);if(pending.length>MAX_QUEUE)pending.splice(0,pending.length-MAX_QUEUE);
 if(!write(PENDING,pending))return {queued:false,reason:'storage-unavailable'};
 if(pending.length>=BATCH)void flushCommunityQueue();else schedule();
 return {queued:true};
}
export async function flushCommunityQueue(fetcher=globalThis.fetch){
 if(inflight)return inflight;const pending=queue();if(!pending.length||typeof fetcher!=='function')return {sent:0};
 if(timer!==null)clearTimeout(timer);timer=null;
 const batch=pending.slice(0,BATCH),hashes=new Set(batch.map(x=>x.game_hash));
 inflight=(async()=>{
  try{
   const res=await fetcher(ENDPOINT,{method:'POST',headers:{apikey:PUB,'Content-Type':'application/json'},
    body:JSON.stringify({client_id:clientId(),samples:batch}),keepalive:true});
   if(res.ok||res.status===202||res.status===429||(res.status>=400&&res.status<500)){
    const current=queue();write(PENDING,current.filter(x=>!hashes.has(x.game_hash)));
    const recent=read(SENT,[]);write(SENT,[...new Set([...(Array.isArray(recent)?recent:[]),...hashes])].slice(-RECENT));
    const data=await res.json().catch(()=>({}));if(res.ok&&current.length>batch.length)schedule(1000);
    return {sent:batch.length,status:res.status,result:data};
   }
   schedule(60000);return {sent:0,status:res.status};
  }catch{schedule(60000);return {sent:0,status:0};}finally{inflight=null;}
 })();return inflight;
}
if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{void flushCommunityQueue();});
