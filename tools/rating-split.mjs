import { createHash } from 'node:crypto';

function playerIsHoldout(name, holdoutPercent) {
  const normalized = String(name ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const bucket = createHash('sha256').update(normalized).digest().readUInt32BE(0) % 100;
  return bucket < holdoutPercent;
}

export function playerSplit(name, holdoutPercent = 20) {
  if (!Number.isInteger(holdoutPercent) || holdoutPercent < 1 || holdoutPercent > 49) {
    throw new RangeError('holdoutPercent must be an integer between 1 and 49');
  }
  const holdout = playerIsHoldout(name, holdoutPercent);
  return holdout === null ? null : holdout ? 'holdout' : 'train';
}

/**
 * Split whole games by player identity. Cross-partition games are excluded,
 * so no player can appear in both the training and holdout sets.
 */
export function splitGamesByPlayer(games, holdoutPercent = 20) {
  if (!Array.isArray(games)) throw new TypeError('games must be an array');
  if (!Number.isInteger(holdoutPercent) || holdoutPercent < 1 || holdoutPercent > 49) {
    throw new RangeError('holdoutPercent must be an integer between 1 and 49');
  }

  const train = [];
  const holdout = [];
  const excluded = [];
  for (const game of games) {
    const white = playerIsHoldout(game?.white?.username, holdoutPercent);
    const black = playerIsHoldout(game?.black?.username, holdoutPercent);
    if (white === null || black === null || white !== black) {
      excluded.push(game);
    } else {
      (white ? holdout : train).push(game);
    }
  }
  return { train, holdout, excluded };
}
