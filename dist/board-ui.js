const NS = 'http://www.w3.org/2000/svg';

const paths = {
  workspace: 'M3 4h18v16H3zM14 4v16m3-11h1m-1 4h1M6 15l2.5-4 2 1.5',
  inbox: 'M12 3v10m-4-4 4 4 4-4M4 12v7h16v-7',
  upload: 'M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5',
  chart: 'M3.5 4v16h17M7 15l4-5 3 2 6-7',
  branch: 'M7 4v13m0-4c0-4 10-1 10-7m-2-1 2-2 2 2M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  board: 'M3 3h18v18H3zM9 3v18m6-18v18M3 9h18M3 15h18',
  puzzle: 'M4 5h6c0-4 5-4 5 0h4v5c4 0 4 5 0 5v4h-6c1-4-5-4-4 0H4v-5c4 0 4-5 0-5z',
  archive: 'M3 4h18v5H3zm2 5v11h14V9m-10 4h6',
  list: 'M8 6h12M8 12h12M8 18h12M3.5 6h.2m-.2 6h.2m-.2 6h.2',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0M12 11v5m0-9v.2',
  forward: 'M4 12h15m-6-6 6 6-6 6',
  close: 'm6 6 12 12m0-12L6 18',
  heart: 'M12 20 4 12c-5-6 3-12 8-6 5-6 13 0 8 6z',
  player: 'M7.5 8a4.5 4.5 0 1 0 9 0 4.5 4.5 0 1 0-9 0M4 21a8 8 0 0 1 16 0z',
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
  brilliant: 'm3 9 4-5h10l4 5-9 11zM3 9h18m-12-5-2 5 5 11 5-11-2-5',
  critical: 'm13 2-8 12h6l-1 8 9-12h-6z',
  best: 'm12 2.5 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.1l6.2-.9z',
  excellent: 'm3 13 3.5 3.5L15 7m-4 8 2 2 8-10',
  good: 'm5 12 4 4 10-9',
  inaccuracy: 'M4 15 9 9l5 6 6-7',
  mistake: 'M7.5 8a4.5 4.5 0 0 1 9 0c0 3.5-4.5 3.5-4.5 7m0 4v.25',
  blunder: 'm6.5 6.5 11 11m0-11-11 11',
  theory: 'M12 6c-3-2-6-2-9-1v13c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zm0 0v13',
  mate: 'm3 7 5 4 4-6 4 6 5-4-2 10H5zm3 13h12',
};

export function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', ['good','excellent','inaccuracy','mistake','blunder'].includes(name) ? '2.8' : '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ui-icon');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', paths[name]);
  if (['play','best','critical','player'].includes(name)) path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

const SOUND_FILES = {
  select: ['select.mp3'],
  move: ['move-self.mp3', 'move-self-1.mp3', 'move-self-2.mp3', 'move-self-3.mp3', 'move-self-4.mp3'],
  check: ['move-self.mp3', 'move-self-1.mp3', 'move-self-2.mp3', 'move-self-3.mp3', 'move-self-4.mp3'],
  capture: ['capture.mp3', 'capture-1.mp3', 'capture-2.mp3', 'capture-3.mp3', 'capture-4.mp3', 'capture-5.mp3', 'capture-6.mp3', 'capture-7.mp3', 'capture-8.mp3'],
  castle: ['castle.mp3'],
  promotion: ['promote.mp3'],
  mate: ['game-win.mp3'],
  end: ['game-draw.mp3'],
  start: ['game-start.mp3'],
  win: ['game-win.mp3'],
  lose: ['game-lose.mp3'],
  illegal: ['illegal.mp3'],
  notify: ['notify.mp3'],
};

const soundPlayers = new Map();
const soundPositions = new Map();
let outputVolume = .65;
let soundEnabled = true;

function prepareSoundPlayers() {
  for (const file of new Set(Object.values(SOUND_FILES).flat())) {
    if (soundPlayers.has(file)) continue;
    const player = new Audio('/sounds/' + file);
    player.preload = 'auto';
    player.volume = outputVolume;
    player.setAttribute('playsinline', '');
    soundPlayers.set(file, player);
    player.load();
  }
}

export function setBoardVolume(volume) {
  outputVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  for (const player of soundPlayers.values()) player.volume = outputVolume;
}

export function unlockSound(enabled) {
  soundEnabled = Boolean(enabled);
  if (!soundEnabled) {
    for (const player of soundPlayers.values()) player.pause();
    return;
  }
  try { prepareSoundPlayers(); } catch { /* Audio is optional and must never interrupt a move. */ }
}

export function boardSound(name, enabled, volume = 65) {
  if (!enabled || !soundEnabled) return;
  const files = SOUND_FILES[name];
  if (!files?.length) return;

  const next = soundPositions.get(name) || 0;
  soundPositions.set(name, (next + 1) % files.length);
  const file = files[next % files.length];
  if (!soundPlayers.has(file)) {
    try { prepareSoundPlayers(); } catch { return; }
  }
  const player = soundPlayers.get(file);
  if (!player) return;
  const amount = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
  if (!amount) return;
  player.volume = amount;
  try { player.currentTime = 0; } catch { /* Metadata may still be loading. */ }
  const playback = player.play();
  if (playback?.catch) playback.catch(() => {});
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
