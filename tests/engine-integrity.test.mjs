import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { STOCKFISH_INTEGRITY, verifyAsset } from '../dist/engine-integrity.js';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function responseFor(bytes, ok = true) {
  return {
    ok,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

test('every supported Stockfish build has pinned SHA-256 digests for JS and WASM', () => {
  for (const [filename, digest] of Object.entries(STOCKFISH_INTEGRITY)) {
    assert.match(filename, /^stockfish-19(?:-single|-lite-single)?\.(?:js|wasm)$/);
    assert.match(digest, /^[a-f0-9]{64}$/);
  }
  assert.equal(Object.keys(STOCKFISH_INTEGRITY).length, 6);
});

test('verified assets are accepted only when their SHA-256 digest matches', async () => {
  const bytes = new TextEncoder().encode('known Stockfish fixture');
  const digest = sha256(bytes);
  const verified = await verifyAsset(responseFor(bytes), digest);
  assert.deepEqual(new Uint8Array(verified), bytes);
  await assert.rejects(
    verifyAsset(responseFor(bytes), '0'.repeat(64)),
    /SHA-256 do Stockfish falhou/
  );
});

test('an unavailable asset is rejected before its contents can be used', async () => {
  const bytes = new TextEncoder().encode('not available');
  await assert.rejects(
    verifyAsset(responseFor(bytes, false), sha256(bytes)),
    /indisponível/
  );
});
