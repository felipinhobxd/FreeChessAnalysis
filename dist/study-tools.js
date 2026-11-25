import { isTrainingMove } from './coach.js';

export function parseGameLink(input) {
  let url;
  try { url = new URL(input.trim()); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  if (['chess.com', 'www.chess.com'].includes(url.hostname)) {
    const match = /^\/(?:analysis\/)?game\/(live|daily)\/(\d{1,16})\/?$/.exec(url.pathname);
    return match ? { platform: 'chesscom', type: match[1], id: match[2] } : null;
  }
  if (['lichess.org', 'www.lichess.org'].includes(url.hostname)) {
    const match = /^\/(?:game\/)?([A-Za-z0-9]{8})(?:\/(white|black))?\/?$/.exec(url.pathname);
    return match ? { platform: 'lichess', id: match[1], side: match[2]?.[0] } : null;
  }
  return null;
}

const weights = { blunder: 28, 'chance-lost': 23, mistake: 15, inaccuracy: 5 };

export function reviewHighlights(path, side, chance) {
  const choices = path.flatMap((node, index) => {
    if (!isTrainingMove(node) || (side !== 'all' && node.move.color !== side)) return [];
    const sign = node.move.color === 'w' ? 1 : -1;
    const swing = Math.max(0, sign * (chance(node.coach.before) - chance(node.coach.after)));
    const mate = node.chanceLost?.distance;
    return [{ node, index, value: swing + weights[node.classification] + (mate === 1 ? 12 : mate === 2 ? 6 : 0) }];
  });
  return choices.sort((a, b) => b.value - a.value || a.index - b.index)
    .slice(0, 5).sort((a, b) => a.index - b.index).map(item => item.node);
}

export function validStudy(record) {
  return Boolean(record && /^[a-f0-9]{64}$/.test(record.id) &&
    Number.isFinite(record.date) && typeof record.name === 'string' &&
    (typeof record.data?.pgn === 'string' || typeof record.data?.fen === 'string'));
}

export function mergeStudies(first, second) {
  const merged = new Map();
  for (const item of [...first, ...second]) {
    if (!validStudy(item)) continue;
    const existing = merged.get(item.id);
    if (!existing || item.date >= existing.date) merged.set(item.id, item);
  }
  return [...merged.values()].sort((a, b) => b.date - a.date);
}
