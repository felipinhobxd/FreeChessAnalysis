// Reanalyze a small, player-disjoint holdout slice with the shipped SF19 Lite
// build. Output describes transfer between archive and local analysis only.
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import {Chess} from 'chess.js';
import {estimatePerformance} from '../dist/review-metrics.js';
const [input,limit='4',depth='10']=process.argv.slice(2);
const test=name=>createHash('sha256').update(name.toLowerCase()).digest().readUInt32BE(0)%100>=80;
const games=readFileSync(input,'utf8').trim().split(/\r?\n/).map(JSON.parse)
  .filter(([w,b])=>test(w)&&test(b)).slice(0,+limit);
const sf=spawn(process.execPath,['node_modules/stockfish/bin/stockfish-19-lite-single.js'],{stdio:['pipe','pipe','inherit']});
const output=createInterface({input:sf.stdout})[Symbol.asyncIterator]();
const send=cmd=>sf.stdin.write(cmd+'\n');
const scores=[],ids=[];
try{
  send('uci');while(!(await output.next()).value?.includes('uciok')){}
  for(const [w,b,wr,br,tc,moves,url] of games){
    const chess=new Chess(),nodes=[{}],commands=[];
    send('ucinewgame');
    for(let i=0;i<moves.length;i++){
      const m=chess.move(moves[i][0].replace(/[!?]+$/,''));
      commands.push(m.from+m.to+(m.promotion||''));
      let evaluation;
      if(chess.isCheckmate())evaluation={type:'mate',white:m.color==='w'?1:-1,value:0};
      else if(chess.isDraw())evaluation={type:'cp',white:0,value:0};
      else{
        send('position startpos moves '+commands.join(' '));send('go depth '+depth);
        for(;;){
          const next=await output.next();if(next.done)throw Error('Stockfish exited');const line=next.value;
          if(line.startsWith('bestmove'))break;
          const score=/\bscore (cp|mate) (-?\d+)/.exec(line);if(!score)continue;
          const v=Number(score[2]);evaluation={type:score[1],value:v,white:(score[1]==='cp'?v:Math.sign(v))*(chess.turn()==='w'?1:-1)};
        }
      }
      if(!evaluation)throw Error('No evaluation');
      nodes.push({move:m,evaluation,coach:{before:nodes.at(-1).evaluation,after:evaluation}});
    }
    ids.push(url);
    for(const side of ['w','b']){
      const p=estimatePerformance(nodes,side,{Site:'lichess.org',TimeControl:tc});
      if(p.available)scores.push(p.rating-(side==='w'?wr:br));
    }
  }
}finally{send('quit');sf.stdin.end();sf.kill()}
const avg=xs=>xs.reduce((s,v)=>s+v,0)/xs.length;
console.log(JSON.stringify({ids,sides:scores.length,mae:avg(scores.map(Math.abs)),rmse:Math.sqrt(avg(scores.map(e=>e*e))),bias:avg(scores)}));
