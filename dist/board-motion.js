// A piece keeps the same physical identity along every variation, including
// promotion. CSS retargets from the currently painted position on rapid input.
let layouts=new WeakMap(),sprites=new Map(),previousOrientation;
let liftedSprite=null,liftedAnimation=null;
export function resetSprites(){
  layouts=new WeakMap();sprites.clear();previousOrientation=undefined;liftedSprite=null;
  document.getElementById('piece-layer')?.replaceChildren();
}
function layout(node,board){
  if(layouts.has(node))return layouts.get(node);
  const chain=[];let ancestor=node;
  while(ancestor.parent && !layouts.has(ancestor)){chain.push(ancestor);ancestor=ancestor.parent;}
  let pieces=layouts.get(ancestor);
  if(!pieces){
    pieces=new Map();
    const ranks=ancestor.fen.split(' ')[0].split('/');
    ranks.forEach((row,r)=>{let f=0;for(const c of row){
      if(/[1-8]/.test(c)){f+=Number(c);continue}
      const sq='abcdefgh'[f++]+(8-r);
      pieces.set(sq,{id:sq,code:(c===c.toUpperCase()?'w':'b')+c.toUpperCase()});
    }});
    layouts.set(ancestor,pieces);
  }
  for(const child of chain.reverse()){
    pieces=new Map(pieces);const move=child.move,unit=pieces.get(move.from);
    pieces.delete(move.from);
    if(move.flags.includes('e'))pieces.delete(move.to[0]+move.from[1]);
    if(move.flags.includes('k')||move.flags.includes('q')){
      const short=move.to[0]==='g',rank=move.from[1],from=(short?'h':'a')+rank;
      pieces.set((short?'f':'d')+rank,pieces.get(from));pieces.delete(from);
    }
    pieces.set(move.to,move.promotion?{...unit,code:move.color+move.promotion.toUpperCase()}:unit);
    layouts.set(child,pieces);
  }
  return pieces;
}
export function syncSprites(position,board,flipped,set,duration,speed){
  const layer=document.getElementById('piece-layer'),seen=new Set();
  const instant=previousOrientation===undefined||previousOrientation!==flipped||matchMedia('(prefers-reduced-motion: reduce)').matches;
  layer.style.setProperty('--travel',(instant?0:duration)+'ms');
  layer.style.setProperty('--ease',speed==='natural'?'cubic-bezier(.25,.75,.25,1)':'ease-out');
  for(const [square,piece] of layout(position,board)){
    const {id,code}=piece;
    seen.add(id);
    let sprite=sprites.get(id);
    const fresh=!sprite;
    if(fresh){
      sprite=document.createElement('div');sprite.className='sprite';
      sprites.set(id,sprite);
    }
    clearTimeout(sprite.removeTimer);
    const url='/pieces/'+(set==='chessnut'?'':set+'/')+code+'.svg';
    if(sprite.dataset.src!==url){
      const previous=sprite.lastElementChild;
      const image=document.createElement('img');image.src=url;image.alt='';
      // In case an asset fails the interactive board still has its glyph.
      image.onerror=()=>{sprite.hidden=true;document.querySelector('[data-square="'+sprite.dataset.square+'"]')?.classList.add('use-fallback')};
      sprite.hidden=false;sprite.append(image);sprite.dataset.src=url;
      if(previous){
        previous.style.zIndex='1';
        const fade=previous.animate([{opacity:1,offset:0},{opacity:1,offset:.55},{opacity:0}],{duration:instant?0:duration,fill:'both'});
        fade.finished.then(()=>previous.remove(),()=>previous.remove());
      }
    }
    const x=square.charCodeAt(0)-97,y=8-Number(square[1]);
    sprite.dataset.baseX=String(100*(flipped?7-x:x));sprite.dataset.baseY=String(100*(flipped?7-y:y));
    if(liftedSprite!==sprite)sprite.style.transform='translate('+sprite.dataset.baseX+'%,'+sprite.dataset.baseY+'%)';
    sprite.style.zIndex=sprite.dataset.square && sprite.dataset.square!==square?'2':'1';
    sprite.dataset.square=square;
    if(fresh){layer.append(sprite);if(!instant)sprite.animate([{opacity:0},{opacity:1}],{duration});}
    sprite.style.opacity='1';
  }
  for(const [id,sprite] of sprites){
    if(seen.has(id)||sprite.style.opacity==='0')continue;
    sprite.style.zIndex='0';sprite.style.opacity='0';
    sprite.removeTimer=setTimeout(()=>{if(sprite.style.opacity==='0'){sprite.remove();sprites.delete(id)}},duration+25);
  }
  previousOrientation=flipped;
}

export function liftSprite(square){
  const sprite=[...sprites.values()].find(item=>item.dataset.square===square);
  if(!sprite)return null;
  liftedAnimation?.cancel();liftedAnimation=null;
  liftedSprite=sprite;
  const image=sprite.querySelector('img');
  if(image){
    image.style.transition='transform 110ms cubic-bezier(.16,1,.3,1)';
    image.style.transform='perspective(220px) translateZ(12px) scale(1.15)';
    image.style.transformOrigin='50% 56%';
  }
  sprite.dataset.tilt='0';
  sprite.classList.add('drag-lifted');
  sprite.style.zIndex='20';
  sprite.dataset.lastX='';sprite.dataset.lastY='';sprite.dataset.lastTime='';
  sprite.dataset.vx='0';sprite.dataset.vy='0';sprite.dataset.pitch='0';sprite.dataset.yaw='0';
  sprite.style.transition='transform 110ms cubic-bezier(.16,1,.3,1), filter 110ms ease';
  sprite.style.transform='translate('+sprite.dataset.baseX+'%,'+sprite.dataset.baseY+'%) scale(1.15)';
  return sprite;
}
export function moveLiftedSprite(square,clientX,clientY,grabX=0,grabY=0){
  if(!liftedSprite||liftedSprite.dataset.square!==square)return;
  const frame=document.querySelector('.board-frame');
  const rect=frame?.getBoundingClientRect();
  if(!rect)return;
  const size=rect.width/8;
  const x=square.charCodeAt(0)-97,y=8-Number(square[1]);
  const centerX=(x+.5)*size,centerY=(y+.5)*size;
  const dx=clientX-rect.left-centerX-grabX,dy=clientY-rect.top-centerY-grabY;
  liftedSprite.style.transform='translate(calc('+liftedSprite.dataset.baseX+'% + '+dx+'px),calc('+liftedSprite.dataset.baseY+'% + '+dy+'px)) scale(1.09)';
  const image=liftedSprite.querySelector('img');
  if(image){
    const now=performance.now(),last=Number(liftedSprite.dataset.lastTime||now-16);
    const elapsed=Math.max(8,Math.min(40,now-last));
    const previousX=Number(liftedSprite.dataset.lastX||clientX),previousY=Number(liftedSprite.dataset.lastY||clientY);
    const vx=(clientX-previousX)/elapsed,vy=(clientY-previousY)/elapsed;
    const oldVx=Number(liftedSprite.dataset.vx||0),oldVy=Number(liftedSprite.dataset.vy||0);
    const smoothX=oldVx*.38+vx*.62,smoothY=oldVy*.38+vy*.62;
    const roll=Math.max(-42,Math.min(42,smoothX*25));
    const pitch=Math.max(-32,Math.min(32,-smoothY*19));
    const yaw=Math.max(-25,Math.min(25,-smoothX*14));
    liftedSprite.dataset.lastX=String(clientX);liftedSprite.dataset.lastY=String(clientY);
    liftedSprite.dataset.lastTime=String(now);liftedSprite.dataset.vx=String(smoothX);liftedSprite.dataset.vy=String(smoothY);
    liftedSprite.dataset.tilt=String(roll);liftedSprite.dataset.pitch=String(pitch);liftedSprite.dataset.yaw=String(yaw);
    image.style.transition='transform 48ms cubic-bezier(.2,.75,.25,1)';
    image.style.transform='perspective(220px) translateZ(13px) rotateX('+pitch+'deg) rotateY('+yaw+'deg) rotateZ('+roll+'deg) scale(1.15)';
  }
}
export function releaseLiftedSprite(square){
  if(!liftedSprite||liftedSprite.dataset.square!==square)return;
  const sprite=liftedSprite;liftedSprite=null;
  const image=sprite.querySelector('img');
  if(image){
    const roll=Number(sprite.dataset.tilt||0),pitch=Number(sprite.dataset.pitch||0),yaw=Number(sprite.dataset.yaw||0);
    image.style.transition='none';
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      liftedAnimation=image.animate([
        {transform:'perspective(220px) translateZ(13px) rotateX('+pitch+'deg) rotateY('+yaw+'deg) rotateZ('+roll+'deg) scale(1.15)',offset:0},
        {transform:'perspective(220px) rotateX('+(-pitch*.48)+'deg) rotateY('+(-yaw*.45)+'deg) rotateZ('+(-roll*.5)+'deg) scale(1.08)',offset:.28},
        {transform:'perspective(220px) rotateX('+(pitch*.2)+'deg) rotateY('+(yaw*.18)+'deg) rotateZ('+(roll*.2)+'deg) scale(1.025)',offset:.58},
        {transform:'rotate(0deg) scale(1)',offset:1}
      ],{duration:520,easing:'cubic-bezier(.18,.78,.22,1)',fill:'both'});
      liftedAnimation.onfinish=()=>{image.style.transform='';image.style.transition='';liftedAnimation=null;};
    }else{image.style.transform='';image.style.transition='';}
  }
  sprite.style.transition='transform 320ms cubic-bezier(.18,.82,.25,1.16), filter 220ms ease';
  sprite.style.transform='translate('+sprite.dataset.baseX+'%,'+sprite.dataset.baseY+'%) scale(1)';
  sprite.classList.remove('drag-lifted');
  sprite.style.zIndex='1';
  setTimeout(()=>{if(!sprite.classList.contains('drag-lifted'))sprite.style.transition='';},340);
}
