import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {Chess} from 'chess.js';
import {createIngestHandler} from '../supabase/functions/ingest-review/handler.js';

globalThis.crypto??=webcrypto;

const ORIGIN='https://freechessanalysis.vercel.app';
const PUBLIC_KEY='sb_publishable_test_key';
const SERVICE_KEY='service-role-test-secret';
const PROJECT_URL='https://example-project.supabase.co';
const FIXED_NOW=new Date('2026-11-27T12:00:00.000Z');
const MOVES=['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6'];

function encodeBestMove(uci){
 const from=uci.charCodeAt(0)-97+8*(Number(uci[1])-1);
 const to=uci.charCodeAt(2)-97+8*(Number(uci[3])-1);
 return (from<<10)|(to<<4);
}
async function gameHash(result,moves){
 const raw=['fca-community-v2',result,'standard-start','19.0.1','lite','14',moves.join('.')].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 return Buffer.from(digest).toString('hex');
}
async function validSample(result='w',moves=MOVES){
 const chess=new Chess();
 const bytes=new Uint8Array(moves.length*10);
 const view=new DataView(bytes.buffer);
 const counts={w:0,b:0};
 for(let index=0;index<moves.length;index++){
  const uci=moves[index],side=chess.turn();
  const legal=chess.moves({verbose:true});
  const move=legal.find(item=>item.from===uci.slice(0,2)&&item.to===uci.slice(2,4));
  assert.ok(move,'test fixture must be legal: '+uci);
  counts[side]++;
  const offset=index*10;
  view.setInt16(offset,0,true);
  view.setInt16(offset+2,0,true);
  view.setUint16(offset+4,900,true);
  view.setUint8(offset+6,6);
  view.setUint8(offset+7,3);
  view.setUint16(offset+8,encodeBestMove(uci),true);
  chess.move({from:move.from,to:move.to});
 }
 return {
  game_hash:await gameHash(result,moves),
  opening_uci:moves.join(''),
  moves_uci:moves.join('.'),
  ply_count:moves.length,
  start_fen:null,
  move_data_base64:Buffer.from(bytes).toString('base64'),
  result,time_class:'unknown',source_pool:'unknown',rating_source:'none',
  white_rating:null,black_rating:null,white_accuracy_tenths:900,black_accuracy_tenths:900,
  white_estimate:null,black_estimate:null,
  white_moves:counts.w,black_moves:counts.b,
  white_blunders:0,black_blunders:0,
  white_mistakes:0,black_mistakes:0,
  white_inaccuracies:0,black_inaccuracies:0,
  white_chances_lost:0,black_chances_lost:0,
  engine_version:'19.0.1',engine_mode:'lite',analysis_depth:14
 };
}
function env(name){
 return ({
  SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:PUBLIC_KEY}),
  SUPABASE_SECRET_KEYS:JSON.stringify({default:SERVICE_KEY}),
  SUPABASE_URL:PROJECT_URL
 })[name]||'';
}
function request({method='POST',origin=ORIGIN,apikey=PUBLIC_KEY,body,contentType='application/json',headers={}}={}){
 const requestHeaders=new Headers(headers);
 if(origin!==null)requestHeaders.set('Origin',origin);
 if(apikey!==null)requestHeaders.set('apikey',apikey);
 if(contentType!==null)requestHeaders.set('Content-Type',contentType);
 return new Request('https://edge.test/functions/v1/ingest-review',{
  method,headers:requestHeaders,
  ...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})
 });
}
function makeHandler(fetcher=async()=>new Response(JSON.stringify({
 accepted:1,duplicates:0,capacity_reached:false,remaining_capacity:39999
 }),{status:200})){
 return createIngestHandler({
  getEnv:env,fetcher,now:()=>new Date(FIXED_NOW)
 });
}
const payload=async samples=>({client_id:'123e4567-e89b-42d3-a456-426614174000',samples});

test('OPTIONS preflight returns the expected CORS headers without touching the database',async()=>{
 let calls=0;
 const response=await makeHandler(async()=>{calls++;throw new Error('must not call DB');})(
  request({method:'OPTIONS',body:undefined,apikey:null,contentType:null})
 );
 assert.equal(response.status,204);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),ORIGIN);
 assert.match(response.headers.get('Access-Control-Allow-Methods'),/POST/);
 assert.match(response.headers.get('Access-Control-Allow-Headers'),/apikey/);
 assert.equal(calls,0);
});

test('non-POST requests are rejected with an Allow header',async()=>{
 const response=await makeHandler()(request({method:'GET',body:undefined}));
 assert.equal(response.status,405);
 assert.equal(response.headers.get('Allow'),'POST, OPTIONS');
});

test('unapproved origins and invalid publishable keys are rejected before database access',async()=>{
 let calls=0;
 const handler=makeHandler(async()=>{calls++;return new Response('{}');});
 const origin=await handler(request({origin:'https://attacker.example',body:{}}));
 assert.equal(origin.status,403);
 assert.equal(origin.headers.get('Access-Control-Allow-Origin'),null);
 const key=await handler(request({apikey:'wrong-key',body:{}}));
 assert.equal(key.status,401);
 assert.equal(calls,0);
});

test('non-JSON payloads and oversized declared bodies are rejected early',async()=>{
 const handler=makeHandler();
 const wrongType=await handler(request({body:'{}',contentType:'text/plain'}));
 assert.equal(wrongType.status,415);
 const tooLarge=await handler(request({body:'{}',headers:{'content-length':'131073'}}));
 assert.equal(tooLarge.status,413);
});

test('malformed JSON, extra top-level fields, and invalid batches never reach PostgREST',async()=>{
 let calls=0;
 const handler=makeHandler(async()=>{calls++;return new Response('{}');});
 assert.equal((await handler(request({body:'{'}))).status,400);
 assert.equal((await handler(request({body:{client_id:'123e4567-e89b-42d3-a456-426614174000',samples:[],unexpected:true}}))).status,400);
 assert.equal((await handler(request({body:{client_id:'bad',samples:[]}}))).status,400);
 assert.equal(calls,0);
});

test('missing or malformed trusted edge IP fails closed before validation and database access',async()=>{
 let calls=0;
 const handler=makeHandler(async()=>{calls++;return new Response('{}');});
 const response=await handler(request({
  body:await payload([await validSample()]),
  headers:{'x-forwarded-for':'203.0.113.25','x-real-ip':'203.0.113.25'}
 }));
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'Client network unavailable');
 assert.equal(calls,0);
});

test('illegal or structurally invalid samples return 400 without calling PostgREST',async()=>{
 let calls=0;
 const handler=makeHandler(async()=>{calls++;return new Response('{}');});
 const sample=await validSample();
 sample.moves_uci='e2e5.'+sample.moves_uci.split('.').slice(1).join('.');
 const response=await handler(request({body:await payload([sample]),headers:{'cf-connecting-ip':'203.0.113.25'}}));
 assert.equal(response.status,400);
 assert.equal((await response.json()).error,'Invalid or illegal game sample');
 assert.equal(calls,0);
});

test('valid HTTP submission sends only sanitized, HMAC-protected values to the service-role RPC',async()=>{
 const sample=await validSample();
 let call;
 const handler=makeHandler(async(url,options)=>{
  call={url,options};
  return new Response(JSON.stringify({
   accepted:1,duplicates:0,capacity_reached:false,remaining_capacity:39999
  }),{status:200});
 });
 const response=await handler(request({
  body:await payload([sample]),
  headers:{
   'cf-connecting-ip':'203.0.113.25',
   'x-forwarded-for':'198.51.100.99'
  }
 }));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{
  accepted:1,duplicates:0,capacity_reached:false,remaining_capacity:39999
 });
 assert.equal(call.url,PROJECT_URL+'/rest/v1/rpc/fca_ingest_community_games');
 assert.equal(call.options.headers.apikey,SERVICE_KEY);
 assert.equal(call.options.headers.Authorization,'Bearer '+SERVICE_KEY);
 const rpc=JSON.parse(call.options.body);
 assert.match(rpc.p_client_hash,/^\\x[a-f0-9]{64}$/);
 assert.match(rpc.p_network_hash,/^\\x[a-f0-9]{64}$/);
 assert.notEqual(rpc.p_network_hash,'\\x'+Buffer.from('203.0.113.25').toString('hex'));
 assert.notEqual(rpc.p_samples[0].game_hash,sample.game_hash);
 assert.equal(rpc.p_samples[0].moves_uci,sample.moves_uci);
 assert.equal(rpc.p_samples[0].ply_count,8);
});

test('database rate limits are translated to HTTP 429 with an exposed UTC Retry-After header',async()=>{
 const handler=makeHandler(async()=>new Response(JSON.stringify({
  accepted:0,duplicates:0,rate_limited:true
 }),{status:200}));
 const response=await handler(request({
  body:await payload([await validSample()]),
  headers:{'cf-connecting-ip':'203.0.113.25'}
 }));
 assert.equal(response.status,429);
 assert.equal(response.headers.get('Retry-After'),'43200');
 assert.match(response.headers.get('Access-Control-Expose-Headers'),/Retry-After/);
 assert.deepEqual(await response.json(),{accepted:0,duplicates:0,rate_limited:true});
});

test('capacity with a partial acknowledgement returns 202 and preserves the accounting fields',async()=>{
 const sample=await validSample();
 const second=await validSample('b');
 const handler=makeHandler(async()=>new Response(JSON.stringify({
  accepted:1,duplicates:0,capacity_reached:true,remaining_capacity:0
 }),{status:200}));
 const response=await handler(request({
  body:await payload([sample,second]),
  headers:{'cf-connecting-ip':'203.0.113.25'}
 }));
 assert.equal(response.status,202);
 assert.deepEqual(await response.json(),{
  accepted:1,duplicates:0,capacity_reached:true,remaining_capacity:0
 });
});

test('database errors and timeouts return sanitized 503 responses',async()=>{
 const body=await payload([await validSample()]);
 const failed=await makeHandler(async()=>new Response('secret database detail',{status:500}))(
  request({body,headers:{'cf-connecting-ip':'203.0.113.25'}})
 );
 assert.equal(failed.status,503);
 assert.equal((await failed.json()).error,'Could not save full-game statistics');

 const unavailable=await makeHandler(async()=>{throw new Error('private connection details');})(
  request({body,headers:{'cf-connecting-ip':'203.0.113.25'}})
 );
 assert.equal(unavailable.status,503);
 assert.equal((await unavailable.json()).error,'Database unavailable');
});

test('malformed PostgREST acknowledgements fail closed instead of claiming success',async()=>{
 const body=await payload([await validSample()]);
 for(const data of [
  {accepted:'1',duplicates:0,capacity_reached:false,remaining_capacity:5},
  {accepted:1,duplicates:0,capacity_reached:false,remaining_capacity:-1},
  {accepted:1,duplicates:0,capacity_reached:false},
  {accepted:0,duplicates:0,capacity_reached:false,remaining_capacity:5}
 ]){
  const response=await makeHandler(async()=>new Response(JSON.stringify(data),{status:200}))(
   request({body,headers:{'cf-connecting-ip':'203.0.113.25'}})
  );
  assert.equal(response.status,503);
 }
});


test('PostgREST abort timeout is enforced and returned as a sanitized 503',async()=>{
 const body=await payload([await validSample()]);
 const handler=createIngestHandler({
  getEnv:env,
  now:()=>new Date(FIXED_NOW),
  dbTimeoutMs:5,
  fetcher:(_url,{signal})=>new Promise((resolve,reject)=>{
   const abort=()=>reject(signal.reason||new Error('aborted'));
   if(signal.aborted){abort();return;}
   signal.addEventListener('abort',abort,{once:true});
  })
 });
 const response=await handler(request({body,headers:{'cf-connecting-ip':'203.0.113.25'}}));
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'Database unavailable');
});
