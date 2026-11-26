import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lookupChessGame,
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
