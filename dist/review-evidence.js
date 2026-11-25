const values={p:1,n:3,b:3,r:5,q:9,k:0};
const decode=u=>({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
const command=m=>m.from+m.to+(m.promotion||'');
const sideScore=(e,sign)=>!e?null:e.type==='mate'?Math.sign(Number(e.white)||0)*sign*10000:sign*Number(e.white??e.value??0);
function inspectLine(Chess,fen,pv,side){
 const board=new Chess(fen),moves=[];let material=0,capturedMajor=false,givesCheck=false,promotes=false,mate=false;
 for(const u of (pv||[]).slice(0,12)){let m;try{m=board.move(decode(u))}catch{break}if(!m)break;
  if(m.captured){material+=(m.color===side?1:-1)*(values[m.captured]||0);if(m.color===side&&(values[m.captured]||0)>=3)capturedMajor=true}
  if(m.promotion){material+=(m.color===side?1:-1)*Math.max(0,(values[m.promotion]||0)-1);if(m.color===side)promotes=true}
  if(m.color===side&&m.san.includes('+'))givesCheck=true;moves.push(m);if(board.isCheckmate()){mate=m.color===side;break}
 }
 return{moves,material,capturedMajor,givesCheck,promotes,mate};
}
const winningMate=(e,sign)=>e?.type==='mate'&&sideScore(e,sign)>0;
export function missedOpportunity(Chess,before,node){
 const coach=node?.coach;if(!coach?.best||!coach.before||!coach.after||!node.move||node.forced)return null;
 const side=node.move.color,sign=side==='w'?1:-1,played=command(node.move),bestMove=coach.best||coach.choices?.[0]?.pv?.[0];
 if(!bestMove||bestMove===played)return null;
 const best=(coach.choices||[]).find(l=>l.pv?.[0]===bestMove)||coach.before;if(!best?.pv?.length)return null;
 const actualLine=(coach.choices||[]).find(l=>l.pv?.[0]===played&&(l.depth||0)>=(best.depth||0)-2);
 if(actualLine){const b=sideScore(best,sign),p=sideScore(actualLine,sign);if(b!==null&&p!==null&&b-p<75)return null;if(winningMate(actualLine,sign))return null}
 if(winningMate(coach.after,sign))return null;
 const candidate=inspectLine(Chess,before.fen,best.pv,side),first=candidate.moves[0];if(!first)return null;
 const base={move:bestMove,san:first.san},depth=Number(best.depth||coach.before.depth||0),afterDepth=Number(coach.after.depth||0);
 if(candidate.mate&&candidate.moves.length===1)return{...base,kind:'mate',distance:1,reason:'Havia xeque-mate em um lance.'};
 const beforeScore=sideScore(coach.before,sign),afterScore=sideScore(coach.after,sign),bestScore=sideScore(best,sign),playedScore=actualLine?sideScore(actualLine,sign):afterScore;
 if(beforeScore===null||afterScore===null||bestScore===null||playedScore===null)return null;
 const lost=Math.max(0,Math.min(beforeScore-afterScore,bestScore-playedScore));
 if(winningMate(best,sign)&&!winningMate(coach.after,sign)&&depth>=12&&(candidate.mate||(lost>=1200&&afterDepth>=10)))
  return{...base,kind:'mate',distance:Math.abs(Number(best.value||0)),reason:'A continuação principal levava a um mate forçado que foi perdido.'};
 const actual=inspectLine(Chess,node.fen,coach.after.pv||[],side);
 const forcing=candidate.givesCheck||candidate.promotes||candidate.mate;
 const netGain=candidate.material-Math.max(0,actual.material);
 const materialOpportunity=candidate.material>=2.5&&(candidate.capturedMajor||candidate.promotes)&&netGain>=2;
 if(depth>=10&&afterDepth>=8&&beforeScore>=125&&lost>=150&&playedScore<=bestScore-125&&
    (materialOpportunity||(forcing&&candidate.moves.length>=3&&lost>=190))){
  if(materialOpportunity){const captured=first.captured||candidate.moves.find(m=>m.color===side&&m.captured)?.captured;
   return{...base,kind:'piece',piece:captured||'material',reason:'Uma sequência forçada permitia ganhar material e manter o ganho após as melhores respostas.'}}
  return{...base,kind:'attack',reason:'Havia uma sequência tática forçada que criava uma vantagem decisiva.'};
 }
 if(depth>=14&&afterDepth>=12&&bestScore>=350&&playedScore<=90&&lost>=260&&best.pv.length>=4)
  return{...base,kind:'advantage',reason:'A jogada desperdiçou uma vantagem decisiva que podia ser convertida.'};
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
