import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGameLink, reviewHighlights, mergeStudies } from '../dist/study-tools.js';
import { lookupChessGame } from '../api/import-pgn.js';

test('game link parsing narrows imports to supported providers and paths', () => {
  assert.deepEqual(parseGameLink('https://www.chess.com/analysis/game/live/187950475324?flip=true'),
    { platform: 'chesscom', type: 'live', id: '187950475324' });
  assert.deepEqual(parseGameLink('https://lichess.org/HqjDTU4A/black#12'),
    { platform: 'lichess', id: 'HqjDTU4A', side: 'b' });
  for (const link of ['https://chess.com.example/game/live/123', 'http://lichess.org/HqjDTU4A',
    'https://user:pass@lichess.org/HqjDTU4A', 'https://chess.com/play/online']) assert.equal(parseGameLink(link), null);
});

test('personal review keeps the five most impactful moves on the selected side, in game order', () => {
  const path = [{}, ...Array.from({ length: 9 }, (_, i) => ({
    id: i, move: { color: i === 8 ? 'b' : 'w' }, classification: i === 7 ? 'good' : 'mistake',
    coach: { best: 'e2e4', before: 50, after: 50 - i },
  }))];
  assert.deepEqual(reviewHighlights(path, 'w', value => value).map(node => node.id), [2, 3, 4, 5, 6]);
  assert.deepEqual(reviewHighlights(path, 'b', value => value).map(node => node.id), [8]);
});

test('sync merges games by stable identity and keeps the newest progress', () => {
  const base = { id: 'a'.repeat(64), name: 'Estudo', date: 20, data: { pgn: 'PGN' } };
  const older = { ...base, date: 10, data: { pgn: 'PGN', ply: 1 } };
  const other = { ...base, id: 'b'.repeat(64), date: 5 };
  assert.deepEqual(mergeStudies([base], [older, other, {}]), [base, other]);
});

test('Chess.com link looks up the named month, then checks the requested id', async () => {
  const visited = [];
  const fetchJson = async url => {
    visited.push(url);
    if (url.includes('/callback/')) return { game: { pgnHeaders: { White: 'Player', Date: '2026.11.25' } } };
    return { games: [{ rules: 'chess', pgn: 'not this one', url: 'https://www.chess.com/game/live/9' },
      { rules: 'chess', pgn: 'correct PGN', url: 'https://www.chess.com/game/live/123' }] };
  };
  assert.equal(await lookupChessGame({ type: 'live', id: '123', fetchJson }), 'correct PGN');
  assert.deepEqual(visited, ['https://www.chess.com/callback/live/game/123',
    'https://api.chess.com/pub/player/player/games/2026/11']);
  assert.equal(await lookupChessGame({ type: '..', id: '123', fetchJson }), null);
});
