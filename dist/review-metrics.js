// Lichess-style accuracy and Lichess-equivalent performance reference curves.
// Performance curves use 981,166 analysed Lichess games from September 2025.
const CURVES={
 blitz:[
 [500,70,78.6,85],[600,70,78.9,86],[700,72,79.8,86],[800,74,80.7,87],[900,75,81.5,87],
 [1000,76,82.2,88],[1100,77,82.7,88],[1200,78,83.3,88],[1300,78,83.6,89],[1400,79,84.1,89],
 [1500,80,84.7,89],[1600,80,85.0,89],[1700,81,85.4,90],[1800,81,85.8,90],[1900,82,86.4,90],
 [2000,83,87.0,91],[2100,84,87.6,91],[2200,85,88.3,92],[2300,85,88.9,92],[2400,86,89.4,93],
 [2500,87,89.9,93],[2600,88,90.8,94]],
 rapid:[
 [500,69,77.7,85],[600,69,78.4,86],[700,71,78.9,86],[800,73,80.0,87],[900,74,81.1,87],
 [1000,75,81.8,88],[1100,77,82.8,88],[1200,77,83.3,88],[1300,78,83.9,89],[1400,79,84.4,89],
 [1500,80,85.1,90],[1600,81,85.4,90],[1700,81,86.0,90],[1800,82,86.5,91],[1900,83,87.3,91],
 [2000,84,88.0,92],[2100,85,88.9,92],[2200,86,89.7,93],[2300,87,90.6,94],[2400,88,91.4,95],
 [2500,89,92.2,95]]
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
function stdev(xs){const m=mean(xs);return m===null||xs.length<2?0:Math.sqrt(xs.reduce((a,x)=>a+(x-m)**2,0)/xs.length)}
export function moveAccuracyFromWinLoss(loss){
 if(!Number.isFinite(loss)||loss<=0)return 100;
 return clamp(103.1668100711649*Math.exp(-0.04354415386753951*loss)-3.166924740191411+1,0,100);
}
export function aggregateGameAccuracy(path,side,winPercent){
 const positions=[];for(const node of path){if(!node?.evaluation)break;positions.push(node)}
 const plies=positions.length-1;if(plies<1)return null;
 const wp=positions.map(node=>{const white=winPercent(node.evaluation);return side==='w'?white:100-white});
 const size=clamp(Math.floor(plies/10),2,8);
 const windows=[
  ...Array.from({length:Math.max(0,size-2)},()=>wp.slice(0,size)),
  ...Array.from({length:Math.max(0,wp.length-size+1)},(_,i)=>wp.slice(i,i+size))
 ];
 const weights=windows.map(window=>clamp(stdev(window),0.5,12));
 const scores=[],moveWeights=[];
 for(let i=0;i<plies;i++){
  if(positions[i+1].move?.color!==side)continue;
  scores.push(moveAccuracyFromWinLoss(Math.max(0,wp[i]-wp[i+1])));
  moveWeights.push(weights[i]??1);
 }
 if(!scores.length)return null;
 const weighted=scores.reduce((s,x,i)=>s+x*moveWeights[i],0)/moveWeights.reduce((s,x)=>s+x,0);
 const harmonic=scores.length/scores.reduce((s,x)=>s+1/Math.max(x,1),0);
 return Math.round((weighted+harmonic)*5)/10;
}
export function gameTimeClass(headers={}){
 const m=/^(\d+)(?:\+(\d+))?$/.exec(String(headers.TimeControl||'').trim());if(!m)return null;
 const seconds=Number(m[1])+40*Number(m[2]||0);
 if(seconds<180)return'bullet';if(seconds<480)return'blitz';if(seconds<=1500)return'rapid';return'classical';
}
function invert(rows,column,accuracy){
 const first=rows[0],last=rows.at(-1);
 if(accuracy<=first[column])return{value:first[0]+50,bound:'below'};
 if(accuracy>=last[column])return{value:last[0]+50,bound:'above'};
 for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];if(accuracy<=b[column]){
  const span=b[column]-a[column],t=span?(accuracy-a[column])/span:1;
  return{value:a[0]+50+t*(b[0]-a[0]),bound:null};
 }}
 return{value:last[0]+50,bound:'above'};
}
export function estimatePerformance(path,side,headers={}){
 const moves=path.slice(1).filter(n=>n.move?.color===side&&Number.isFinite(n.accuracy));
 if(moves.length<10||path.length-1<20)return{available:false,reason:'short',moves:moves.length};
 const timeClass=gameTimeClass(headers);
 if(!timeClass)return{available:false,reason:'time-control',moves:moves.length};
 if(timeClass==='bullet')return{available:false,reason:'bullet',moves:moves.length};
 if(timeClass==='classical')return{available:false,reason:'classical',moves:moves.length};
 const accuracy=mean(moves.map(n=>n.accuracy)),table=CURVES[timeClass];
 if(accuracy<table[0][2]||accuracy>table.at(-1)[2])return{available:false,reason:'outside-range',moves:moves.length,accuracy:Math.round(accuracy*10)/10};
 const c=invert(table,2,accuracy),lo=invert(table,3,accuracy),hi=invert(table,1,accuracy);
 const round=x=>Math.round(x/50)*50;
 return{available:true,rating:round(c.value),low:round(Math.min(lo.value,c.value)),high:round(Math.max(hi.value,c.value)),
  lowBound:lo.bound,highBound:hi.bound,timeClass,accuracy:Math.round(accuracy*10)/10,moves:moves.length};
}
export function phaseForPosition(fen,ply){
 const board=String(fen||'').split(' ')[0].replace(/[1-8/]/g,'');
 const value={q:9,r:5,b:3,n:3};
 const material=[...board].reduce((s,p)=>s+(value[p.toLowerCase()]||0),0);
 if(material<=13)return'endgame';if(ply<=20)return'opening';return'middlegame';
}
