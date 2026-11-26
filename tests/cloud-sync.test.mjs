import { test } from 'node:test';
import { syncArchive } from '../dist/study-cloud.js';
import assert from 'node:assert/strict';
import {
  prepareSyncArchive,
  CLOUD_ARCHIVE_ENTRY_LIMIT,
  CLOUD_ARCHIVE_BYTE_LIMIT,
} from '../dist/study-cloud.js';

function study(index, extra = {}) {
  return {
    id: index.toString(16).padStart(64, '0'),
    name: 'Estudo ' + index,
    date: index,
    data: { pgn: '1. e4 e5' },
    ...extra,
  };
}

test('cloud sync selects only the 40 newest valid studies without mutating local input', () => {
  const source = Array.from({ length: 55 }, (_, index) => study(index + 1)).reverse();
  source.push({ id: 'invalid' });
  const snapshot = source.slice();
  const prepared = prepareSyncArchive(source);

  assert.equal(prepared.entries.length, CLOUD_ARCHIVE_ENTRY_LIMIT);
  assert.equal(prepared.omitted, 15);
  assert.deepEqual(prepared.entries.map(entry => entry.date),
    Array.from({ length: 40 }, (_, index) => 55 - index));
  assert.deepEqual(source, snapshot);
});

test('cloud sync measures UTF-8 bytes and stops before the database safety margin', () => {
  const source = [
    study(3, { notes: '棋'.repeat(300_000) }),
    study(2, { notes: '棋'.repeat(300_000) }),
    study(1),
  ];
  const prepared = prepareSyncArchive(source);
  const encodedSize = new TextEncoder().encode(JSON.stringify(prepared.entries)).byteLength;

  assert.equal(prepared.entries.length, 1);
  assert.equal(prepared.omitted, 2);
  assert.ok(encodedSize <= CLOUD_ARCHIVE_BYTE_LIMIT);
});

test('cloud sync rejects a single newest study that exceeds the safe payload budget', () => {
  assert.throws(
    () => prepareSyncArchive([study(1, { notes: 'x'.repeat(CLOUD_ARCHIVE_BYTE_LIMIT) })]),
    /grande demais para a sincronização/
  );
});

test('cloud sync ignores malformed records before applying limits', () => {
  const prepared = prepareSyncArchive([{}, study(2), { ...study(3), date: Number.NaN }]);
  assert.deepEqual(prepared.entries, [study(2)]);
  assert.equal(prepared.omitted, 0);
});

test('cloud sync reports a rate limit even if the response is not JSON', async t => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response('Busy', { status: 429, headers: { 'Content-Type': 'text/plain' } }));
  await assert.rejects(syncArchive('a'.repeat(64)), /limitou as consultas/);
});
