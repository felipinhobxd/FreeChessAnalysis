const values={p:1,n:3,b:3,r:5,q:9,k:0};
const command=m=>m.from+m.to+(m.promotion||'');
const decode=u=>({from:u.slice(0,2),to:u.slice(2,4),promotion:u[4]});
function trajectory(Chess,fen,pv,side) {
  const board=new Chess(fen), points=[], moves=[];
  let gain=0;
  for(const u of pv.slice(0,8)){
    let m;try{m=board.move(decode(u))}catch{break}
    gain+=(m.color===side?1:-1)*((values[m.captured]||0)+(m.promotion?values[m.promotion]-1:0));
    moves.push(m);points.push(gain);
  }
  return {points,moves};
}

export function missedOpportunity(Chess,before,node){
  const coach=node.coach;
  if(!coach?.best || !coach.before || !coach.after || node.forced || coach.best===command(node.move))return null;
  const side=node.move.color,sign=side==='w'?1:-1;
  const a=coach.before,b=coach.after, played=command(node.move);
  const best=coach.choices.find(l=>l.pv[0]===coach.best);
  if(!best)return null;
  const candidate=trajectory(Chess,before.fen,best.pv,side);
  const first=candidate.moves[0];if(!first)return null;
  const base={move:coach.best,san:first.san};
  const winningMate=s=>s.type==='mate'&&sign*s.white>0;
  const alternative=coach.choices.find(l=>l.pv[0]===played && l.depth>=best.depth-1);
  if(winningMate(b) || (alternative && winningMate(alternative)))return null;
  // A mate in one is directly verifiable. Longer mates need corroboration;
  // a horizon change from mate to a still decisive CP score is inconclusive.
  if(winningMate(a)){
    if(first.san.endsWith('#'))return {...base,kind:'mate',distance:1};
    if((a.depth||0)>=12 && candidate.moves.length>=3 && (b.type==='mate'||sign*b.white<200))
      return {...base,kind:'mate',distance:Math.abs(a.value)};
    return null;
  }
  if(a.type!=='cp'||sign*a.white<135 || (a.depth||0)<10)return null;
  const post=b.type==='mate'?Math.sign(sign*b.white)*1500:sign*b.white;
  const loss=sign*a.white-post;
  if(loss<140 || post>180)return null;
  if(alternative?.type==='cp' && Math.abs(alternative.white-best.white)<65)return null;
  const actual=trajectory(Chess,before.fen,[played,...(b.pv||[])],side);
  const horizon=Math.min(candidate.points.length,actual.points.length);
  // Compare both branches after the same number of plies, including replies.
  const even=horizon-horizon%2;
  if(even>=4){
    const stable=[even-3,even-1].every(i=>candidate.points[i]>=2 && candidate.points[i]-actual.points[i]>=2);
    if(stable && candidate.moves.slice(0,even).some(m=>m.captured||m.promotion)){
      if(first.captured && values[first.captured]>=3)return {...base,kind:'piece',piece:first.captured};
      return {...base,kind:'attack'};
    }
  }
  if(sign*a.white>=350 && post<=75 && (a.depth||0)>=14 && (b.depth||0)>=12 && best.pv.length>=4)
    return {...base,kind:'advantage'};
  return null;
}

function squares(fen){
  const result=new Map();let rank=8,file=0;
  for(const c of fen.split(' ')[0]){
    if(c==='/'){rank--;file=0}
    else if(/[1-8]/.test(c))file+=Number(c);
    else{result.set('abcdefgh'[file]+rank,c);file++}
  }
  return result;
}

export function aspectEvidence(node,phase) {
  const m=node.move, side=m.color, home=side==='w'?'1':'8';
  const tags=new Map(), pieces=squares(node.parent.fen);
  const opening=phase==='opening',ending=phase==='endgame';
  const center=['d4','e4','d5','e5'].includes(m.to);
  const develop='nb'.includes(m.piece)&&m.from[1]===home;
  const castle=m.san.startsWith('O-O');
  const set=(area,why)=>tags.set(area,why);
  if(opening)set('Abertura',node.classification==='theory'?'Teoria':develop?'Desenvolvimento':castle?'Segurança do rei':center?'Centro':'Abertura');
  if(castle||develop||center)set('Princípios',castle?'Segurança do rei':develop?'Desenvolvimento':'Centro');
  if(node.chanceLost||node.classification==='brilliant'||node.classification==='great'||node.move.promotion||node.move.san.includes('#')||node.coach.choices[0]?.pv.length>=3 && node.move.captured && Math.abs((node.coach.before.white||0)-(node.coach.after.white||0))>90)
    set('Táticas',node.chanceLost?'Oportunidade perdida':m.promotion?'Promoção':'Táticas');
  if(!ending && m.piece==='r' && ![...pieces].some(([s,p])=>s[0]===m.to[0]&&p.toLowerCase()==='p')){
    set('Estratégia','Coluna aberta');set('Princípios','Atividade das peças');
  }
  if(!opening && !ending && !tags.has('Táticas') && !m.captured && !m.san.includes('+')){
    if(m.piece==='p')set('Estratégia','Estrutura de peões');
    else if('nbrq'.includes(m.piece))set('Estratégia','Atividade das peças');
  }
  if(ending){
    const passed=m.piece==='p' && ![...pieces].some(([s,p])=>p===(side==='w'?'p':'P') && Math.abs(s.charCodeAt(0)-m.to.charCodeAt(0))<=1 && (Number(s[1])-Number(m.to[1]))*(side==='w'?1:-1)>0);
    set('Final',m.piece==='k'?'Atividade do rei':passed?'Peão passado':'Final');
  }
  return tags;
}
