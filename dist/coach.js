const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PIECE = { p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama' };

export const isTrainingMove = node => ['inaccuracy', 'mistake', 'blunder', 'chance-lost'].includes(node.classification) && Boolean(node.coach?.best);

const decode = move => ({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });

function lineFrom(Chess, fen, line) {
  const chess = new Chess(fen);
  const moves = [];
  const material = [];
  for (const command of line.slice(0, 6)) {
    const number = chess.fen().split(' ')[5];
    const color = chess.turn();
    let move;
    try { move = chess.move(decode(command)); } catch { break; }
    const caption = color === 'w' ? number + '. ' + move.san : moves.length ? move.san : number + '… ' + move.san;
    moves.push({ ...move, caption });
    material.push(chess.board().flat().reduce((total, piece) => total + (piece ? VALUE[piece.type] * (piece.color === 'w' ? 1 : -1) : 0), 0));
  }
  return { moves, material, text: moves.map(move => move.caption).join(' ') };
}

export function inspectMove(Chess, node) {
  const { before, after, best, choices } = node.coach;
  const fen = node.parent.fen;
  const played = node.move.from + node.move.to + (node.move.promotion || '');
  const recommended = choices.find(line => line.pv[0] === best)?.pv ?? [best];
  const chosenLine = lineFrom(Chess, fen, [played, ...after.pv]);
  const bestLine = lineFrom(Chess, fen, recommended);
  const proposal = bestLine.moves[0]?.san;
  const player = node.move.color === 'w' ? 1 : -1;
  const opponentMate = after.type === 'mate' && after.white * player < 0;
  const missedMate = before.type === 'mate' && before.white * player > 0 && (after.type !== 'mate' || after.white * player < 0);
  const reply = chosenLine.moves[1];
  const overlap = Math.min(chosenLine.material.length, bestLine.material.length);
  const even = overlap - overlap % 2;
  const extraMaterial = even ? player * (bestLine.material[even - 1] - chosenLine.material[even - 1]) : 0;
  const alreadyLosingToMate = before.type === 'mate' && before.white * player < 0;

  let reason;
  if (node.chanceLost?.kind === 'faster-mate') {
    const { distance, playedDistance, san } = node.chanceLost;
    reason = 'Havia mate em ' + distance + ' com ' + san + '. Depois do lance, o motor aponta mate em ' + (playedDistance - 1) + '.';
  } else if (node.chanceLost?.kind === 'mate') {
    reason = 'Você deixou escapar um mate forçado. A melhor sequência começava com ' + (node.chanceLost.san || proposal) + '.';
  } else if (node.chanceLost?.kind === 'piece') {
    const pieceName = PIECE[node.chanceLost.piece] || 'peça';
    reason = 'Você deixou passar ' + proposal + ', que capturava uma peça sem defesa suficiente (' + pieceName + '). A posição ainda era favorável, mas a oportunidade de ganhar material foi perdida.';
  } else if (node.chanceLost?.kind === 'attack') {
    reason = node.chanceLost.reason;
  } else if (node.chanceLost?.kind === 'advantage') {
    reason = node.chanceLost.reason;
  } else if (best === played) {
    reason = 'O Stockfish escolheu ' + node.move.san + ' como a melhor opção desta posição.';
  } else if (opponentMate && !alreadyLosingToMate && Math.abs(after.value) <= 1) {
    reason = reply
      ? 'Depois de ' + node.move.san + ', o adversário dá mate imediatamente com ' + reply.san + '. O motor recomenda ' + proposal + '.'
      : node.move.san + ' encerrou a posição em mate contra o lado que jogou.';
  } else if (opponentMate && !alreadyLosingToMate) {
    reason = 'Depois de ' + node.move.san + ', o adversário passa a ter mate forçado em ' + Math.abs(after.value) + '. Com ' + proposal + ', essa sequência é evitada.';
  } else if (missedMate) {
    reason = proposal + ' iniciava um mate forçado em ' + Math.abs(before.value) + '. Ao jogar ' + node.move.san + ', você perdeu essa sequência.';
  } else if (isTrainingMove(node) && extraMaterial >= 2) {
    const threat = reply?.captured ? 'A resposta ' + reply.san + ' captura ' + (PIECE[reply.captured] === 'dama' || PIECE[reply.captured] === 'torre' ? 'uma ' : 'um ') + PIECE[reply.captured] + '. ' : '';
    reason = threat + 'Na continuação analisada, ' + proposal + ' preserva cerca de ' + extraMaterial + ' ponto' + (extraMaterial === 1 ? '' : 's') + ' a mais de material.';
  } else if (isTrainingMove(node)) {
    const firstReply = reply ? ' O adversário pode responder com ' + reply.san + '.' : '';
    reason = 'A avaliação piora para o lado que jogou ' + node.move.san + '.' + firstReply + ' Compare essa sequência com a continuação após ' + proposal + '.';
  } else {
    reason = 'A posição após ' + node.move.san + ' ficou próxima da melhor linha encontrada, que começa com ' + proposal + '.';
  }
  return { before, after, played: node.move.san, proposal, reason, chosen: chosenLine.text, recommended: bestLine.text };
}

export function acceptedMove(coach, command) {
  if (command === coach.best) return true;
  const alternative = coach.choices.find(line => line.pv[0] === command && line.depth === coach.before.depth);
  if (!alternative || alternative.type !== coach.before.type) return false;
  if (alternative.type === 'mate') {
    return Math.sign(alternative.value) === Math.sign(coach.before.value) && Math.abs(alternative.value) === Math.abs(coach.before.value);
  }
  return Math.abs(alternative.value - coach.before.value) <= 20;
}
