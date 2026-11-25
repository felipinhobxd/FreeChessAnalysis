const NS = 'http://www.w3.org/2000/svg';

const paths = {
  first: 'M6 4v16m12-15-8 7 8 7z',
  prev: 'm15 5-7 7 7 7',
  play: 'm9 5 11 7-11 7z',
  pause: 'M8 5v14m8-14v14',
  next: 'm9 5 7 7-7 7',
  last: 'M18 4v16M6 5l8 7-8 7z',
  flip: 'M8 20V5m-4 4 4-4 4 4m4-5v15m-4-4 4 4 4-4',
  expand: 'M9 4H4v5m11-5h5v5m0 6v5h-5m-6 0H4v-5',
  contract: 'M4 9h5V4m11 5h-5V4m0 16v-5h5M9 20v-5H4',
  sound: 'M3 9v6h4l5 4V5L7 9zm13-1a6 6 0 0 1 0 8m2.5-11a10 10 0 0 1 0 14',
  mute: 'M3 9v6h4l5 4V5L7 9zm13 1 5 5m0-5-5 5',
  settings: 'M4 7h16M4 17h16M9 4v6m6 4v6',
  share: 'M13 5h6v6m0-6-9 9m6-1v6H5V8h6',
  layers: 'm12 3 9 5-9 5-9-5zm-8 9 8 4 8-4m-16 4 8 4 8-4',
  brilliant: 'M12 2.5 14.5 9l6.5 3-6.5 2.5-2.5 7-3-7L3 12l6-3zM20 3v4m-2-2h4',
  critical: 'm13 2-8 12h6l-1 8 9-12h-6z',
  best: 'm12 2.5 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.1l6.2-.9z',
  excellent: 'M3.5 12.5 7 16l7-8m-3.5 6.5 2 2 8-9',
  good: 'm5 12 4 4 10-9',
  inaccuracy: 'M12 4 3.5 19h17zM12 10v3m0 3v.1',
  mistake: 'm4 17 6-6 4 3 6-8m-5 0h5v5',
  blunder: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zm1 6 6 6m0-6-6 6',
  theory: 'M12 6c-3-2-6-2-9-1v13c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v13',
  mate: 'm3 7 5 4 4-6 4 6 5-4-2 10H5zm3 13h12',
};

export function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.85');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ui-icon');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', paths[name]);
  if (name === 'play') path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

const effects = {
  select: [[560, 290, .044, .045, 0]],
  move: [[280, 132, .082, .17, 0], [790, 450, .032, .045, 0]],
  capture: [[425, 145, .105, .18, 0], [182, 85, .105, .105, .026]],
  mate: [[392, 387, .23, .11, .04], [494, 490, .26, .085, .11], [587, 584, .32, .08, .18]],
};

let audio;
export function unlockSound(enabled) {
  if (!enabled || !window.AudioContext) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch { /* Audio is optional. */ }
}

export function boardSound(name, enabled) {
  if (!enabled || !audio) return;
  const now = audio.currentTime;
  for (const [start, end, duration, volume, delay] of effects[name]) {
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    const time = now + delay;
    tone.type = name === 'mate' ? 'sine' : 'triangle';
    tone.frequency.setValueAtTime(start, time);
    tone.frequency.exponentialRampToValueAtTime(end, time + duration);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    tone.connect(gain).connect(audio.destination);
    tone.start(time);
    tone.stop(time + duration + .005);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  }
}

export function mateCelebration(layer) {
  const colors = ['#b7ed80', '#f7cb76', '#f0f5cb', '#72d7c2'];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  layer.hidden = false;
  if (reduced) return setTimeout(() => { layer.hidden = true; }, 1550);
  const pieces = [];
  for (let index = 0; index < 24; index += 1) {
    const particle = document.createElement('i');
    const angle = index * Math.PI * 2 / 24;
    const reach = 12 + (index % 5) * 6;
    particle.className = 'mate-particle';
    particle.style.setProperty('--dx', Math.cos(angle) * reach + 'cqw');
    particle.style.setProperty('--dy', Math.sin(angle) * reach + 'cqw');
    particle.style.setProperty('--spin', (index % 2 ? -1 : 1) * (130 + index * 17) + 'deg');
    particle.style.background = colors[index % colors.length];
    layer.append(particle);
    pieces.push(particle);
  }
  return setTimeout(() => {
    layer.hidden = true;
    for (const particle of pieces) particle.remove();
  }, 2400);
}
