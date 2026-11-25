// Usage: node tools/fit-performance.mjs analyzed.ndjson [output.js]
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decisionProfile,predictBand} from '../dist/decision-profile.js';
const rows=readFileSync(process.argv[2],'utf8').trim().split(/\r?\n/).map(JSON.parse);
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const fold=name=>createHash('sha256').update(name.toLowerCase()).digest().readUInt32BE(0)%100;
const group=name=>fold(name)<60?'train':fold(name)<80?'calibration':'test';
const samples={train:[],calibration:[],test:[]};
function score(text){const mate=text.startsWith('#');const n=Number(mate?text.slice(1):text);return {type:mate?'mate':'cp',white:mate?Math.sign(n):100*n};}
for(const [w,b,wr,br,tc,moves] of rows){
  const f=group(w);if(f!==group(b))continue;
  const [base,inc=0]=tc.split('+').map(Number);const t=base+40*inc;
    if(process.argv[4]==='blitz' ? t<180 || t>=600 : t<600 || t>1500)continue;
  for(const side of [0,1]){
    const y=side?br:wr;if(!Number.isFinite(y)||y<=0)continue;
    const decisions=[];
    for(let i=2+side;i<moves.length;i+=2){
      // A final #0 in a PGN is ambiguous; SAN identifies the winner.
      const after=moves[i][0].includes('#')?{type:'mate',white:side?-1:1}:score(moves[i][1]);
      decisions.push({before:score(moves[i-1][1]),after,previous:score(moves[i-2][1]),san:moves[i][0],sign:side?-1:1});
    }
    const x=decisionProfile(decisions);if(x)samples[f].push({x,y});
  }
}
const train=samples.train;
if(train.length<200 || samples.calibration.length<30 || samples.test.length<30)throw Error('Insufficient player-disjoint samples');
const center=train[0].x.map((_,i)=>mean(train.map(r=>r.x[i])));
const scale=center.map((m,i)=>Math.sqrt(mean(train.map(r=>(r.x[i]-m)**2)))||1);
const weights=center.map(()=>0),intercept=mean(train.map(r=>r.y));
const norm=x=>x.map((v,i)=>(v-center[i])/scale[i]);
const line=x=>intercept+x.reduce((s,v,i)=>s+v*weights[i],0);
const design=train.map(({x,y})=>({x:norm(x),y}));
for(let iter=0;iter<750;iter++){
  const grad=weights.map(w=>.05*w);
  for(const {x,y} of design){const err=line(x)-y;for(let i=0;i<x.length;i++)grad[i]+=x[i]*err/train.length;}
  for(let i=0;i<weights.length;i++)weights[i]-=.08*grad[i];
}
const errors=samples.calibration.map(r=>Math.abs(line(norm(r.x))-r.y)).sort((a,b)=>a-b);
const radius=errors[Math.min(errors.length-1,Math.ceil(.8*(errors.length+1))-1)];
const model={population:'Lichess '+(process.argv[4] || 'rapid')+', November 2025',center,scale,weights,intercept,radius,min:Math.min(...train.map(r=>r.y)),max:Math.max(...train.map(r=>r.y)),accepted:true};
const held=samples.test.flatMap(r=>{const p=predictBand(r.x,model);return p?[{err:p.rating-r.y,base:intercept-r.y,covered:r.y>=p.low&&r.y<=p.high}]:[]});
function metrics(xs){return {mae:mean(xs.map(Math.abs)),rmse:Math.sqrt(mean(xs.map(v=>v*v))),bias:mean(xs)};}
model.validation={games:rows.length,sides:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,v.length])),shown:held.length,coverage:mean(held.map(r=>Number(r.covered))),...metrics(held.map(r=>r.err)),baseline:metrics(held.map(r=>r.base))};
model.accepted=held.length>=30 && model.validation.mae<model.validation.baseline.mae && model.validation.rmse<model.validation.baseline.rmse;
console.log(JSON.stringify(model.validation));
if(process.argv[3])writeFileSync(process.argv[3],'export const performanceModel = '+JSON.stringify(model,null,2)+';\n');
