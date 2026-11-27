import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactSearchPosition, isIrreversibleTransition } from '../dist/engine-position.js';

function position(fen, parent = null, move = null) {
  return { fen, parent, move };
}

test('search position starts after the latest pawn move and retains later reversible moves', () => {
  const root = position('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const e4 = position('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', root,
    { from: 'e2', to: 'e4', piece: 'p' });
  const e5 = position('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', e4,
    { from: 'e7', to: 'e5', piece: 'p' });
  const nf3 = position('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', e5,
    { from: 'g1', to: 'f3', piece: 'n' });
  const nc6 = position('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', nf3,
    { from: 'b8', to: 'c6', piece: 'n' });

  const search = compactSearchPosition([root, e4, e5, nf3, nc6]);
  assert.equal(search.fen, e5.fen);
  assert.deepEqual(search.moves, ['g1f3', 'b8c6']);
  assert.equal(search.baseIndex, 2);
});

test('captures are irreversible even when the moving piece is not a pawn', () => {
  const before = position('8/8/8/8/8/8/4k3/4K2R w K - 0 1');
  const after = position('8/8/8/8/8/8/4k3/4K3 b - - 0 1', before,
    { from: 'h1', to: 'h2', piece: 'r', captured: 'p' });
  assert.equal(isIrreversibleTransition(before, after), true);
  assert.deepEqual(compactSearchPosition([before, after]), {
    fen: after.fen,
    moves: [],
    baseIndex: 1,
  });
});

test('castling-right changes reset repetition history even for reversible-looking king moves', () => {
  const before = position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 7 10');
  const after = position('r3k2r/8/8/8/8/8/8/R4K1R b kq - 8 10', before,
    { from: 'e1', to: 'f1', piece: 'k' });
  assert.equal(isIrreversibleTransition(before, after), true);
  const next = position('r3k2r/8/8/8/8/8/8/R3K1R w kq - 9 11', after,
    { from: 'e8', to: 'e7', piece: 'k' });
  const search = compactSearchPosition([before, after, next]);
  assert.equal(search.fen, after.fen);
  assert.deepEqual(search.moves, ['e8e7']);
});

test('compact search path rejects non-contiguous nodes', () => {
  const root = position('fen-root');
  const unrelated = position('fen-child', null, { from: 'a2', to: 'a3', piece: 'p' });
  assert.throws(() => compactSearchPosition([root, unrelated]), /contiguous chess positions/);
});
