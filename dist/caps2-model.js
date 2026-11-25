// Provisional Chess.com-oriented accuracy curve. Only replaced after a
// player-disjoint fit improves the untouched Chess.com holdout.
export const calibrationModel = Object.freeze({
  version: 1,
  status: 'provisional',
  source: 'Published calibration methods; local Chess.com training sample not yet fitted',
  winK: 0.00368208,
  decay: 0.055,
  floor: 0,
  offset: 0,
  aggregation: 'mean',
  forcedPolicy: 'include',
  trainedGames: 0,
  heldOutGames: 0,
  heldOutSides: 0,
  heldOutMae: null,
  engine: 'Stockfish 19',
  depth: 14
});
