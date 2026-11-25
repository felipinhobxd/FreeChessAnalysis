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

function boardSquares(fen){const result=new Map();let rank=8,file=0;for(const c of fen.split(' ')[0]){if(c==='/'){rank--;file=0}else if(/[1-8]/.test(c))file+=Number(c);else{result.set('abcdefgh'[file]+rank,c);file++}}return result}
function hasTacticalContinuation(Chess,node){const pv=node.coach?.choices?.[0]?.pv||[];if(!pv.length)return false;const board=new Chess(node.parent.fen);for(const u of pv.slice(0,5)){let m;try{m=board.move(decode(u))}catch{break}if(!m)break;if(m.captured||m.promotion||m.san.includes('+')||board.isCheckmate())return true}return false}
export function aspectEvidence(node,phase,Chess=null){
 const m=node?.move;if(!m||!node.parent||!node.coach)return new Map();
 const tags=new Map(),home=m.color==='w'?'1':'8',squares=boardSquares(node.parent.fen);
 const center=['d4','e4','d5','e5'].includes(m.to),develop='nb'.includes(m.piece)&&m.from[1]===home;
 const castle=m.san.startsWith('O-O'),earlyQueen=m.piece==='q'&&phase==='opening';
 const tactic=Boolean(node.chanceLost||m.captured||m.promotion||m.san.includes('+')||m.san.includes('#')||
  (Chess&&hasTacticalContinuation(Chess,node)&&['brilliant','great','best','excellent','inaccuracy','mistake','blunder'].includes(node.classification)));
 const set=(a,r)=>tags.set(a,r);
 if(phase==='opening'){set('Abertura',node.classification==='theory'?'Teoria de abertura':develop?'Desenvolvimento':castle?'Roque e segurança do rei':center?'Disputa pelo centro':earlyQueen?'Saída da dama':'Precisão na abertura');
  set('Princípios',castle?'Segurança do rei':develop?'Desenvolvimento':center?'Controle do centro':earlyQueen?'Segurança e desenvolvimento':'Princípios de abertura')}
 if(tactic)set('Táticas',node.chanceLost?'Oportunidade tática perdida':m.promotion?'Promoção':m.captured?'Captura e cálculo':m.san.includes('#')?'Xeque-mate':m.san.includes('+')?'Ataque com xeque':'Continuação tática');
 if(phase==='middlegame'&&!tactic){const openFile=m.piece==='r'&&![...squares].some(([sq,p])=>sq[0]===m.to[0]&&p.toLowerCase()==='p');
  set('Estratégia',m.piece==='p'?'Estrutura de peões':openFile?'Coluna aberta':'Atividade e coordenação das peças');
  if(!tags.has('Princípios'))set('Princípios',center?'Controle do centro':'Coordenação das peças')}
 if(phase==='endgame'){const passed=m.piece==='p'&&![...squares].some(([sq,p])=>p===(m.color==='w'?'p':'P')&&Math.abs(sq.charCodeAt(0)-m.to.charCodeAt(0))<=1&&(Number(sq[1])-Number(m.to[1]))*(m.color==='w'?1:-1)>0);
  set('Final',m.piece==='k'?'Atividade do rei':passed?'Peão passado':'Técnica de final');
  set('Princípios',m.piece==='k'?'Atividade do rei':'Coordenação no final')}
 if(!['opening','middlegame','endgame'].includes(phase)&&(castle||develop||center))set('Princípios',castle?'Segurança do rei':develop?'Desenvolvimento':'Controle do centro');
 return tags;
}
const aspectPoints={brilliant:2.2,great:1.8,excellent:1.6,best:1.45,theory:1.35,good:1,inaccuracy:0,mistake:-.8,'chance-lost':-1.3,blunder:-2};
export function aspectGrade(nodes){const scored=(nodes||[]).filter(n=>n&&Number.isFinite(aspectPoints[n.classification]));if(!scored.length)return null;
 const score=scored.reduce((sum,n)=>sum+aspectPoints[n.classification],0)/scored.length;
 const key=score>=1.95?'brilliant':score>=1.55?'excellent':score>=1.2?'great':score>=.7?'good':score>=.1?'inaccuracy':score>=-.75?'mistake':'blunder';
 return{key,score,count:scored.length,errors:scored.filter(n=>['inaccuracy','mistake','blunder','chance-lost'].includes(n.classification)).length,misses:scored.filter(n=>n.classification==='chance-lost').length};
}
