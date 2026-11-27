import {trustedNetworkFromHeaders} from './ip-network.js';
import {cleanCommunitySample} from './validation.js';

const ORIGINS=new Set([
 'https://freechessanalysis.vercel.app',
 'http://localhost:8787',
 'http://127.0.0.1:8787'
]);
const MAX_BYTES=131072;
const BATCH=5;
const DB_TIMEOUT_MS=8000;
const REQUEST_LIMIT_TIMEOUT_MS=3000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORS={
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'apikey, content-type',
 'Access-Control-Expose-Headers':'Retry-After',
 'Access-Control-Max-Age':'86400',
 'Vary':'Origin'
};

function reply(body,status,origin,extraHeaders={}){
 return new Response(body===null?null:JSON.stringify(body),{
  status,
  headers:{
   ...CORS,
   ...(ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),
   ...extraHeaders,
   'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff'
  }
 });
}

function secret(getEnv,name,fallback){
 try{
  const value=JSON.parse(getEnv(name)||'{}');
  if(typeof value.default==='string'&&value.default)return value.default;
 }catch{}
 return fallback?getEnv(fallback)||'':'';
}

async function signer(secretKey){
 const key=await crypto.subtle.importKey(
  'raw',new TextEncoder().encode(secretKey),
  {name:'HMAC',hash:'SHA-256'},false,['sign']
 );
 return async value=>Array.from(
  new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))),
  byte=>byte.toString(16).padStart(2,'0')
 ).join('');
}

function nextUtcDaySeconds(now){
 const date=now instanceof Date?now:new Date(now);
 const next=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+1);
 return Math.max(1,Math.ceil((next-date.getTime())/1000));
}

function validDbCounts(data,batchSize){
 const accepted=data?.accepted,duplicates=data?.duplicates;
 const remaining=data?.remaining_capacity;
 return Number.isSafeInteger(accepted)&&accepted>=0&&accepted<=batchSize&&
  Number.isSafeInteger(duplicates)&&duplicates>=0&&duplicates<=batchSize&&
  accepted+duplicates<=batchSize&&
  Number.isSafeInteger(remaining)&&remaining>=0&&
  typeof data.capacity_reached==='boolean';
}

/**
 * Construct the public HTTP handler. Dependencies are injectable so the actual
 * request boundary can be tested without writing to the production database.
 */
export function createIngestHandler(options={}){
 const getEnv=options.getEnv||((name)=>Deno.env.get(name));
 const fetcher=options.fetcher||globalThis.fetch;
 const now=options.now||(()=>new Date());
 const networkFromHeaders=options.networkFromHeaders||trustedNetworkFromHeaders;
 const dbTimeoutMs=Number.isSafeInteger(options.dbTimeoutMs)&&options.dbTimeoutMs>0?options.dbTimeoutMs:DB_TIMEOUT_MS;

 return async request=>{
  const origin=request.headers.get('origin')||'';

  if(request.method==='OPTIONS')return reply(null,204,origin);
  if(request.method!=='POST')return reply({error:'Method not allowed'},405,origin,{'Allow':'POST, OPTIONS'});
  if(!ORIGINS.has(origin))return reply({error:'Origin not allowed'},403,origin);

  const contentType=request.headers.get('content-type')||'';
  if(!/^application\/json(?:\s*;|$)/i.test(contentType))
   return reply({error:'Content-Type must be application/json'},415,origin);

  const declaredLength=request.headers.get('content-length');
  if(declaredLength!==null&&(!/^\d+$/.test(declaredLength)||Number(declaredLength)>MAX_BYTES))
   return reply({error:'Payload too large'},413,origin);

  const publicKey=secret(getEnv,'SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY');
  if(!publicKey||request.headers.get('apikey')!==publicKey)
   return reply({error:'Invalid API key'},401,origin);

  const databaseUrl=getEnv('SUPABASE_URL')||'';
  const serviceKey=secret(getEnv,'SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
  if(!databaseUrl||!serviceKey)
   return reply({error:'Ingest not configured'},503,origin);

  let raw;
  let reader;
  try{
   reader=request.body?.getReader();
   const bytes=new Uint8Array(MAX_BYTES);
   let length=0;
   if(reader)while(true){
    const {done,value}=await reader.read();
    if(done)break;
    if(value.byteLength>MAX_BYTES-length){
     // Do not wait for the sender to finish or for cancellation to settle.
     void reader.cancel().catch(()=>{});
     return reply({error:'Payload too large'},413,origin);
    }
    bytes.set(value,length);
    length+=value.byteLength;
   }
   raw=new TextDecoder().decode(bytes.subarray(0,length));
  }catch{
   return reply({error:'Invalid request body'},400,origin);
  }finally{
   reader?.releaseLock();
  }

  let payload;
  try{payload=JSON.parse(raw);}catch{
   return reply({error:'Invalid JSON'},400,origin);
  }
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||
     Object.keys(payload).some(key=>!['client_id','samples'].includes(key))||
     !UUID.test(payload.client_id||'')||!Array.isArray(payload.samples)||
     payload.samples.length<1||payload.samples.length>BATCH)
   return reply({error:'Invalid batch'},400,origin);

  const networkPrefix=networkFromHeaders(request.headers);
  if(!networkPrefix)return reply({error:'Client network unavailable'},503,origin);

  let sign;
  let requestDay;
  let requestQuota;
  try{
   sign=await signer(serviceKey);
   const requestTime=now();
   requestDay=(requestTime instanceof Date?requestTime:new Date(requestTime)).toISOString().slice(0,10);
   const requestNetwork='\\x'+await sign('request-network:'+requestDay+':'+networkPrefix);
   if(typeof options.requestQuotaChecker==='function'){
    requestQuota=await options.requestQuotaChecker(requestNetwork);
   }else{
    const base=databaseUrl.endsWith('/')?databaseUrl.slice(0,-1):databaseUrl;
    const quotaResponse=await fetcher(base+'/rest/v1/rpc/fca_consume_community_request',{
     method:'POST',
     headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
     body:JSON.stringify({p_network_hash:requestNetwork}),
     signal:AbortSignal.timeout(Math.min(REQUEST_LIMIT_TIMEOUT_MS,dbTimeoutMs))
    });
    if(!quotaResponse||!quotaResponse.ok)throw new Error('Request quota unavailable');
    requestQuota=await quotaResponse.json();
   }
  }catch{
   return reply({error:'Request quota unavailable'},503,origin);
  }
  if(!requestQuota||typeof requestQuota.allowed!=='boolean'||
     !Number.isSafeInteger(requestQuota.remaining_requests)||requestQuota.remaining_requests<0||requestQuota.remaining_requests>15||
     !Number.isSafeInteger(requestQuota.retry_after_seconds)||requestQuota.retry_after_seconds<1||requestQuota.retry_after_seconds>60)
   return reply({error:'Invalid request quota response'},503,origin);
  if(!requestQuota.allowed)
   return reply({accepted:0,duplicates:0,rate_limited:true},429,origin,{'Retry-After':String(requestQuota.retry_after_seconds)});

  const samples=await Promise.all(payload.samples.map(cleanCommunitySample));
  if(samples.some(sample=>!sample))
   return reply({error:'Invalid or illegal game sample'},400,origin);

  let response;
  try{
   const sign=await signer(serviceKey);
   const day=requestDay;
   const client='\\x'+await sign('client:'+day+':'+payload.client_id);
   const network='\\x'+await sign('network:'+day+':'+networkPrefix);
   for(const sample of samples)sample.game_hash=await sign('game:'+sample.game_hash);

   const base=databaseUrl.endsWith('/')?databaseUrl.slice(0,-1):databaseUrl;
   response=await fetcher(base+'/rest/v1/rpc/fca_ingest_community_games',{
    method:'POST',
    headers:{
     apikey:serviceKey,
     Authorization:'Bearer '+serviceKey,
     'Content-Type':'application/json'
    },
    body:JSON.stringify({p_client_hash:client,p_network_hash:network,p_samples:samples}),
    signal:AbortSignal.timeout(dbTimeoutMs)
   });
  }catch{
   return reply({error:'Database unavailable'},503,origin);
  }

  if(!response||!response.ok)
   return reply({error:'Could not save full-game statistics'},503,origin);

  let data;
  try{data=await response.json();}catch{
   return reply({error:'Invalid database response'},503,origin);
  }
  if(!data||typeof data!=='object'||Array.isArray(data))
   return reply({error:'Invalid database response'},503,origin);

  if(data.rate_limited===true){
   const retryAfter=nextUtcDaySeconds(now());
   return reply({accepted:0,duplicates:0,rate_limited:true},429,origin,{'Retry-After':String(retryAfter)});
  }

  if(!validDbCounts(data,samples.length))
   return reply({error:'Invalid database response'},503,origin);

  if(data.accepted+data.duplicates!==samples.length&&!data.capacity_reached)
   return reply({error:'Incomplete database acknowledgement'},503,origin);

  const body={
   accepted:data.accepted,
   duplicates:data.duplicates,
   capacity_reached:data.capacity_reached,
   remaining_capacity:data.remaining_capacity
  };
  if(data.capacity_reached&&data.accepted+data.duplicates<samples.length)
   return reply(body,202,origin);

  return reply(body,200,origin);
 };
}
