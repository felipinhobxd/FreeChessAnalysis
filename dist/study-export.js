export function exportStudyPgn(ChessClass, rootFen, headers = {}, moves = [], result = '*') {
  if (typeof ChessClass !== 'function' || typeof rootFen !== 'string') {
    throw new TypeError('Invalid study export input.');
  }
  if (!Array.isArray(moves)) throw new TypeError('Study moves must be an array.');

  const chess = new ChessClass(rootFen);
  const standardFen = new ChessClass().fen();
  if (rootFen !== standardFen) {
    chess.setHeader('SetUp', '1');
    chess.setHeader('FEN', rootFen);
  }

  for (const [key, value] of Object.entries(headers || {})) {
    if (typeof value !== 'string' || !value || value === '?' ||
        ['FEN', 'SetUp', 'Result'].includes(key)) continue;
    chess.setHeader(key, value.replace(/["\r\n]/g, ' '));
  }

  for (const move of moves) {
    let applied;
    try {
      applied = chess.move({
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
      });
    } catch (error) {
      throw new Error('A variante contém um lance inválido e não pode ser exportada.', { cause: error });
    }
    if (!applied) throw new Error('A variante contém um lance inválido e não pode ser exportada.');
  }

  const outcome = ['1-0', '0-1', '1/2-1/2', '*'].includes(result) ? result : '*';
  chess.setHeader('Result', outcome);
  return chess.pgn({ maxWidth: 85 });
}
