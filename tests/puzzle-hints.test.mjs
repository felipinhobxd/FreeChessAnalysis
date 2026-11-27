import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { puzzleHintSquare } from '../dist/puzzle-hints.js';

test('puzzle hint returns only the origin square of the recommended move', () => {
  const board = new Chess();
  assert.equal(puzzleHintSquare(Chess, board.fen(), { best: 'e2e4' }), 'e2');
});

test('puzzle hint follows the side to move, including black pieces', () => {
  const board = new Chess();
  board.move('e4');
  board.move('e5');
  board.move('Nf3');
  assert.equal(puzzleHintSquare(Chess, board.fen(), { best: 'b8c6' }), 'b8');
});

test('puzzle hint validates the best move and falls back to a legal MultiPV choice', () => {
  const board = new Chess();
  assert.equal(puzzleHintSquare(Chess, board.fen(), {
    best: 'e2e5',
    choices: [{ pv: ['g1f3'] }],
  }), 'g1');
});

test('puzzle hint supports promotion moves but never returns their destination', () => {
  const board = new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');
  assert.equal(puzzleHintSquare(Chess, board.fen(), { best: 'a7a8q' }), 'a7');
});

test('puzzle hint safely returns null for missing, malformed or illegal moves', () => {
  const board = new Chess();
  assert.equal(puzzleHintSquare(Chess, board.fen(), null), null);
  assert.equal(puzzleHintSquare(Chess, board.fen(), { best: 'not-a-move' }), null);
  assert.equal(puzzleHintSquare(Chess, board.fen(), { best: 'e2e5' }), null);
});

test('application wires the hint button to the recommended piece, not its destination', async () => {
  const { readFile } = await import('node:fs/promises');
  const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../dist/style.css', import.meta.url), 'utf8');
  assert.match(app, /puzzleHintSquare\(Chess, position\.fen, puzzle\.node\.coach\)/);
  assert.match(app, /button\.classList\.toggle\('puzzle-hint-piece', square === hintSquare\)/);
  assert.match(app, /Mova a peça destacada\. O destino continua por sua conta\./);
  assert.match(css, /\.square\.puzzle-hint-piece/);
});
