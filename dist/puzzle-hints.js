// Return only the origin square of the engine's recommended puzzle move.
// The destination remains hidden so the hint identifies the piece, not the move.
export function puzzleHintSquare(Chess, fen, coach) {
  if (typeof fen !== 'string' || !fen.trim() || !coach || typeof coach !== 'object') return null;

  const candidates = [
    coach.best,
    ...(Array.isArray(coach.choices) ? coach.choices.map(line => line?.pv?.[0]) : []),
  ];
  const seen = new Set();

  for (const command of candidates) {
    if (typeof command !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(command) || seen.has(command)) continue;
    seen.add(command);
    try {
      const move = {
        from: command.slice(0, 2),
        to: command.slice(2, 4),
      };
      if (command.length === 5) move.promotion = command[4];
      const board = new Chess(fen);
      const legalMove = board.move(move);
      if (legalMove) return legalMove.from;
    } catch {
      // A stale or malformed PV must not highlight an unrelated square.
    }
  }
  return null;
}
