import {aggregateGameAccuracy,estimatePerformance,gameTimeClass} from './review-metrics.js';
import {recordedRating,sourcePool} from './game-rating.js';

const BASE='https://iqlfryqkbmadmirkxlvv.supabase.co';
const PUB='sb_publishable_aibr2XZrnl8UOewm8sc3Jg_7BUDQTxG';
const ENDPOINT=BASE+'/functions/v1/ingest-review';
const PENDING='move-by-move/community-pending/v2';
const SENT='move-by-move/community-sent/v2';
const CLIENT='move-by-move/community-client/v1';
const CAPACITY='move-by-move/community-capacity/v2';
const CONSENT='move-by-move/community-consent/v3';
const RETRY='move-by-move/community-retry/v1';
const PREFERENCES='livro-de-lances/preferencias/v1';
const LEGACY_PENDING='move-by-move/community-pending/v1';
const LEGACY_SENT='move-by-move/community-sent/v1';
const BATCH=5,MAX_QUEUE=50,RECENT=256,MAX_PLIES=500,MOVE_RECORD_BYTES=10;
const START_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const clamp=(n,min=0,max=250)=>Math.max(min,Math.min(max,Math.floor(Number(n)||0)));
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const CLASS_ID={brilliant:1,great:2,excellent:3,best:4,theory:5,good:6,inaccuracy:7,mistake:8,'chance-lost':9,blunder:10};
function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')??d;}catch{return d;}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}}
function hasConsent(){
 try{
  if(localStorage.getItem(CONSENT)!=='accepted')return false;
  const prefs=JSON.parse(localStorage.getItem(PREFERENCES)||'{}');
  return prefs?.['community-data']===true;
 }catch{return false;}
}
function clearLegacyQueue(){
 try{localStorage.removeItem(LEGACY_PENDING);localStorage.removeItem(LEGACY_SENT);}catch{}
}
clearLegacyQueue();
function clientId(){
 try{const old=localStorage.getItem(CLIENT);if(typeof old==='string'&&/^[0-9a-f-]{36}$/i.test(old))return old;
 const id=crypto.randomUUID();localStorage.setItem(CLIENT,id);return id;}catch{return crypto.randomUUID();}
}
function uci(m){
 if(!m||! /^[a-h][1-8]$/.test(m.from||'')||! /^[a-h][1-8]$/.test(m.to||''))return null;
 const p=m.promotion||'';if(p&&!/^[qrbn]$/.test(p))return null;return m.from+m.to+p;
}
function moveCode(command){
 if(typeof command!=='string'||! /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(command))return 0xffff;
 const from=(command.charCodeAt(0)-97)+8*(Number(command[1])-1);
 const to=(command.charCodeAt(2)-97)+8*(Number(command[3])-1);
 const promo=command[4]||'';
 const promotion=promo===''?0:promo==='q'?1:promo==='r'?2:promo==='b'?3:4;
 return (from<<10)|(to<<4)|promotion;
}
function scoreValue(evaluation){
 if(!evaluation||typeof evaluation!=='object')return {value:0,valid:false,mate:false};
 if(evaluation.type==='mate'){
  const side=Number(evaluation.white??0);
  return {value:side>0?32000:side<0?-32000:0,valid:true,mate:true};
 }
 const value=Number(evaluation.white??evaluation.value);
 if(!Number.isFinite(value))return {value:0,valid:false,mate:false};
 return {value:clamp(Math.round(value),-32000,32000),valid:true,mate:false};
}
function base64(bytes){
 let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary);
}
function encodeMoveData(path){
 const bytes=new Uint8Array((path.length-1)*MOVE_RECORD_BYTES);
 const view=new DataView(bytes.buffer);
 path.slice(1).forEach((node,index)=>{
  const offset=index*MOVE_RECORD_BYTES;
  const before=scoreValue(node.coach?.before);
  const after=scoreValue(node.coach?.after);
  view.setInt16(offset,before.value,true);
  view.setInt16(offset+2,after.value,true);
  const accuracy=Number.isFinite(node.accuracy)?clamp(Math.round(node.accuracy*10),0,1000):0xffff;
  view.setUint16(offset+4,accuracy,true);
  view.setUint8(offset+6,CLASS_ID[node.classification]||0);
  let flags=0;
  if(before.valid)flags|=1;
  if(after.valid)flags|=2;
  if(node.forced)flags|=4;
  if(before.mate)flags|=8;
  if(after.mate)flags|=16;
  view.setUint8(offset+7,flags);
  const best=node.coach?.best||node.coach?.choices?.[0]?.pv?.[0]||'';
  view.setUint16(offset+8,moveCode(best),true);
 });
 return base64(bytes);
}
function stats(path,side){
 const moves=path.slice(1).filter(n=>n?.move?.color===side),count=k=>moves.filter(n=>n.classification===k).length;
 const accuracy=aggregateGameAccuracy(path,side);
 return {moves:clamp(moves.length),accuracy_tenths:Number.isFinite(accuracy)?clamp(Math.round(accuracy*10),0,1000):null,
 blunders:clamp(count('blunder')),mistakes:clamp(count('mistake')),inaccuracies:clamp(count('inaccuracy')),chances_lost:clamp(count('chance-lost'))};
}
export async function createCommunityReviewSample(path,headers,engine,depth,isImported=true){
 if(!isImported||!Array.isArray(path)||path.length<9||!headers||typeof headers!=='object')return null;
 if(path.length-1>MAX_PLIES||path.slice(1).some(n=>!n?.move||!n?.coach))return null;
 if(!['1-0','0-1','1/2-1/2'].includes(String(headers.Result||'')))return null;
 if(!engine||engine.version!=='19.0.1'||!['full','lite','economy'].includes(engine.mode))return null;
 if(!Number.isInteger(Number(depth))||Number(depth)<1||Number(depth)>30)return null;
 const moves=path.slice(1).map(n=>uci(n?.move));
 if(moves.length<8||moves.some(x=>!x))return null;
 const startFen=String(path[0]?.fen||'');
 if(!startFen||startFen.length>100)return null;
 const initialFen=startFen===START_FEN?null:startFen;
 const result=headers.Result==='1-0'?'w':headers.Result==='0-1'?'b':'d';
 const pool=sourcePool(headers)||'unknown',tc=gameTimeClass(headers)||'unknown';
 const wr=pool==='chesscom'||pool==='lichess'?recordedRating(headers.WhiteElo):null;
 const br=pool==='chesscom'||pool==='lichess'?recordedRating(headers.BlackElo):null;
 const ws=stats(path,'w'),bs=stats(path,'b');
 let we=null,be=null;
 try{const e=estimatePerformance(path,'w',headers);if(e?.available&&Number.isFinite(e.rating))we=Math.round(e.rating);}catch{}
 try{const e=estimatePerformance(path,'b',headers);if(e?.available&&Number.isFinite(e.rating))be=Math.round(e.rating);}catch{}
 const raw=['fca-community-v2',result,initialFen||'standard-start',engine.version,engine.mode,String(depth),moves.join('.')].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 return {
  game_hash:hex(digest),opening_uci:moves.slice(0,24).join(''),moves_uci:moves.join('.'),ply_count:moves.length,
  start_fen:initialFen,move_data_base64:encodeMoveData(path),result,time_class:tc,source_pool:pool,
  white_rating:wr,black_rating:br,rating_source:wr!==null||br!==null?'pgn_unverified':'none',
  white_accuracy_tenths:ws.accuracy_tenths,black_accuracy_tenths:bs.accuracy_tenths,
  white_estimate:we,black_estimate:be,white_moves:ws.moves,black_moves:bs.moves,
  white_blunders:ws.blunders,black_blunders:bs.blunders,white_mistakes:ws.mistakes,black_mistakes:bs.mistakes,
  white_inaccuracies:ws.inaccuracies,black_inaccuracies:bs.inaccuracies,
  white_chances_lost:ws.chances_lost,black_chances_lost:bs.chances_lost,
  engine_version:engine.version,engine_mode:engine.mode,analysis_depth:Number(depth)
 };
}
function queue(){
 const items=read(PENDING,[]);
 return Array.isArray(items)?items.filter(s=>s&&/^[a-f0-9]{64}$/.test(s.game_hash||'')&&Number.isInteger(s.ply_count)&&s.ply_count>=8&&s.ply_count<=MAX_PLIES):[];
}
function schedule(ms=8000){
 if(!hasConsent()||read(CAPACITY,false)||timer!==null)return;
 timer=setTimeout(()=>{timer=null;void flushCommunityQueue();},ms);
}
let timer=null,inflight=null;
function retryState(){
 const state=read(RETRY,null);
 return state&&Number.isFinite(state.retry_at)&&state.retry_at>0?state:null;
}
function clearRetry(){try{localStorage.removeItem(RETRY);}catch{}}
function deferRetry(delay,reason,status){
 const previous=retryState();
 const attempts=Math.min(16,(Number(previous?.attempts)||0)+1);
 const wait=Math.max(1000,Math.min(24*60*60*1000,Math.floor(delay)));
 const retryAt=Date.now()+wait;
 write(RETRY,{retry_at:retryAt,attempts,reason,status});
 schedule(wait);
 return retryAt;
}
function exponentialRetryDelay(){
 const attempts=Math.min(10,(Number(retryState()?.attempts)||0)+1);
 return Math.min(6*60*60*1000,60000*2**Math.min(attempts-1,8));
}
function rateLimitDelay(res){
 const raw=res?.headers?.get?.('Retry-After');
 if(typeof raw==='string'&&/^\d+$/.test(raw.trim()))
  return Math.max(1000,Math.min(24*60*60*1000,Number(raw.trim())*1000));
 const date=typeof raw==='string'?Date.parse(raw):NaN;
 if(Number.isFinite(date))return Math.max(1000,Math.min(24*60*60*1000,date-Date.now()));
 const now=new Date();
 return Math.max(1000,Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)-Date.now()+1000);
}
export function clearCommunityQueue(){
 if(timer!==null)clearTimeout(timer);timer=null;
 try{localStorage.removeItem(PENDING);localStorage.removeItem(RETRY);}catch{}
}
export async function enqueueCommunityReview(path,headers,engine,depth,isImported=true){
 if(!hasConsent())return {queued:false,reason:'consent-required'};
 if(read(CAPACITY,false))return {queued:false,reason:'capacity-reached'};
 const sample=await createCommunityReviewSample(path,headers,engine,depth,isImported);
 if(!sample)return {queued:false,reason:'not-eligible'};
 const pending=queue(),sent=read(SENT,[]);
 if(pending.some(x=>x.game_hash===sample.game_hash)||(Array.isArray(sent)&&sent.includes(sample.game_hash)))return {queued:false,reason:'duplicate'};
 pending.push(sample);if(pending.length>MAX_QUEUE)pending.splice(0,pending.length-MAX_QUEUE);
 if(!write(PENDING,pending))return {queued:false,reason:'storage-unavailable'};
 if(pending.length>=BATCH)void flushCommunityQueue();else schedule();
 return {queued:true,plies:sample.ply_count};
}
export async function flushCommunityQueue(fetcher=globalThis.fetch){
 if(!hasConsent()){clearCommunityQueue();return {sent:0,reason:'consent-required'};}
 if(read(CAPACITY,false))return {sent:0,reason:'capacity-reached'};
 if(inflight)return inflight;
 const retry=retryState();
 if(retry&&retry.retry_at>Date.now()){
  schedule(retry.retry_at-Date.now());
  return {sent:0,reason:'retry-deferred',status:retry.status,retryAt:retry.retry_at};
 }
 const pending=queue();if(!pending.length||typeof fetcher!=='function')return {sent:0};
 if(timer!==null)clearTimeout(timer);timer=null;
 const batch=pending.slice(0,BATCH),hashes=new Set(batch.map(x=>x.game_hash));
 inflight=(async()=>{
  try{
   const res=await fetcher(ENDPOINT,{method:'POST',headers:{apikey:PUB,'Content-Type':'application/json'},
    body:JSON.stringify({client_id:clientId(),samples:batch}),keepalive:true});
   const data=await res.json().catch(()=>({}));
   if(res.status===429||data?.rate_limited){
    const retryAt=deferRetry(rateLimitDelay(res),'rate-limited',res.status);
    return {sent:0,status:res.status,reason:'rate-limited',retryAt};
   }
   const accepted=data?.accepted,duplicates=data?.duplicates;
   const fullyAccounted=Number.isSafeInteger(accepted)&&accepted>=0&&Number.isSafeInteger(duplicates)&&duplicates>=0&&accepted+duplicates===batch.length;
   if(data?.capacity_reached&&!fullyAccounted){
    write(CAPACITY,true);
    return {sent:0,status:res.status,reason:'capacity-reached',pending:batch.length};
   }
   if(res.ok&&fullyAccounted){
    const current=queue(),remaining=current.filter(x=>!hashes.has(x.game_hash));
    if(!write(PENDING,remaining)){
     const retryAt=deferRetry(exponentialRetryDelay(),'storage-error',res.status);
     return {sent:0,status:res.status,reason:'storage-unavailable',retryAt};
    }
    const recent=read(SENT,[]);
    write(SENT,[...new Set([...(Array.isArray(recent)?recent:[]),...hashes])].slice(-RECENT));
    clearRetry();
    if(data?.capacity_reached)write(CAPACITY,true);
    else if(remaining.length)schedule(1000);
    return {sent:batch.length,status:res.status,result:data,reason:data?.capacity_reached?'capacity-reached':undefined};
   }
   if(data?.capacity_reached){
    write(CAPACITY,true);
    return {sent:0,status:res.status,reason:'capacity-reached',pending:batch.length};
   }
   const reason=res.ok?'incomplete-ack':'http-error';
   const retryAt=deferRetry(exponentialRetryDelay(),reason,res.status);
   return {sent:0,status:res.status,reason,retryAt};
  }catch{
   const retryAt=deferRetry(exponentialRetryDelay(),'network-error',0);
   return {sent:0,status:0,reason:'network-error',retryAt};
  }finally{inflight=null;}
 })();
 return inflight;
}
if(typeof window!=='undefined'){
 window.addEventListener('pagehide',()=>{if(hasConsent())void flushCommunityQueue();});
 if(hasConsent()&&queue().length)schedule(1000);
}
