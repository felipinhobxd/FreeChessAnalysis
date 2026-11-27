import {trustedNetworkFromHeaders} from './ip-network.js';
import {cleanCommunitySample} from './validation.js';

const ORIGINS=new Set(['https://freechessanalysis.vercel.app','http://localhost:8787','http://127.0.0.1:8787']);
const MAX_BYTES=131072,BATCH=5;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORS={'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Expose-Headers':'Retry-After','Access-Control-Max-Age':'86400','Vary':'Origin'};
function reply(body,status,origin,extraHeaders={}){
 return new Response(body===null?null:JSON.stringify(body),{status,headers:{...CORS,...(ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),...extraHeaders,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function secret(name,fallback){
 try{const value=JSON.parse(Deno.env.get(name)||'{}');if(typeof value.default==='string')return value.default;}catch{}
 return fallback?Deno.env.get(fallback)||'':'';
}
async function signer(secretKey){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secretKey),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return async value=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
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
 const samples=await Promise.all(payload.samples.map(cleanCommunitySample));
 if(samples.some(sample=>!sample))return reply({error:'Invalid or illegal game sample'},400,origin);
 const sign=await signer(serviceKey);
 const day=new Date().toISOString().slice(0,10);
 const client='\\x'+await sign('client:'+day+':'+payload.client_id);
 const networkPrefix=trustedNetworkFromHeaders(request.headers);
 if(!networkPrefix)return reply({error:'Client network unavailable'},503,origin);
 const network='\\x'+await sign('network:'+day+':'+networkPrefix);
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
 if(data.rate_limited){
  const now=new Date();
  const nextUtcDay=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
  const retryAfter=Math.max(1,Math.ceil((nextUtcDay-Date.now())/1000));
  return reply({accepted:0,rate_limited:true},429,origin,{'Retry-After':String(retryAfter)});
 }
 if(data.capacity_reached&&Number(data.accepted||0)===0)
  return reply({accepted:0,capacity_reached:true,remaining_capacity:0},202,origin);
 return reply({
  accepted:Number(data.accepted||0),duplicates:Number(data.duplicates||0),
  capacity_reached:Boolean(data.capacity_reached),
  remaining_capacity:Number(data.remaining_capacity||0)
 },200,origin);
});
