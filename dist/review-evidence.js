const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const decode = uci => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
const command = move => move.from + move.to + (move.promotion || '');
const sideScore = (score, sign) => !score ? null : score.type === 'mate'
  ? Math.sign(Number(score.white) || 0) * sign * 10000
  : sign * Number(score.white ?? score.value ?? 0);

function inspectLine(Chess, fen, pv, side) {
  const board = new Chess(fen);
  const moves = [];
  let material = 0;
  let capturedMajor = false;
  let givesCheck = false;
  let promotes = false;
  let mate = false;
  for (const uci of (pv || []).slice(0, 12)) {
    let move;
    try { move = board.move(decode(uci)); } catch { break; }
    const ours = move.color === side;
    if (move.captured) {
      material += (ours ? 1 : -1) * values[move.captured];
      if (ours && values[move.captured] >= 3) capturedMajor = true;
    }
    if (move.promotion) {
      material += (ours ? 1 : -1) * (values[move.promotion] - 1);
      if (ours) promotes = true;
    }
    if (ours && move.san.endsWith('+')) givesCheck = true;
    moves.push(move);
    if (move.san.endsWith('#')) {
      mate = ours;
      break;
    }
  }
  return { moves, material, capturedMajor, givesCheck, promotes, mate };
}

function mateDistance(score, sign) {
  return score?.type === 'mate' && sideScore(score, sign) > 0 && Number.isFinite(score.value)
    ? Math.abs(score.value) : null;
}

// The position is immediately after the attacker's move. To prove a mate in
// two, every legal defense must leave at least one immediate mating reply.
export function shortMateAfter(Chess, fen, distance) {
  if (distance !== 1 && distance !== 2) return false;
  const board = new Chess(fen);
  if (board.isCheckmate()) return true;
  if (distance === 1) return false;
  const replies = board.moves({ verbose: true });
  return replies.length > 0 && replies.every(reply =>
    new Chess(reply.after).moves().some(san => san.endsWith('#')));
}

function missedMate(Chess, best, after, actualLine, candidate, move, sign) {
  const distance = mateDistance(best, sign);
  if (!distance || move.san.endsWith('#')) return null;
  const afterMate = mateDistance(after, sign);
  const alternativeMate = mateDistance(actualLine, sign);
  const playedDistance = Math.min(alternativeMate ?? Infinity, afterMate === null ? Infinity : afterMate + 1);
  const short = distance <= 2;
  if (short) {
    if (!shortMateAfter(Chess, candidate.moves[0].after, distance)) return null;
    if (shortMateAfter(Chess, move.after, distance)) return null;
  } else if (best.depth < 12 || (after.depth > 0 && after.depth < 10)) {
    return null;
  }
  if (Number.isFinite(playedDistance)) {
    // For longer sequences demand a verified principal variation and a
    // meaningful delay. A one-move difference deeper in the search can flip.
    if (playedDistance <= distance || (!short && (!candidate.mate || playedDistance - distance < 2))) return null;
    return { kind: 'faster-mate', distance, playedDistance,
      reason: 'Havia mate em ' + distance + '. Depois do lance, o motor aponta mate em ' + (playedDistance - 1) + '.' };
  }
  if (short || candidate.mate || (after.depth >= 10 && sideScore(best, sign) - sideScore(after, sign) >= 1200)) {
    return { kind: 'mate', distance, reason: 'Havia mate forçado em ' + distance + '.' };
  }
  return null;
}

function discoveredQueenAttack(Chess, fen, move, side) {
  const before = new Chess(fen);
  const after = new Chess(move.after);
  for (const square of after.findPiece({ type: 'q', color: side === 'w' ? 'b' : 'w' })) {
    const previous = before.attackers(square, side);
    const attacker = after.attackers(square, side).find(from => {
      if (from === move.to || previous.includes(from)) return false;
      return 'brq'.includes(after.get(from)?.type ?? ' ');
    });
    if (attacker) return square;
  }
  return null;
}

export function missedOpportunity(Chess, before, node) {
  const coach = node?.coach;
  if (!coach?.before || !coach.after || !node.move || node.forced) return null;
  const side = node.move.color;
  const sign = side === 'w' ? 1 : -1;
  const played = command(node.move);
  const bestMove = coach.best || coach.choices?.[0]?.pv?.[0];
  if (!bestMove || bestMove === played) return null;
  const best = (coach.choices || []).find(line => line.pv?.[0] === bestMove) || coach.before;
  if (!best?.pv?.length) return null;
  const actualLine = (coach.choices || []).find(line =>
    line.pv?.[0] === played && (line.depth || 0) >= (best.depth || 0) - 2);
  if (mateDistance(best, sign) === null &&
      (mateDistance(coach.after, sign) !== null || mateDistance(actualLine, sign) !== null)) return null;
  const bestScore = sideScore(best, sign);
  const afterScore = sideScore(coach.after, sign);
  const playedScore = actualLine ? sideScore(actualLine, sign) : afterScore;
  if (mateDistance(best, sign) === null && actualLine && bestScore - playedScore < 75) return null;
  const candidate = inspectLine(Chess, before.fen, best.pv, side);
  const first = candidate.moves[0];
  if (!first) return null;
  const base = { move: bestMove, san: first.san };
  if (mateDistance(best, sign) !== null) {
    const miss = missedMate(Chess, best, coach.after, actualLine, candidate, node.move, sign);
    return miss ? { ...base, ...miss } : null;
  }

  const beforeScore = sideScore(coach.before, sign);
  const lost = Math.max(0, Math.min(beforeScore - afterScore, bestScore - playedScore));
  const depth = Number(best.depth || coach.before.depth || 0);
  const afterDepth = Number(coach.after.depth || 0);
  if (depth >= 12 && afterDepth >= 10 && bestScore >= -175 && playedScore <= -300 && lost >= 325) {
    const queen = discoveredQueenAttack(Chess, before.fen, first, side);
    if (queen) return { ...base, kind: 'attack', reason: first.san + ' abria um ataque descoberto sobre a dama em ' + queen + '.' };
  }

  const actual = inspectLine(Chess, node.fen ?? node.move.after, coach.after.pv || [], side);
  const forcing = candidate.givesCheck || candidate.promotes || candidate.mate;
  const netGain = candidate.material - Math.max(0, actual.material);
  const materialOpportunity = candidate.material >= 2.5 && (candidate.capturedMajor || candidate.promotes) && netGain >= 2;
  if (depth >= 10 && afterDepth >= 8 && beforeScore >= 125 && lost >= 150 && playedScore <= bestScore - 125 &&
      (materialOpportunity || (forcing && candidate.moves.length >= 3 && lost >= 190))) {
    if (materialOpportunity) {
      const captured = first.captured || candidate.moves.find(move => move.color === side && move.captured)?.captured;
      return { ...base, kind: 'piece', piece: captured || 'material',
        reason: 'Uma sequência forçada permitia ganhar material e manter o ganho após as melhores respostas.' };
    }
    return { ...base, kind: 'attack', reason: 'Havia uma sequência tática forçada que criava uma vantagem decisiva.' };
  }
  if (depth >= 14 && afterDepth >= 12 && bestScore >= 350 && playedScore <= 90 && lost >= 260 && best.pv.length >= 4) {
    return { ...base, kind: 'advantage', reason: 'A jogada desperdiçou uma vantagem decisiva que podia ser convertida.' };
  }
  return null;
}

function boardSquares(fen) {
  const result = new Map();
  const placement = String(fen || '').trim().split(/\s+/)[0] || '';
  const ranks = placement.split('/');
  if (ranks.length !== 8) return result;
  for (let row = 0; row < 8; row++) {
    let file = 0;
    for (const symbol of ranks[row]) {
      if (/[1-8]/.test(symbol)) {
        file += Number(symbol);
        continue;
      }
      if (!/[prnbqkPRNBQK]/.test(symbol) || file > 7) return new Map();
      result.set('abcdefgh'[file] + (8 - row), {
        type: symbol.toLowerCase(),
        color: symbol === symbol.toUpperCase() ? 'w' : 'b',
      });
      file++;
    }
    if (file !== 8) return new Map();
  }
  return result;
}

function pawnAttacksSquare(color, from, target) {
  const direction = color === 'w' ? 1 : -1;
  return Math.abs(from.charCodeAt(0) - target.charCodeAt(0)) === 1 &&
    Number(target[1]) - Number(from[1]) === direction;
}

function isPassedPawn(square, color, pieces) {
  const targetRank = Number(square[1]);
  const targetFile = square.charCodeAt(0);
  const enemy = color === 'w' ? 'b' : 'w';
  for (const [enemySquare, piece] of pieces) {
    if (piece.type !== 'p' || piece.color !== enemy) continue;
    const ahead = color === 'w'
      ? Number(enemySquare[1]) > targetRank
      : Number(enemySquare[1]) < targetRank;
    if (ahead && Math.abs(enemySquare.charCodeAt(0) - targetFile) <= 1) return false;
  }
  return true;
}

function isPawnSupported(square, color, pieces) {
  for (const [from, piece] of pieces) {
    if (piece.type === 'p' && piece.color === color && pawnAttacksSquare(color, from, square)) return true;
  }
  return false;
}

function isPawnAttacked(square, color, pieces) {
  const enemy = color === 'w' ? 'b' : 'w';
  for (const [from, piece] of pieces) {
    if (piece.type === 'p' && piece.color === enemy && pawnAttacksSquare(enemy, from, square)) return true;
  }
  return false;
}

function isOutpost(square, color, pieces) {
  const rank = Number(square[1]);
  const advanced = color === 'w' ? rank >= 5 : rank <= 4;
  const centralFile = 'cdef'.includes(square[0]);
  return advanced && centralFile &&
    isPawnSupported(square, color, pieces) &&
    !isPawnAttacked(square, color, pieces);
}

function filePawnCounts(pieces, file) {
  let white = 0;
  let black = 0;
  for (const [square, piece] of pieces) {
    if (square[0] !== file || piece.type !== 'p') continue;
    if (piece.color === 'w') white++;
    else black++;
  }
  return { w: white, b: black };
}

function rookFileTheme(square, color, pieces) {
  const rook = pieces.get(square);
  if (rook?.type !== 'r' || rook.color !== color) return null;
  const pawns = filePawnCounts(pieces, square[0]);
  if (pawns.w === 0 && pawns.b === 0) return 'Coluna aberta';
  if (pawns[color] === 0) return 'Coluna semiaberta';
  return null;
}

function pawnStructureTheme(move, beforePieces, afterPieces) {
  if (move.piece !== 'p') return null;
  const pawn = afterPieces.get(move.to);
  if (pawn?.type !== 'p' || pawn.color !== move.color) return null;

  const before = filePawnCounts(beforePieces, move.to[0])[move.color];
  const after = filePawnCounts(afterPieces, move.to[0])[move.color];
  if (after >= 2 && after > before) return 'Peões dobrados';

  const hasAdjacentPawn = pieces => [...pieces].some(([square, piece]) =>
    piece.type === 'p' && piece.color === move.color &&
    Math.abs(square.charCodeAt(0) - move.to.charCodeAt(0)) === 1
  );
  if (hasAdjacentPawn(beforePieces) && !hasAdjacentPawn(afterPieces)) {
    return 'Peão isolado';
  }
  return null;
}

function kingSquare(pieces, color) {
  for (const [square, piece] of pieces) {
    if (piece.type === 'k' && piece.color === color) return square;
  }
  return null;
}

function centerDistance(square) {
  if (!square) return Infinity;
  return Math.abs(square.charCodeAt(0) - 100.5) + Math.abs(Number(square[1]) - 4.5);
}

function createsOpposition(beforePieces, afterPieces, color) {
  const enemy = color === 'w' ? 'b' : 'w';
  const beforeOwn = kingSquare(beforePieces, color);
  const beforeEnemy = kingSquare(beforePieces, enemy);
  const afterOwn = kingSquare(afterPieces, color);
  const afterEnemy = kingSquare(afterPieces, enemy);
  const alignedOpposition = (a, b) => {
    if (!a || !b) return false;
    const sameLine = a[0] === b[0] || a[1] === b[1];
    const distance = Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) +
      Math.abs(Number(a[1]) - Number(b[1]));
    return sameLine && distance >= 2 && distance % 2 === 0;
  };
  return alignedOpposition(afterOwn, afterEnemy) &&
    !alignedOpposition(beforeOwn, beforeEnemy);
}

function improvesCentralPressure(Chess, node, color) {
  const central = ['d4', 'e4', 'd5', 'e5'];
  if (central.includes(node.move.to)) return true;
  if (!Chess) return false;
  try {
    const before = new Chess(node.parent.fen);
    const after = new Chess(node.fen || node.move.after);
    return central.some(square =>
      after.attackers(square, color).length > before.attackers(square, color).length
    );
  } catch {
    return false;
  }
}

function hasTacticalContinuation(Chess, node) {
  const pv = node.coach?.choices?.[0]?.pv || [];
  if (!pv.length) return false;
  const board = new Chess(node.parent.fen);
  for (const uci of pv.slice(0, 5)) {
    let move;
    try { move = board.move(decode(uci)); } catch { break; }
    if (move.captured || move.promotion || move.san.includes('+') || board.isCheckmate()) return true;
  }
  return false;
}

export function aspectEvidence(node, phase, Chess = null) {
  const move = node?.move;
  if (!move || !node.parent || !node.coach) return new Map();

  const tags = new Map();
  const color = move.color;
  const beforePieces = boardSquares(node.parent.fen);
  const afterPieces = boardSquares(node.fen || move.after);
  if (!beforePieces.size || !afterPieces.size) return tags;

  const fromRank = Number(move.from[1]);
  const toRank = Number(move.to[1]);
  const homeRank = color === 'w' ? 1 : 8;
  const forward = color === 'w' ? toRank > fromRank : toRank < fromRank;
  const development = ['n', 'b'].includes(move.piece) &&
    fromRank === homeRank && forward;
  const castle = move.san.startsWith('O-O');
  const earlyQueen = move.piece === 'q' && phase === 'opening' &&
    Number(node.parent.fen.split(/\s+/)[5]) <= 6;
  const central = improvesCentralPressure(Chess, node, color);
  const pawn = afterPieces.get(move.to);
  const passedPawn = move.piece === 'p' && pawn?.type === 'p' &&
    pawn.color === color && isPassedPawn(move.to, color, afterPieces);
  const pawnStructure = pawnStructureTheme(move, beforePieces, afterPieces);
  const outpost = move.piece === 'n' && isOutpost(move.to, color, afterPieces);
  const fileTheme = move.piece === 'r' && move.from[0] !== move.to[0]
    ? rookFileTheme(move.to, color, afterPieces)
    : null;
  const opposition = phase === 'endgame' &&
    createsOpposition(beforePieces, afterPieces, color);
  const ownKingBefore = kingSquare(beforePieces, color);
  const ownKingAfter = kingSquare(afterPieces, color);
  const kingCentralized = phase === 'endgame' && move.piece === 'k' &&
    centerDistance(ownKingAfter) < centerDistance(ownKingBefore);
  const tactical = Boolean(
    node.chanceLost || move.captured || move.promotion ||
    move.san.includes('+') || move.san.includes('#') ||
    (Chess && hasTacticalContinuation(Chess, node) &&
      ['brilliant', 'great', 'best', 'excellent', 'inaccuracy', 'mistake', 'blunder'].includes(node.classification))
  );

  const set = (area, reason) => tags.set(area, reason);

  if (phase === 'opening') {
    if (node.classification === 'theory') {
      set('Abertura', 'Teoria de abertura');
    } else if (development) {
      set('Abertura', 'Desenvolvimento de peças');
    } else if (castle) {
      set('Abertura', 'Roque e segurança do rei');
    } else if (central) {
      set('Abertura', 'Disputa pelo centro');
    } else if (earlyQueen) {
      set('Abertura', 'Saída precoce da dama');
    }

    if (castle) set('Princípios', 'Segurança do rei');
    else if (development) set('Princípios', 'Desenvolvimento');
    else if (central) set('Princípios', 'Controle do centro');
    else if (earlyQueen) set('Princípios', 'Desenvolvimento antes de expor a dama');
  }

  if (tactical) {
    set('Táticas', node.chanceLost
      ? 'Oportunidade tática perdida'
      : move.promotion
        ? 'Promoção'
        : move.captured
          ? 'Captura e cálculo'
          : move.san.includes('#')
            ? 'Xeque-mate'
            : move.san.includes('+')
              ? 'Ataque com xeque'
              : 'Continuação tática');
  }

  if (phase === 'middlegame') {
    if (passedPawn) set('Estratégia', 'Avanço de peão passado');
    else if (outpost) set('Estratégia', 'Posto avançado protegido');
    else if (pawnStructure) set('Estratégia', pawnStructure);
    else if (fileTheme) set('Estratégia', fileTheme);
    if (central) set('Princípios', 'Pressão e ocupação do centro');
    else if (outpost) set('Princípios', 'Casa avançada protegida');
    else if (pawnStructure) set('Princípios', 'Estrutura de peões');
  }

  if (phase === 'endgame') {
    if (passedPawn) {
      set('Final', 'Peão passado');
      set('Princípios', 'Avanço do peão passado');
    } else if (move.piece === 'p' && pawn?.type === 'p' &&
      pawn.color === color &&
      (color === 'w' ? toRank >= 7 : toRank <= 2)) {
      set('Final', 'Peão avançado');
      set('Princípios', 'Avanço do peão');
    } else if (kingCentralized) {
      set('Final', 'Centralização do rei');
      set('Princípios', 'Atividade do rei');
    } else if (opposition) {
      set('Final', 'Oposição entre os reis');
      set('Princípios', 'Oposição');
    } else if (fileTheme) {
      set('Final', 'Atividade da torre em coluna aberta');
      set('Princípios', fileTheme);
    }
  }

  return tags;
}

const aspectPoints = {
  brilliant: 2.2,
  great: 1.8,
  excellent: 1.6,
  best: 1.45,
  theory: 1.35,
  good: 1,
  inaccuracy: 0,
  mistake: -.8,
  'chance-lost': -1.3,
  blunder: -2,
};

export function aspectGrade(nodes) {
  const scored = (nodes || []).filter(node =>
    node && Number.isFinite(aspectPoints[node.classification])
  );
  if (!scored.length) return null;
  const score = scored.reduce((sum, node) =>
    sum + aspectPoints[node.classification], 0
  ) / scored.length;
  const key = score >= 1.95 ? 'brilliant'
    : score >= 1.55 ? 'excellent'
      : score >= 1.2 ? 'great'
        : score >= .7 ? 'good'
          : score >= .1 ? 'inaccuracy'
            : score >= -.75 ? 'mistake' : 'blunder';
  return {
    key,
    score,
    count: scored.length,
    errors: scored.filter(node =>
      ['inaccuracy', 'mistake', 'blunder', 'chance-lost'].includes(node.classification)
    ).length,
    misses: scored.filter(node => node.classification === 'chance-lost').length,
  };
}
