// Stockfish scores in White's perspective. A decision describes one player's turn.
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const chance = cp => 1 / (1 + Math.exp(-0.00368208 * cp));
const unit = (score, sign) => score.type === 'mate' ? Math.sign(score.white) * sign * 1200 : Math.max(-1200, Math.min(1200, score.white * sign));

// The public game dump records one PV score, not a MultiPV tree. Pressure
// here describes observed score swings/forcing play, not unique legal moves.
export function decisionProfile(decisions) {
  const rows = decisions.map(({before, after, previous, san, sign}) => {
    const a = unit(before, sign), b = unit(after, sign);
    const loss = Math.max(0, chance(a) - chance(b));
    const centipawns = Math.min(500, Math.max(0, a - b));
    const pressured = /[x+#=]/.test(san) || (previous && Math.abs(chance(unit(previous, sign)) - chance(a)) > .1);
    const tactical = (before.type === 'mate' && a > 0 && !(after.type === 'mate' && b > 0)) || (a >= 200 && b < 80 && a-b >= 180);
    return {loss,centipawns,pressured,tactical};
  });
  if (rows.length < 12) return null;
  const losses=rows.map(r=>r.loss), avg=mean(losses);
  const pressure=rows.filter(r=>r.pressured);
  return [mean(rows.map(r=>Math.log1p(r.centipawns))), avg,
    Math.sqrt(mean(losses.map(v=>(v-avg)**2))), mean(losses.map(v=>Number(v>.15))),
    mean(losses.map(v=>Number(v<=.015))), pressure.length/rows.length,
    pressure.length ? mean(pressure.map(r=>r.loss)) : avg, mean(rows.map(r=>Number(r.tactical)))];
}

export function sideDecisions(path, side) {
  return path.slice(1).flatMap((n,i) => {
    // Public PGNs contain scores AFTER each ply. Drop the first two plies
    // identically in fitting and inference, and require completed reviews.
    if(i<2 || n.move?.color!==side || !n.coach?.before || !n.coach?.after) return [];
    return [{before:n.coach.before, after:n.coach.after, previous:path[i-1]?.coach?.after,
      san:n.move.san, sign:side==='w'?1:-1}];
  });
}

export function predictBand(features, model) {
  if (!features || !model.accepted) return null;
  const z=features.map((v,i)=>(v-model.center[i])/model.scale[i]);
  if(z.some(v=>Math.abs(v)>4))return null;
  const rating=model.intercept+z.reduce((s,v,i)=>s+v*model.weights[i],0);
  if(rating<model.min || rating>model.max)return null;
  return {rating:Math.round(rating/100)*100,low:Math.floor((rating-model.radius)/100)*100,high:Math.ceil((rating+model.radius)/100)*100};
}
