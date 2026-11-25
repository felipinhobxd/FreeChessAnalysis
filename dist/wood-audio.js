// Original percussion: filtered impact noise excites three damped wood modes.
// Buffers are synthesized locally and cached. No third-party samples.
const events={
  move:[[0,415,1]],opponent:[[0,397,.94]],capture:[[0,710,.65],[.035,290,1]],
  enPassant:[[0,630,.55],[.048,330,.95]],castle:[[0,420,.85],[.067,350,1]],
  promotion:[[0,400,.9],[.067,740,.43]],check:[[0,475,1],[.047,1020,.35]],
  mate:[[0,350,.95],[.096,525,.50],[.18,700,.32]],end:[[0,350,.9],[.10,460,.48]]
};
let context,bus,voice;
const buffers=new Map();
export function unlockWood(enabled){
  if(!enabled){silenceWood();return}
  try{
    context??=new AudioContext({latencyHint:'interactive'});
    if(!bus){bus=context.createGain();bus.connect(context.destination)}
    if(context.state==='suspended')context.resume().catch(()=>{});
  }catch{/* Silent without Web Audio. */}
}
export function woodVolume(value){if(bus)bus.gain.setTargetAtTime(value,context.currentTime,.008)}
export function silenceWood(){if(voice){try{voice.stop()}catch{}voice=null}}
export function woodSound(name,volume){
  if(!context||context.state!=='running'||!volume)return;
  const hits=events[name];if(!hits)return;
  let buffer=buffers.get(name);
  if(!buffer){
    const rate=context.sampleRate,length=Math.ceil((hits.at(-1)[0]+.19)*rate);
    buffer=context.createBuffer(1,length,rate);
    const data=buffer.getChannelData(0);let seed=9017;
    for(const [start,hz,amount] of hits){
      let filtered=0;
      const offset=Math.round(start*rate);
      for(let i=0;i<length-offset;i++){
        const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        filtered=.58*filtered+.42*(seed/2147483648-1);
        const attack=1-Math.exp(-1450*t),phase=2*Math.PI*hz*t;
        const grain=filtered*Math.exp(-t*195);
        const wood=.46*Math.sin(phase)*Math.exp(-t*62)+.23*Math.sin(phase*1.72)*Math.exp(-t*96)+.12*Math.sin(phase*3.82)*Math.exp(-t*155);
        data[offset+i]+=amount*attack*(grain*.8+wood);
      }
    }
    buffers.set(name,buffer);
  }
  silenceWood();woodVolume(volume);voice=context.createBufferSource();
  voice.buffer=buffer;voice.connect(bus);const current=voice;
  current.onended=()=>{current.disconnect();if(voice===current)voice=null};current.start();
  return true;
}
