const ORIGINS=new Set(['https://freechessanalysis.vercel.app','http://localhost:8787','http://127.0.0.1:8787']);
const MAX_BYTES=131072,BATCH=5,MAX_PLIES=500;
const HASH=/^[a-f0-9]{64}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const START_FEN=/^[prnbqkPRNBQK1-8/]+ [wb] (?:-|[KQkq]{1,4}) (?:-|[a-h][36]) [0-9]+ [0-9]+$/;
const CORS={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Max-Age':'86400','Vary':'Origin'};
function reply(body,status,origin){
 return new Response(body===null?null:JSON.stringify(body),{status,headers:{...CORS,...(ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function secret(name,fallback){
 try{const value=JSON.parse(Deno.env.get(name)||'{}');if(typeof value.default==='string')return value.default;}catch{}
 return fallback?Deno.env.get(fallback)||'':'';
}
async function signer(secretKey){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secretKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return async value=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
}
function num(value,min,max){
 if(value===null||value===undefined)return null;
 return Number.isInteger(value)&&value>=min&&value<=max?value:undefined;
}
function clean(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!HASH.test(value.game_hash||''))return null;
 if(!['w','d','b'].includes(value.result)||!['bullet','blitz','rapid','classical','unknown'].includes(value.time_class)||!['chesscom','lichess','unknown'].includes(value.source_pool))return null;
 if(!['none','pgn_unverified'].includes(value.rating_source)||!/^19\.[0-9]+\.[0-9]+$/.test(value.engine_version||'')||!['full','lite','economy'].includes(value.engine_mode))return null;
 const depth=num(value.analysis_depth,1,30);
 const plies=num(value.ply_count,8,MAX_PLIES);
 if(depth===undefined||plies===undefined)return null;
 if(typeof value.moves_uci!=='string'||value.moves_uci.length>3000)return null;
 const moves=value.moves_uci.split('.');
 if(moves.length!==plies||moves.some(move=>!UCI.test(move)))return null;
 const opening=moves.slice(0,24).join('');
 if(value.opening_uci!==opening||! /^(?:[a-h][1-8][a-h][1-8][qrbn]?){1,24}$/.test(value.opening_uci))return null;
 if(value.start_fen!==null&&value.start_fen!==undefined&&
    (typeof value.start_fen!=='string'||value.start_fen.length>100||!START_FEN.test(value.start_fen)))return null;
 if(typeof value.move_data_base64!=='string'||value.move_data_base64.length>7000||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value.move_data_base64))return null;
 let moveBytes;
 try{moveBytes=atob(value.move_data_base64).length;}catch{return null;}
 if(moveBytes!==plies*10)return null;
 const fields=[
  ['white_rating',100,4000],['black_rating',100,4000],['white_estimate',100,4000],['black_estimate',100,4000],
  ['white_accuracy_tenths',0,1000],['black_accuracy_tenths',0,1000],['white_moves',0,250],['black_moves',0,250],
  ['white_blunders',0,250],['black_blunders',0,250],['white_mistakes',0,250],['black_mistakes',0,250],
  ['white_inaccuracies',0,250],['black_inaccuracies',0,250],['white_chances_lost',0,250],['black_chances_lost',0,250]
 ];
 const output={
  game_hash:value.game_hash,opening_uci:value.opening_uci,moves_uci:value.moves_uci,ply_count:plies,
  start_fen:value.start_fen??null,move_data_base64:value.move_data_base64,
  result:value.result,time_class:value.time_class,source_pool:value.source_pool,rating_source:value.rating_source,
  engine_version:value.engine_version,engine_mode:value.engine_mode,analysis_depth:depth
 };
 for(const [key,min,max] of fields){output[key]=num(value[key],min,max);if(output[key]===undefined)return null;}
 if((output.white_rating!==null||output.black_rating!==null)&&output.rating_source!=='pgn_unverified')return null;
 const allowed=new Set(['game_hash','opening_uci','moves_uci','ply_count','start_fen','move_data_base64',
  'result','time_class','source_pool','rating_source','engine_version','engine_mode','analysis_depth',...fields.map(item=>item[0])]);
 if(Object.keys(value).some(key=>!allowed.has(key)))return null;
 return output;
}
Deno.serve(async request=>{
 const origin=request.headers.get('origin')||'';
 if(request.method==='OPTIONS')return reply(null,204,origin);
 if(request.method!=='POST')return reply({error:'Method not allowed'},405,origin);
 if(!ORIGINS.has(origin))return reply({error:'Origin not allowed'},403,origin);
 const publicKey=secret('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
 if(!publicKey||request.headers.get('apikey')!==publicKey)return reply({error:'Invalid API key'},401,origin);
 const databaseUrl=Deno.env.get('SUPABASE_URL')||'';
 const serviceKey=secret('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
 if(!databaseUrl||!serviceKey)return reply({error:'Ingest not configured'},503,origin);
 if(Number(request.headers.get('content-length')||0)>MAX_BYTES)return reply({error:'Payload too large'},413,origin);
 let payload;
 try{
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)return reply({error:'Payload too large'},413,origin);
  payload=JSON.parse(raw);
 }catch{return reply({error:'Invalid JSON'},400,origin);}
 if(!payload||!UUID.test(payload.client_id||'')||!Array.isArray(payload.samples)||payload.samples.length<1||payload.samples.length>BATCH)
  return reply({error:'Invalid batch'},400,origin);
 const samples=payload.samples.map(clean);
 if(samples.some(sample=>!sample))return reply({error:'Invalid sample fields'},400,origin);
 const sign=await signer(serviceKey);
 const day=new Date().toISOString().slice(0,10);
 const client='\\x'+await sign('client:'+day+':'+payload.client_id);
 const address=request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||
  (request.headers.get('x-forwarded-for')||'').split(',')[0].trim();
 const network=address&&address.length<=64?'\\x'+await sign('network:'+day+':'+address):null;
 for(const sample of samples)sample.game_hash=await sign('game:'+sample.game_hash);
 const base=databaseUrl.endsWith('/')?databaseUrl.slice(0,-1):databaseUrl;
 let response;
 try{
  response=await fetch(base+'/rest/v1/rpc/fca_ingest_community_games',{
   method:'POST',
   headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
   body:JSON.stringify({p_client_hash:client,p_network_hash:network,p_samples:samples})
  });
 }catch{return reply({error:'Database unavailable'},503,origin);}
 let data;
 try{data=JSON.parse(await response.text());}catch{data=null;}
 if(!response.ok||!data||typeof data!=='object')return reply({error:'Could not save full-game statistics'},503,origin);
 if(data.rate_limited)return reply({accepted:0,rate_limited:true},429,origin);
 if(data.capacity_reached&&Number(data.accepted||0)===0)
  return reply({accepted:0,capacity_reached:true,remaining_capacity:0},202,origin);
 return reply({
  accepted:Number(data.accepted||0),duplicates:Number(data.duplicates||0),
  capacity_reached:Boolean(data.capacity_reached),
  remaining_capacity:Number(data.remaining_capacity||0)
 },200,origin);
});
