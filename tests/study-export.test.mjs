import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { exportStudyPgn } from '../dist/study-export.js';

test('an explored branch exports its actual moves instead of the original imported game', () => {
  const root = new Chess();
  const moves = ['e4', 'e5', 'd4', 'exd4'].map(san => root.move(san));
  const pgn = exportStudyPgn(Chess, new Chess().fen(), {
    Event: 'Original game', White: 'White', Black: 'Black', Result: '1-0',
  }, moves, '*');
  assert.match(pgn, /\[Result "\*"\]/);
  const restored = new Chess();
  restored.loadPgn(pgn);
  assert.deepEqual(restored.history(), ['e4', 'e5', 'd4', 'exd4']);
  assert.equal(restored.isGameOver(), false);
});

test('a branch from a custom FEN exports setup tags and round-trips', () => {
  const position = new Chess();
  position.move('e4');
  const rootFen = position.fen();
  const line = new Chess(rootFen);
  const moves = ['e5', 'Nf3', 'Nc6'].map(san => line.move(san));
  const pgn = exportStudyPgn(Chess, rootFen, { Event: 'FEN study' }, moves, '*');
  assert.match(pgn, /\[SetUp "1"\]/);
  assert.ok(pgn.includes('[FEN "' + rootFen + '"]'));
  const restored = new Chess();
  restored.loadPgn(pgn);
  assert.deepEqual(restored.history(), ['e5', 'Nf3', 'Nc6']);
  assert.equal(restored.fen(), line.fen());
});

test('invalid variation moves fail instead of silently exporting a truncated game', () => {
  assert.throws(() => exportStudyPgn(Chess, new Chess().fen(), {}, [{ from: 'e2', to: 'e5' }]),
    /lance inválido/);
});
