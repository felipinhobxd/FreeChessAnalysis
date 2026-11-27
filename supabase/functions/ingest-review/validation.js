import { Chess, validateFen } from 'chess.js';

const HASH=/^[a-f0-9]{64}$/;
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const START_FEN=/^[prnbqkPRNBQK1-8/]+ [wb] (?:-|[KQkq]{1,4}) (?:-|[a-h][36]) [0-9]+ [0-9]+$/;
const MAX_PLIES=500;
const MOVE_BYTES=10;
const CLASSIFICATION={
 0:null,
 1:null,
 2:null,
 3:null,
 4:null,
 5:null,
 6:null,
 7:'inaccuracies',
 8:'mistakes',
 9:'chances_lost',
 10:'blunders'
};
const PROMOTIONS=['','q','r','b','n'];
const NULLABLE_FIELDS=[
 ['white_rating',100,4000],
 ['black_rating',100,4000],
 ['white_estimate',100,4000],
 ['black_estimate',100,4000],
 ['white_accuracy_tenths',0,1000],
 ['black_accuracy_tenths',0,1000]
];
const REQUIRED_FIELDS=[
 'white_moves','black_moves',
 'white_blunders','black_blunders',
 'white_mistakes','black_mistakes',
 'white_inaccuracies','black_inaccuracies',
 'white_chances_lost','black_chances_lost'
];
const ALLOWED_KEYS=new Set([
 'game_hash','opening_uci','moves_uci','ply_count','start_fen','move_data_base64',
 'result','time_class','source_pool','rating_source',
 'engine_version','engine_mode','analysis_depth',
 ...NULLABLE_FIELDS.map(([key])=>key),...REQUIRED_FIELDS
]);

function isIntegerInRange(value,min,max){
 return Number.isInteger(value)&&value>=min&&value<=max;
}

function hex(bytes){
 return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function squareFromIndex(index){
 return String.fromCharCode(97+(index%8))+String(Math.floor(index/8)+1);
}

function decodePackedMove(code){
 if(code===0xffff)return null;
 const from=(code>>10)&63;
 const to=(code>>4)&63;
 const promotion=code&15;
 if(from===to||promotion>4)return undefined;
 return {from:squareFromIndex(from),to:squareFromIndex(to),promotion:PROMOTIONS[promotion]};
}

function sameMove(candidate,move){
 return candidate.from===move.from&&candidate.to===move.to&&
  (candidate.promotion||'')===(move.promotion||'');
}

function decodeMoveBytes(encoded,plies){
 if(typeof encoded!=='string'||encoded.length>7000||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))return null;
 let binary;
 try{binary=atob(encoded);}catch{return null;}
 if(binary.length!==plies*MOVE_BYTES)return null;
 const bytes=new Uint8Array(binary.length);
 for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
 return bytes;
}

function nullableInteger(value,min,max){
 if(value===null)return null;
 return isIntegerInRange(value,min,max)?value:undefined;
}

/**
 * Validate a community sample before it reaches the private database.
 * This verifies the complete legal move sequence and internal metric consistency.
 * It cannot prove that the client actually ran Stockfish or that its evaluations
 * are authentic; those values remain explicitly unverified client submissions.
 */
export async function cleanCommunitySample(value){
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  if(Object.keys(value).some(key=>!ALLOWED_KEYS.has(key)))return null;
  for(const key of ALLOWED_KEYS)if(!Object.hasOwn(value,key))return null;

  if(typeof value.game_hash!=='string'||!HASH.test(value.game_hash))return null;
  if(!['w','d','b'].includes(value.result)||
     !['bullet','blitz','rapid','classical','unknown'].includes(value.time_class)||
     !['chesscom','lichess','unknown'].includes(value.source_pool)||
     !['none','pgn_unverified'].includes(value.rating_source)||
     !/^19\\.[0-9]+\\.[0-9]+$/.test(value.engine_version||'')||
     !['full','lite','economy'].includes(value.engine_mode))return null;

  const depth=value.analysis_depth;
  const plies=value.ply_count;
  if(!isIntegerInRange(depth,1,30)||!isIntegerInRange(plies,8,MAX_PLIES))return null;
  if(typeof value.moves_uci!=='string'||value.moves_uci.length>3000)return null;
  const moves=value.moves_uci.split('.');
  if(moves.length!==plies||moves.some(move=>!UCI.test(move)))return null;

  const opening=moves.slice(0,24).join('');
  if(value.opening_uci!==opening||
     !/^(?:[a-h][1-8][a-h][1-8][qrbn]?){1,24}$/.test(value.opening_uci))return null;

  let initialFen=null;
  if(value.start_fen!==null){
   if(typeof value.start_fen!=='string'||value.start_fen.length>100||
      !START_FEN.test(value.start_fen))return null;
   if(!validateFen(value.start_fen).ok)return null;
   initialFen=value.start_fen;
  }

  const output={
   game_hash:value.game_hash,opening_uci:value.opening_uci,moves_uci:value.moves_uci,
   ply_count:plies,start_fen:initialFen,
   move_data_base64:value.move_data_base64,
   result:value.result,time_class:value.time_class,source_pool:value.source_pool,
   rating_source:value.rating_source,engine_version:value.engine_version,
   engine_mode:value.engine_mode,analysis_depth:depth
  };

  for(const [key,min,max] of NULLABLE_FIELDS){
   const parsed=nullableInteger(value[key],min,max);
   if(parsed===undefined)return null;
   output[key]=parsed;
  }
  for(const key of REQUIRED_FIELDS){
   if(!isIntegerInRange(value[key],0,250))return null;
   output[key]=value[key];
  }

  const hasRecordedRating=output.white_rating!==null||output.black_rating!==null;
  if((output.rating_source==='pgn_unverified')!==hasRecordedRating)return null;
  if(hasRecordedRating&&output.source_pool==='unknown')return null;
  if(output.time_class!=='blitz'&&output.time_class!=='rapid'&&
     (output.white_estimate!==null||output.black_estimate!==null))return null;
  if(output.source_pool==='unknown'&&
     (output.white_estimate!==null||output.black_estimate!==null))return null;
  if(output.source_pool==='chesscom'&&
     ((output.white_estimate!==null&&output.white_rating===null)||
      (output.black_estimate!==null&&output.black_rating===null)))return null;

  const bytes=decodeMoveBytes(value.move_data_base64,plies);
  if(!bytes)return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const sideCounts={
   w:{moves:0,blunders:0,mistakes:0,inaccuracies:0,chances_lost:0},
   b:{moves:0,blunders:0,mistakes:0,inaccuracies:0,chances_lost:0}
  };

  let chess;
  try{chess=initialFen?new Chess(initialFen):new Chess();}catch{return null;}

  let previousAfter=null;
  for(let index=0;index<plies;index++){
   const offset=index*MOVE_BYTES;
   const side=chess.turn();
   const legalMoves=chess.moves({verbose:true});
   if(!legalMoves.length)return null;

   const before=view.getInt16(offset,true);
   const after=view.getInt16(offset+2,true);
   const accuracy=view.getUint16(offset+4,true);
   const classification=view.getUint8(offset+6);
   const flags=view.getUint8(offset+7);
   const packedBest=view.getUint16(offset+8,true);

   if(before < -32000||before > 32000||after < -32000||after > 32000)return null;
   if(accuracy!==0xffff&&accuracy>1000)return null;
   if(classification>10||(flags&~31)!==0)return null;
   if(!(flags&1)&&before!==0)return null;
   if(!(flags&2)&&after!==0)return null;
   if((flags&8)&&(!(flags&1)||![-32000,0,32000].includes(before)))return null;
   if((flags&16)&&(!(flags&2)||![-32000,0,32000].includes(after)))return null;

   if(previousAfter){
    const beforeValid=Boolean(flags&1),beforeMate=Boolean(flags&8);
    if(previousAfter.valid!==beforeValid||previousAfter.mate!==beforeMate)return null;
    if(beforeValid){
     if(beforeMate){
      if(previousAfter.score!==before)return null;
     }else if(Math.abs(previousAfter.score-before)>50)return null;
    }
   }

   if(packedBest!==0xffff){
    const bestMove=decodePackedMove(packedBest);
    if(!bestMove||!legalMoves.some(candidate=>sameMove(candidate,bestMove)))return null;
   }

   const uci=moves[index];
   const actualMove={
    from:uci.slice(0,2),
    to:uci.slice(2,4),
    promotion:uci[4]||''
   };
   const legalActual=legalMoves.find(candidate=>sameMove(candidate,actualMove));
   if(!legalActual)return null;
   if((legalActual.promotion||'')!==actualMove.promotion)return null;

   sideCounts[side].moves++;
   const field=CLASSIFICATION[classification];
   if(field)sideCounts[side][field]++;
   try{chess.move({from:actualMove.from,to:actualMove.to,...(actualMove.promotion?{promotion:actualMove.promotion}:{})});}
   catch{return null;}
   previousAfter={valid:Boolean(flags&2),mate:Boolean(flags&16),score:after};
  }

  if(sideCounts.w.moves!==output.white_moves||sideCounts.b.moves!==output.black_moves||
     sideCounts.w.blunders!==output.white_blunders||sideCounts.b.blunders!==output.black_blunders||
     sideCounts.w.mistakes!==output.white_mistakes||sideCounts.b.mistakes!==output.black_mistakes||
     sideCounts.w.inaccuracies!==output.white_inaccuracies||sideCounts.b.inaccuracies!==output.black_inaccuracies||
     sideCounts.w.chances_lost!==output.white_chances_lost||sideCounts.b.chances_lost!==output.black_chances_lost)return null;

  if(chess.isCheckmate()){
   const winner=chess.turn()==='w'?'b':'w';
   if(output.result!==winner)return null;
  }else if((chess.isStalemate()||chess.isInsufficientMaterial())&&output.result!=='d'){
   return null;
  }

  const raw=[
   'fca-community-v2',output.result,initialFen||'standard-start',
   output.engine_version,output.engine_mode,String(depth),moves.join('.')
  ].join('|');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
  if(hex(digest)!==output.game_hash)return null;

  return output;
 }catch{
  return null;
 }
}
