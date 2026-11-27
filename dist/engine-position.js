function castlingRights(fen) {
  const fields = typeof fen === 'string' ? fen.trim().split(/\s+/) : [];
  return fields[2] || '-';
}

export function isIrreversibleTransition(parent, child) {
  const move = child?.move;
  if (!parent || !child || !move) return true;
  return move.piece === 'p' ||
    Boolean(move.captured) ||
    castlingRights(parent.fen) !== castlingRights(child.fen);
}

/**
 * Reconstruct a position from the latest irreversible transition.
 *
 * FEN carries the halfmove/fullmove counters, en-passant square and castling
 * rights. Replaying every reversible move since the last pawn move, capture,
 * or castling-right change retains the repetition history Stockfish needs,
 * while avoiding replaying the whole game for every reviewed position.
 */
export function compactSearchPosition(path) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new TypeError('A non-empty position path is required.');
  }
  if (typeof path[0]?.fen !== 'string' || !path[0].fen.trim()) {
    throw new TypeError('The search path must start with a valid FEN.');
  }

  let baseIndex = 0;
  for (let index = 1; index < path.length; index++) {
    const parent = path[index - 1];
    const child = path[index];
    if (child?.parent !== parent || typeof child?.fen !== 'string' ||
        typeof child?.move?.from !== 'string' || typeof child?.move?.to !== 'string') {
      throw new TypeError('The search path must contain contiguous chess positions.');
    }
    if (isIrreversibleTransition(parent, child)) baseIndex = index;
  }

  const moves = path.slice(baseIndex + 1).map(node =>
    node.move.from + node.move.to + (node.move.promotion || '')
  );
  return { fen: path[baseIndex].fen, moves, baseIndex };
}
