import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const headers = new Map(config.headers[0].headers.map(item => [item.key.toLowerCase(), item.value]));
const appSource = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('chess.js is loaded from the local build instead of a runtime CDN', () => {
  assert.ok(appSource.includes("import('./vendor/chess.js')"));
  assert.ok(!appSource.includes('cdn.jsdelivr.net/npm/chess.js@'));
  assert.ok(!appSource.includes('unpkg.com/chess.js@'));
  assert.match(packageJson.scripts.build, /tools\/copy-vendor\.mjs/);
  assert.equal(packageJson.devDependencies['chess.js'], '1.4.0');
});

test('deployment sends a restrictive content security policy for only required services', () => {
  const csp = headers.get('content-security-policy');
  assert.ok(csp);
  for (const directive of [
    "default-src 'self'",
    "script-src 'self' blob: 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    'https://unpkg.com',
    'https://cdn.jsdelivr.net',
    'https://api.chess.com',
    'https://www.chess.com',
    'https://lichess.org',
    'https://iqlfryqkbmadmirkxlvv.supabase.co',
  ]) assert.ok(csp.includes(directive), 'Missing CSP entry: ' + directive);
  assert.ok(!csp.includes('https:;'), 'CSP must not allow arbitrary HTTPS origins.');
});

test('deployment sends browser hardening headers without disabling required isolation', () => {
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('strict-transport-security'), 'max-age=31536000');
  assert.match(headers.get('permissions-policy'), /camera=\(\)/);
  assert.match(headers.get('permissions-policy'), /microphone=\(\)/);
  assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(headers.get('cross-origin-embedder-policy'), 'require-corp');
});
