const IPV4_OCTET=/^(?:0|[1-9][0-9]{0,2})$/;
const IPV6_GROUP=/^[0-9a-f]{1,4}$/;

function parseIpv4(address){
 const parts=address.split('.');
 if(parts.length!==4)return null;
 const octets=[];
 for(const part of parts){
  if(!IPV4_OCTET.test(part))return null;
  const value=Number(part);
  if(value>255)return null;
  octets.push(value);
 }
 return octets;
}

function ipv4Network(octets){
 return 'ipv4:'+octets[0]+'.'+octets[1]+'.'+octets[2]+'.0/24';
}

function parseIpv6(address){
 let input=address.toLowerCase();
 if(input.includes('%')||input.includes('[')||input.includes(']'))return null;

 if(input.includes('.')){
  const separator=input.lastIndexOf(':');
  if(separator<0)return null;
  const tail=parseIpv4(input.slice(separator+1));
  if(!tail)return null;
  const high=((tail[0]<<8)|tail[1]).toString(16);
  const low=((tail[2]<<8)|tail[3]).toString(16);
  input=input.slice(0,separator+1)+high+':'+low;
 }

 const compression=input.indexOf('::');
 if(compression!==input.lastIndexOf('::'))return null;

 let groups;
 if(compression>=0){
  const left=input.slice(0,compression);
  const right=input.slice(compression+2);
  const leftGroups=left?left.split(':'):[];
  const rightGroups=right?right.split(':'):[];
  if(leftGroups.some(group=>!IPV6_GROUP.test(group))||
     rightGroups.some(group=>!IPV6_GROUP.test(group)))return null;
  const missing=8-leftGroups.length-rightGroups.length;
  if(missing<1)return null;
  groups=[...leftGroups,...Array(missing).fill('0'),...rightGroups];
 }else{
  groups=input.split(':');
  if(groups.length!==8||groups.some(group=>!IPV6_GROUP.test(group)))return null;
 }

 if(groups.length!==8||groups.some(group=>!IPV6_GROUP.test(group)))return null;
 return groups.map(group=>Number.parseInt(group,16));
}

/**
 * Reduce a client IP to an abuse-control network key.
 * IPv4 uses /24 and IPv6 uses /64. IPv4-mapped IPv6 is treated as IPv4
 * so the same client cannot get a separate quota by changing address notation.
 * The returned value is a network prefix, not the original client address.
 *
 * @param {unknown} address
 * @returns {string | null}
 */
export function normalizeIpNetwork(address){
 if(typeof address!=='string')return null;
 const input=address.trim();
 if(!input||input.length>64)return null;

 const ipv4=parseIpv4(input);
 if(ipv4)return ipv4Network(ipv4);

 const ipv6=parseIpv6(input);
 if(!ipv6)return null;

 const isIpv4Mapped=ipv6.slice(0,5).every(group=>group===0)&&ipv6[5]===0xffff;
 if(isIpv4Mapped){
  return ipv4Network([
   (ipv6[6]>>8)&255,ipv6[6]&255,(ipv6[7]>>8)&255,ipv6[7]&255
  ]);
 }

 const prefix=ipv6.slice(0,4).map(group=>group.toString(16).padStart(4,'0')).join(':');
 return 'ipv6:'+prefix+'/64';
}

/**
 * Use only Cloudflare's client-address header for hosted ingestion.
 * Forwarding headers are deliberately not used as an authentication source.
 *
 * @param {Headers} headers
 * @returns {string | null}
 */
export function trustedNetworkFromHeaders(headers){
 let address='';
 try{address=headers?.get?.('cf-connecting-ip')||'';}catch{return null;}
 return normalizeIpNetwork(address);
}
