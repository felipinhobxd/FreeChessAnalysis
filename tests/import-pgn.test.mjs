import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  lookupChessGame,
  createImportHandler,
  CHESSCOM_IMPORT_CONCURRENCY,
  CHESSCOM_LOOKUP_TIMEOUT_MS,
} from '../api/import-pgn.js';

test('Chess.com lookup still resolves the exact month before any archive fallback', async () => {
  const visited = [];
  const fetchJson = async url => {
    visited.push(url);
    if (url.includes('/callback/')) return { game: { pgnHeaders: { White: 'Player', Date: '2026.11.25' } } };
    return { games: [{ rules: 'chess', pgn: 'correct PGN', url: 'https://www.chess.com/game/live/123' }] };
  };

  assert.equal(await lookupChessGame({ type: 'live', id: '123', fetchJson }), 'correct PGN');
  assert.deepEqual(visited, [
    'https://www.chess.com/callback/live/game/123',
    'https://api.chess.com/pub/player/player/games/2026/11',
  ]);
});

test('Chess.com lookup rejects unsupported game IDs without making network requests', async () => {
  let calls = 0;
  const result = await lookupChessGame({
    type: 'daily',
    id: '../123',
    fetchJson: async () => { calls++; return null; },
  });
  assert.equal(result, null);
  assert.equal(calls, 0);
});

test('Chess.com lookup enforces one total deadline even when a fetch adapter ignores AbortSignal', async () => {
  let receivedSignal;
  const started = Date.now();
  await assert.rejects(
    lookupChessGame({
      type: 'live',
      id: '123',
      timeoutMs: 30,
      fetchJson: async (_url, { signal }) => {
        receivedSignal = signal;
        return new Promise(() => {});
      },
    }),
    error => error.name === 'TimeoutError'
  );
  assert.ok(Date.now() - started < 500);
  assert.equal(receivedSignal.aborted, true);
});

test('Chess.com lookup uses the same deadline across metadata and subsequent archive requests', async () => {
  const visited = [];
  await assert.rejects(
    lookupChessGame({
      type: 'live',
      id: '123',
      timeoutMs: 35,
      fetchJson: async url => {
        visited.push(url);
        if (url.includes('/callback/')) {
          return { game: { pgnHeaders: { White: 'Player', Black: 'Opponent' } } };
        }
        if (url.endsWith('/archives')) return { archives: [
          'https://api.chess.com/pub/player/player/games/2026/10',
          'https://api.chess.com/pub/player/player/games/2026/09',
        ] };
        return new Promise(() => {});
      },
    }),
    error => error.name === 'TimeoutError'
  );
  assert.ok(visited.some(url => url.endsWith('/archives')));
  assert.ok(visited.some(url => /\/games\/2026\/10$/.test(url)));
});

test('Chess.com lookup responds to caller cancellation while a request is pending', async () => {
  const controller = new AbortController();
  const pending = lookupChessGame({
    type: 'live',
    id: '123',
    timeoutMs: CHESSCOM_LOOKUP_TIMEOUT_MS,
    signal: controller.signal,
    fetchJson: async () => new Promise(() => {}),
  });
  controller.abort(new DOMException('Cancelado pelo usuário.', 'AbortError'));
  await assert.rejects(pending, error => error.name === 'AbortError');
});

test('Chess.com lookup handles upstream failures without exposing internal errors', async () => {
  const visited = [];
  const fetchJson = async url => {
    visited.push(url);
    if (url.includes('/callback/')) throw new Error('upstream unavailable');
    return null;
  };
  assert.equal(await lookupChessGame({ type: 'live', id: '123', fetchJson }), null);
  assert.equal(visited.length, 1);
});

function importRequest(id = 123) {
  const req = { method: 'GET', url: '/api/import-pgn?type=live&id=' + id };
  const res = new EventEmitter();
  res.headers = new Map();
  res.setHeader = (key, value) => res.headers.set(key, value);
  res.end = body => { res.body = JSON.parse(body); };
  return { req, res };
}

test('the import handler releases a lookup slot when the response connection closes', async () => {
  const requests = [];
  const handler = createImportHandler(({ signal }) => new Promise((resolve, reject) => {
    requests.push(resolve);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));

  const pending = Array.from({ length: CHESSCOM_IMPORT_CONCURRENCY }, () => {
    const { req, res } = importRequest();
    return { res, done: handler(req, res) };
  });
  const blocked = importRequest();
  await handler(blocked.req, blocked.res);
  assert.equal(blocked.res.statusCode, 429);
  assert.equal(blocked.res.headers.get('Retry-After'), '3');
  assert.equal(requests.length, CHESSCOM_IMPORT_CONCURRENCY);

  pending[0].res.destroyed = true;
  pending[0].res.emit('close');
  await pending[0].done;
  assert.equal(pending[0].res.body, undefined);

  const next = importRequest();
  const reopened = handler(next.req, next.res);
  assert.equal(requests.length, CHESSCOM_IMPORT_CONCURRENCY + 1);
  requests.forEach(resolve => resolve('PGN'));
  await Promise.all([reopened, ...pending.map(request => request.done)]);
  assert.equal(next.res.statusCode, 200);
});

test('the import handler maps Chess.com 429s to a cooldown without starting more lookups', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    new Response(null, { status: 429, headers: { 'Retry-After': '25' } }));
  const handler = createImportHandler();
  const first = importRequest();
  await handler(first.req, first.res);
  assert.equal(first.res.statusCode, 429);
  assert.ok(Number(first.res.headers.get('Retry-After')) > 0);
  assert.ok(Number(first.res.headers.get('Retry-After')) <= 25);
  assert.equal(fetch.mock.callCount(), 1);

  const next = importRequest(456);
  await handler(next.req, next.res);
  assert.equal(next.res.statusCode, 429);
  assert.deepEqual(next.res.body, first.res.body);
  assert.equal(fetch.mock.callCount(), 1);
});
