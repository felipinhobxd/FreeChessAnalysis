const ORIGINS=new Set(['https://freechessanalysis.vercel.app','http://localhost:8787','http://127.0.0.1:8787']);
const MAX=24000,BATCH=10,UCI=/^(?:[a-h][1-8][a-h][1-8][qrbn]?){1,24}$/,HASH=/^[a-f0-9]{64}$/,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORS={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Max-Age':'86400','Vary':'Origin'};
function reply(body,status,origin){return new Response(body===null?null:JSON.stringify(body),{status,headers:{...CORS,...(ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
function secret(name,fallback){try{const v=JSON.parse(Deno.env.get(name)||'{}');if(typeof v.default==='string')return v.default;}catch{}return fallback?Deno.env.get(fallback)||'':'';}
async function signer(secretKey){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secretKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);return async text=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
function num(v,min,max){if(v===null||v===undefined)return null;return Number.isInteger(v)&&v>=min&&v<=max?v:undefined;}
function clean(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||!HASH.test(v.game_hash||'')||!UCI.test(v.opening_uci||''))return null;
 if(!['w','d','b'].includes(v.result)||!['bullet','blitz','rapid','classical','unknown'].includes(v.time_class)||!['chesscom','lichess','unknown'].includes(v.source_pool))return null;
 if(!['none','pgn_unverified'].includes(v.rating_source)||!/^19\.[0-9]+\.[0-9]+$/.test(v.engine_version||'')||!['full','lite','economy'].includes(v.engine_mode))return null;
 const depth=num(v.analysis_depth,1,30);if(depth===undefined)return null;
 const f=[['white_rating',100,4000],['black_rating',100,4000],['white_estimate',100,4000],['black_estimate',100,4000],['white_accuracy_tenths',0,1000],['black_accuracy_tenths',0,1000],['white_moves',0,250],['black_moves',0,250],['white_blunders',0,250],['black_blunders',0,250],['white_mistakes',0,250],['black_mistakes',0,250],['white_inaccuracies',0,250],['black_inaccuracies',0,250],['white_chances_lost',0,250],['black_chances_lost',0,250]];
 const out={game_hash:v.game_hash,opening_uci:v.opening_uci,result:v.result,time_class:v.time_class,source_pool:v.source_pool,rating_source:v.rating_source,engine_version:v.engine_version,engine_mode:v.engine_mode,analysis_depth:depth};
 for(const [k,lo,hi] of f){out[k]=num(v[k],lo,hi);if(out[k]===undefined)return null;}
 if((out.white_rating!==null||out.black_rating!==null)&&out.rating_source!=='pgn_unverified')return null;
 const allowed=new Set(['game_hash','opening_uci','result','time_class','source_pool','rating_source','engine_version','engine_mode','analysis_depth',...f.map(x=>x[0])]);
 if(Object.keys(v).some(k=>!allowed.has(k)))return null;
 return out;
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 if(req.method==='OPTIONS')return reply(null,204,origin);
 if(req.method!=='POST')return reply({error:'Method not allowed'},405,origin);
 if(!ORIGINS.has(origin))return reply({error:'Origin not allowed'},403,origin);
 const publicKey=secret('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
 if(!publicKey||req.headers.get('apikey')!==publicKey)return reply({error:'Invalid API key'},401,origin);
 const url=Deno.env.get('SUPABASE_URL')||'',serviceKey=secret('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!serviceKey)return reply({error:'Ingest not configured'},503,origin);
 if(Number(req.headers.get('content-length')||0)>MAX)return reply({error:'Payload too large'},413,origin);
 let payload;try{const raw=await req.text();if(new TextEncoder().encode(raw).byteLength>MAX)return reply({error:'Payload too large'},413,origin);payload=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400,origin);}
 if(!payload||!UUID.test(payload.client_id||'')||!Array.isArray(payload.samples)||payload.samples.length<1||payload.samples.length>BATCH)return reply({error:'Invalid batch'},400,origin);
 const rows=payload.samples.map(clean);if(rows.some(x=>!x))return reply({error:'Invalid sample fields'},400,origin);
 const sign=await signer(serviceKey),day=new Date().toISOString().slice(0,10);
 const client='\\x'+await sign('client:'+day+':'+payload.client_id);
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||(req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
 const network=ip&&ip.length<=64?'\\x'+await sign('network:'+day+':'+ip):null;
 for(const row of rows)row.game_hash=await sign('game:'+row.game_hash);
 const base=url.endsWith('/')?url.slice(0,-1):url;
 let res;try{res=await fetch(base+'/rest/v1/rpc/fca_ingest_community_reviews',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_client_hash:client,p_network_hash:network,p_samples:rows})});}catch{return reply({error:'Database unavailable'},503,origin);}
 let data;try{data=JSON.parse(await res.text());}catch{data=null;}
 if(!res.ok||!data||typeof data!=='object')return reply({error:'Could not save review statistics'},503,origin);
 if(data.rate_limited)return reply({accepted:0,rate_limited:true},429,origin);
 if(data.capacity_reached&&Number(data.accepted||0)===0)return reply({accepted:0,capacity_reached:true},202,origin);
 return reply({accepted:Number(data.accepted||0),duplicates:Number(data.duplicates||0),capacity_reached:Boolean(data.capacity_reached)},200,origin);
});
