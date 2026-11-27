import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIpNetwork} from '../supabase/functions/ingest-review/ip-network.js';

test('IPv4 addresses are grouped by their /24 subnet',()=>{
 assert.equal(normalizeIpNetwork('198.51.100.25'),'ipv4:198.51.100.0/24');
 assert.equal(normalizeIpNetwork('198.51.100.1'),normalizeIpNetwork('198.51.100.254'));
 assert.notEqual(normalizeIpNetwork('198.51.100.25'),normalizeIpNetwork('198.51.101.25'));
 assert.equal(normalizeIpNetwork('  203.0.113.9  '),'ipv4:203.0.113.0/24');
});

test('IPv6 addresses are canonicalized and grouped by their /64 subnet',()=>{
 const expanded='2001:0DB8:1234:5678:0000:0000:0000:0001';
 const compressed='2001:db8:1234:5678:abcd:ef01:2345:6789';
 const samePrefix='2001:db8:1234:5678:ffff:ffff:ffff:ffff';
 const nextSubnet='2001:db8:1234:5679::1';
 assert.equal(normalizeIpNetwork(expanded),'ipv6:2001:0db8:1234:5678/64');
 assert.equal(normalizeIpNetwork(compressed),normalizeIpNetwork(samePrefix));
 assert.notEqual(normalizeIpNetwork(expanded),normalizeIpNetwork(nextSubnet));
});

test('IPv4-mapped IPv6 addresses share the IPv4 /24 quota',()=>{
 const dotted='::ffff:192.0.2.128';
 const hexadecimal='0:0:0:0:0:ffff:c000:0280';
 assert.equal(normalizeIpNetwork(dotted),'ipv4:192.0.2.0/24');
 assert.equal(normalizeIpNetwork(hexadecimal),normalizeIpNetwork('192.0.2.8'));
});

test('IPv4-embedded IPv6 addresses are parsed before subnet reduction',()=>{
 assert.equal(normalizeIpNetwork('2001:db8::192.0.2.1'),'ipv6:2001:0db8:0000:0000/64');
});

test('malformed, ambiguous, or non-IP values are rejected',()=>{
 for(const value of [
  '',null,undefined,{},'unknown','198.51.100.256','198.51.100','198.051.100.25',
  '198.51.100.25:443','198.51.100.25, 203.0.113.1','[2001:db8::1]',
  '2001:db8:::1','2001:db8::1::2','2001:db8:1:2:3:4:5:6:7',
  '2001:db8:1:2:3:4:5::','2001:db8::g','fe80::1%eth0','::ffff:192.0.2.999'
 ]){
  assert.equal(normalizeIpNetwork(value),null,String(value));
 }
});

test('hostile or oversized header values never become network keys',()=>{
 assert.equal(normalizeIpNetwork('198.51.100.1\nX-Forwarded-For: 1.1.1.1'),null);
 assert.equal(normalizeIpNetwork('a'.repeat(65)),null);
});
