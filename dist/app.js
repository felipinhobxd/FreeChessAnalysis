import { parseGameLink, reviewHighlights, mergeStudies, validStudy } from './study-tools.js';
import { gameFingerprint, listStudies, getStudy, putStudy } from './study-storage.js';
import { syncArchive, newSyncCode, syncCodeKey, validCode } from './study-cloud.js';
import { missedOpportunity, shortMateAfter, aspectEvidence, aspectGrade } from './review-evidence.js';
import { syncSprites, resetSprites } from './board-motion.js';
import { Engine } from './engine.js';
import { acceptedMove, inspectMove, isTrainingMove } from './coach.js';
import { icon, unlockSound, boardSound, setBoardVolume, moveSound, mateCelebration } from './board-ui.js';
import { initLanguage, setLanguage, getLanguage, translate } from './i18n.js';
import { recordedRating } from './game-rating.js';
import { classifyReviewMove, winPercent } from './review-classification.js';
import { REVIEW_CHART_MARKERS, chartMarkerPoints, chartSelectionFor } from './review-chart.js';
import { aggregateGameAccuracy, estimatePerformance, moveAccuracyBetween, phaseForPosition } from './review-metrics.js';

const $ = id => document.getElementById(id);
const languageState = initLanguage();
const profileStorageKey = 'move-by-move/chess-profile';
function readChessProfile() {
  try {
    const value = JSON.parse(localStorage.getItem(profileStorageKey));
    return value && typeof value === 'object'
      ? { platform: value.platform || 'none', username: String(value.username || '') }
      : null;
  } catch { return null; }
}
function configureLanguageGate() {
  const languageSelect = $('language-select');
  const profilePlatform = $('profile-platform');
  const profileUsername = $('profile-username');
  const applyProfile = profile => {
    profilePlatform.value = profile?.platform || 'none';
    profileUsername.value = profile?.username || '';
  };
  const savedProfile = readChessProfile();
  languageSelect.value = getLanguage();
  applyProfile(savedProfile);
  languageSelect.addEventListener('change', () => {
    setLanguage(languageSelect.value);
  });
  $('language-enter').addEventListener('click', () => {
    setLanguage(languageSelect.value);
    const previousProfile = readChessProfile();
    const profile = {
      platform: profilePlatform.value,
      username: profileUsername.value.trim().slice(0, 40),
    };
    const profileChanged = !previousProfile ||
      previousProfile.platform !== profile.platform ||
      previousProfile.username !== profile.username;
    try { localStorage.setItem(profileStorageKey, JSON.stringify(profile)); } catch { /* Profile is optional. */ }
    $('language-gate').hidden = true;
    $('app-content').hidden = false;
    if (profileChanged && ['chesscom', 'lichess'].includes(profile.platform)) {
      setSource(profile.platform);
      $('game-input').value = profile.username;
    } else if (profileChanged && ['chesscom', 'lichess'].includes(previousProfile?.platform) &&
      source === previousProfile.platform) {
      setSource('pgn');
    }
    render();
  });
  $('language-open').addEventListener('click', () => {
    languageSelect.value = getLanguage();
    applyProfile(readChessProfile());
    $('language-gate').hidden = false;
    $('app-content').hidden = true;
  });
  const profileReady = Boolean(savedProfile);
  const showGate = !languageState.saved || !profileReady;
  $('language-gate').hidden = !showGate;
  $('app-content').hidden = showGate;
}
configureLanguageGate();
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

const EXAMPLE = `[Event "Partida de exemplo"]
[White "Brancas"]
[Black "Pretas"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;
const FIGURES = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const NAMES = { p: 'Peão', n: 'Cavalo', b: 'Bispo', r: 'Torre', q: 'Dama', k: 'Rei' };
const CLASSIFICATIONS = {
  brilliant: ['!!', 'Brilhante'],
  excellent: ['✓', 'Excelente'],
  theory: ['▤', 'Teoria'],
  best: ['★', 'Melhor'],
  great: ['!', 'Ótimo'],
  good: ['○', 'Bom'],
  inaccuracy: ['?!', 'Imprecisão'],
  mistake: ['?', 'Erro'],
  'chance-lost': ['X', 'Oportunidade perdida'],
  blunder: ['!!', 'Erro grave'],
};
const BOOK = new Set(['e2e4', 'd2d4', 'c2c4', 'g1f3']);
const BOOK_REPLY = {
  e2e4: ['e7e5', 'c7c5', 'e7e6', 'c7c6', 'd7d6', 'd7d5', 'g8f6', 'g7g6', 'b8c6'],
  d2d4: ['d7d5', 'g8f6', 'e7e6', 'f7f5', 'c7c5', 'd7d6'],
  c2c4: ['e7e5', 'g8f6', 'c7c5', 'e7e6', 'c7c6', 'g7g6'],
  g1f3: ['d7d5', 'g8f6', 'c7c5', 'g7g6', 'e7e6', 'b7b6'],
};
const PREFS = ['review-depth', 'line-depth', 'multi-pv', 'show-arrow', 'show-coordinates', 'engine-mode', 'piece-set', 'sound-enabled', 'sound-volume', 'animation-speed', 'mate-enabled'];
const TABS = ['import', 'report', 'lines', 'puzzles'];

let reviewSide = 'all';
let demo;
let studyId;
let studyAnalysis;
let studyTimer;
let archiveRun = 0;
let cloudBusy = false;
let generatedSyncCode;

let Chess;
let root;
let cursor;
let gameHeaders = {};
let originalPath, originalPgn, resumeReview = false;
let soundTimer, lastMate;
const preferred = new WeakMap();
let turnCounter = 0;
let selected;
let flipped = false;
let tab = 'import';
let reviewMode = 'summary';
let source = 'pgn';
let engineOn = true;
let live;
let review;
let analysisTimer;
let runningTimer;
let toastTimer;
let remoteRequest;
let pendingPromotion;
let sharedEngine;
let engineProfile;
let activePuzzle;
let mateTimer;
let fullscreenFallback = false;
const puzzleProgress = new Map();
const positions = new Map();
let boardMarks = [];
let activeBoardMark = null;

const setting = id => $(id).type === 'checkbox' ? $(id).checked : ['engine-mode', 'piece-set', 'animation-speed'].includes(id) ? $(id).value : Number($(id).value);
const playSound = name => {
  if (!setting('sound-enabled')) return;
  unlockSound(true);
  boardSound(name, true, setting('sound-volume'));
};
const readLocal = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const writeLocal = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const reportError = message => {
  $('import-error').textContent = message ?? '';
  $('import-error').hidden = !message;
};
const toast = message => {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
};
const uci = move => move.from + move.to + (move.promotion || '');
const moveFromUci = string => ({ from: string.slice(0, 2), to: string.slice(2, 4), promotion: string[4] });
const material = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

async function loadChess() {
  for (const endpoint of [
    'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js',
    'https://unpkg.com/chess.js@1.4.0/dist/esm/chess.js',
    'https://esm.sh/chess.js@1.4.0',
  ]) {
    try {
      const module = await import(endpoint);
      if (module.Chess) return module.Chess;
    } catch { /* Try another source. */ }
  }
  throw new Error('Não foi possível carregar as regras do xadrez. Verifique a conexão e recarregue.');
}

function createPosition(chess, parent = null, move = null) {
  const result = chess.isCheckmate()
    ? { type: 'mate', value: 0, white: chess.turn() === 'b' ? 1 : -1, depth: 0, pv: [] }
    : chess.isDraw() ? { type: 'cp', value: 0, white: 0, depth: 0, pv: [] } : null;
  return {
    id: turnCounter++, fen: chess.fen(), parent, move, terminal: result,
    children: [], lines: result ? [result] : [], evaluation: result, classification: null,
    depth: 0, best: null, accuracy: null,
  };
}

function pathTo(node) {
  const moves = [];
  for (let item = node; item?.parent; item = item.parent) moves.unshift(item);
  return moves;
}

function mainPath() {
  if (originalPath) return originalPath;
  const nodes = [root];
  while (nodes.at(-1).children[0]) nodes.push(nodes.at(-1).children[0]);
  return nodes;
}

function linePath(node) {
  const path = [root, ...pathTo(node)];
  while (path.at(-1).children.length) path.push(preferred.get(path.at(-1)) || path.at(-1).children[0]);
  return path;
}

function boardAt(node) {
  const board = new Chess(root.fen);
  for (const item of pathTo(node)) board.move(moveFromUci(uci(item.move)));
  return board;
}

function addChild(parent, board, move) {
  const exploring = Boolean(originalPath) || tab === 'report' || parent.userEdited;
  if (exploring && !originalPath) originalPath = mainPath();
  const existing = parent.children.find(child => uci(child.move) === uci(move) && (!exploring || child.userEdited));
  if (existing) return existing;
  const node = createPosition(board, parent, move);
  node.userEdited = exploring;
  parent.children.push(node);
  positions.set(node.id, node);
  return node;
}

function setGame({ pgn, fen, ply, side } = {}, shouldReview = false) {
  const loader = new Chess();
  let moves = [];
  let first;
  if (pgn !== undefined) {
    if (!pgn.trim()) throw new Error('Cole o PGN de uma partida para continuar.');
    loader.loadPgn(pgn.trim());
    moves = loader.history({ verbose: true });
    first = moves[0]?.before ?? loader.fen();
    if (!moves.length && !loader.getHeaders().FEN) throw new Error('O PGN precisa conter lances ou uma posição inicial.');
  } else {
    if (fen !== undefined && !fen.trim()) throw new Error('Cole um FEN para continuar.');
    if (fen !== undefined) loader.load(fen.trim());
    first = loader.fen();
  }
  const position = new Chess(first);
  const mover = position.turn();
  const other = mover === 'w' ? 'b' : 'w';
  const [otherKing] = position.findPiece({type:'k',color:other});
  if (position.isAttacked(otherKing,mover)) {
    throw new Error('Posição inválida. O lado que acabou de jogar está em xeque.');
  }
  let nextRoot = createPosition(position);
  const newPositions = [nextRoot];
  for (const incoming of moves) {
    const move = position.move(moveFromUci(uci(incoming)));
    const parent = newPositions.at(-1);
    const child = createPosition(position, parent, move);
    parent.children.push(child);
    newPositions.push(child);
  }
  flushStudy();
  stopDemo();
  studyId = undefined;
  studyAnalysis = undefined;
  stopReview();
  stopLive();
  stopPlayback();
  clearTimeout(soundTimer);
  hideMate();
  activePuzzle = null;
  puzzleProgress.clear();
  positions.clear();
  boardMarks = [];
  activeBoardMark = null;
  for (const child of newPositions) positions.set(child.id, child);
  root = nextRoot;
  reviewMode = "summary";
  originalPgn = pgn;
  originalPath = pgn !== undefined ? newPositions : null;
  resumeReview = false;
  resetSprites();
  lastMate = null;
  cursor = newPositions[Math.min(Math.max(Number(ply) || 0, 0), newPositions.length - 1)];
  if (shouldReview && cursor !== root) reviewMode = 'guided';
  gameHeaders = loader.getHeaders();
  const username = readChessProfile()?.username?.toLowerCase();
  reviewSide = ['w','b'].includes(side) ? side : username && gameHeaders.White?.toLowerCase() === username ? 'w'
    : username && gameHeaders.Black?.toLowerCase() === username ? 'b' : 'all';
  selected = null;
  $('panel-sub').textContent = gameHeaders.Event && gameHeaders.Event !== '?' ? gameHeaders.Event : moves.length ? displayName('w') + ' × ' + displayName('b') : fen ? 'Posição importada' : 'Posição inicial';
  $('chart-end').textContent = 'Fim';
  $('engine-status').textContent = 'Motor aguardando análise';
  $('report-status').textContent = 'Carregue ou jogue uma partida.';
  $('review-btn').textContent = 'Revisar';
  render();
  if (!shouldReview || !moves.length) announceMate();
  if (shouldReview && moves.length) {
    setTab('report');
    openSavedReview(Number.isFinite(Number(ply)) && ply !== undefined);
  } else if (shouldReview) {
    setTab('lines');
  }
}

function activeChallenge() {
  return tab === 'puzzles' ? activePuzzle : null;
}

function shownPosition() {
  const puzzle = activeChallenge();
  if (!puzzle) return demo?.frames[demo.index] ?? cursor;
  return puzzle.reviewPath?.[puzzle.reviewIndex] ?? puzzle.result ?? puzzle.node.parent;
}

function pieceGraphic(piece, square, playable) {
  const file = piece.color + piece.type.toUpperCase() + '.svg';
  const image = element('img', undefined, 'piece piece-art ' + (piece.color === 'b' ? 'black' : 'white'));
  const fallback = element('span', FIGURES[piece.type], 'piece fallback ' + piece.color);
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  fallback.setAttribute('aria-hidden', 'true');
  fallback.hidden = true;
  image.onerror = () => {
    image.hidden = true;
    fallback.hidden = false;
  };
  const set = setting('piece-set');
  const directory = set === 'chessnut' ? 'pieces/' : 'pieces/' + set + '/';
  image.src = '/' + directory + file;
  for (const view of [image, fallback]) {
    view.draggable = playable;
    if (playable) view.addEventListener('dragstart', event => {
      selected = square;
      showLegalTargets(square);
      renderScore();
      event.dataTransfer.setData('text/plain', square);
      event.dataTransfer.effectAllowed = 'move';
    });
  }
  return [image, fallback];
}

function showLegalTargets(square) {
  const board = new Chess(shownPosition().fen);
  const legal = new Set(board.moves({ square, verbose: true }).map(move => move.to));
  for (const cell of $('board').querySelectorAll('[data-square]')) {
    const name = cell.dataset.square;
    cell.classList.toggle('selected', name === square);
    cell.classList.toggle('legal', legal.has(name));
    cell.classList.toggle('occupied', Boolean(board.get(name)));
  }
}

function renderPieces() {
  const puzzle = activeChallenge();
  const position = shownPosition();
  const board = new Chess(position.fen);
  const legal = new Set(selected ? board.moves({ square: selected, verbose: true }).map(move => move.to) : []);
  const orientBlack = puzzle ? puzzle.node.move.color === 'b' : flipped;
  const files = orientBlack ? 'hgfedcba' : 'abcdefgh';
  const ranks = orientBlack ? '12345678' : '87654321';
  const focused = document.activeElement?.dataset.square;
  const fragment = document.createDocumentFragment();
  for (const [row, rank] of [...ranks].entries()) {
    for (const [column, file] of [...files].entries()) {
      const square = file + rank;
      const piece = board.get(square);
      const button = element('button', undefined, 'square');
      button.dataset.square = square;
      button.type = 'button';
      button.classList.toggle('dark', (row + column) % 2 === 1);
      button.classList.toggle('occupied', Boolean(piece));
      button.classList.toggle('last', position.move?.from === square || position.move?.to === square);
      button.classList.toggle('selected', square === selected);
      button.classList.toggle('legal', legal.has(square));
      button.classList.toggle('check', piece?.type === 'k' && piece.color === board.turn() && board.isCheck());
      button.classList.toggle('puzzle-wrong', puzzle?.wrongSquare === square && puzzle.status === 'active');
      button.classList.toggle('puzzle-right', puzzle?.result?.move.to === square);
      const rating = !puzzle && piece && position.move?.to === square && CLASSIFICATIONS[position.classification] ? CLASSIFICATIONS[position.classification][1] : null;
      const ariaName = piece ? square + ', ' + NAMES[piece.type] + (piece.color === 'w' ? ' das brancas' : ' das pretas') : square;
      button.setAttribute('aria-label', ariaName + (rating ? ' · ' + rating : ''));
      if (rating) button.title = rating;
      button.tabIndex = square === (focused || selected || files[0] + ranks[0]) ? 0 : -1;
      if (piece) {
        button.append(...pieceGraphic(piece, square, piece.color === board.turn() && !position.terminal && !demo && (!puzzle || puzzle.status === 'active')));
        if (rating) {
          const mark = badge(position.classification);
          mark.classList.add('board-badge');
          mark.setAttribute('aria-hidden', 'true');
          button.append(mark);
        }
      }
      if (setting('show-coordinates')) {
        if (column === 0) button.append(element('span', rank, 'coord rank'));
        if (row === 7) button.append(element('span', file, 'coord file'));
      }
      fragment.append(button);
    }
  }
  $('board').replaceChildren(fragment);
  syncSprites(position, board, orientBlack, setting('piece-set'), moveAnimationDuration(), setting('animation-speed'));
  if (focused) $('board').querySelector('[data-square="' + focused + '"]')?.focus({ preventScroll: true });
}

function displayName(color) {
  const name = gameHeaders[color === 'w' ? 'White' : 'Black'];
  return name && name !== '?' ? name : color === 'w' ? 'Brancas' : 'Pretas';
}

function renderPlayers() {
  const puzzle = activeChallenge();
  const position = shownPosition();
  const orientBlack = puzzle ? puzzle.node.move.color === 'b' : flipped;
  for (const [id, color] of [['top-player', orientBlack ? 'w' : 'b'], ['bottom-player', orientBlack ? 'b' : 'w']]) {
    const score = gameHeaders[color === 'w' ? 'WhiteElo' : 'BlackElo'];
    const pieces = new Chess(position.fen);
    const avatar = element('span', undefined, 'player-icon ' + (color === 'w' ? 'white' : 'black'));
    avatar.append(icon('player'));
    $(id).replaceChildren(
      avatar,
      element('span', displayName(color), 'player-name'),
    );
    if (score && score !== '?') $(id).append(element('span', score, 'player-elo'));
    if (pieces.turn() === color) {
      const text = pieces.isCheckmate() ? 'Xeque-mate' : position.terminal ? 'Empate' : pieces.isCheck() ? 'Em xeque' : 'Vez de jogar';
      $(id).append(element('span', text, 'side-turn'));
    }
  }
}

function evaluationLabel(evaluation) {
  if (!evaluation) return '—';
  if (evaluation.type === 'mate') return (evaluation.white < 0 ? '−' : '+') + 'M' + Math.abs(evaluation.value);
  const value = evaluation.white / 100;
  return (value > 0 ? '+' : '') + value.toFixed(2).replace('.', ',').replace('-', '−');
}


function canvasContext(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  if (!width || !height) return null;
  const scale = window.devicePixelRatio || 1;
  const dimensions = [Math.round(width * scale), Math.round(height * scale)];
  if (canvas.width !== dimensions[0]) canvas.width = dimensions[0];
  if (canvas.height !== dimensions[1]) canvas.height = dimensions[1];
  const context = canvas.getContext('2d');
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function boardPoint(square, width, height) {
  const blackAtBottom = activeChallenge() ? activeChallenge().node.move.color === 'b' : flipped;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const column = blackAtBottom ? 7 - file : file;
  const row = blackAtBottom ? rank : 7 - rank;
  return [(column + .5) * width / 8, (row + .5) * height / 8];
}

function drawBoardArrow(context, from, to, color, width, height, preview = false) {
  if (!from || !to || from === to) return;
  const cell = Math.min(width, height) / 8;
  const [x1, y1] = boardPoint(from, width, height);
  const [x2, y2] = boardPoint(to, width, height);
  const fileDelta = to.charCodeAt(0) - from.charCodeAt(0);
  const rankDelta = Number(to[1]) - Number(from[1]);
  const knightMove = (Math.abs(fileDelta) === 1 && Math.abs(rankDelta) === 2) ||
    (Math.abs(fileDelta) === 2 && Math.abs(rankDelta) === 1);
  const elbow = knightMove ? (Math.abs(fileDelta) === 1 ? [x1, y2] : [x2, y1]) : null;
  const finalDx = elbow ? x2 - elbow[0] : x2 - x1;
  const finalDy = elbow ? y2 - elbow[1] : y2 - y1;
  const length = Math.hypot(finalDx, finalDy) || 1;
  const dirX = finalDx / length, dirY = finalDy / length;
  const head = cell * .34, half = cell * .19;
  const tipX = x2 - dirX * cell * .1, tipY = y2 - dirY * cell * .1;
  const baseX = tipX - dirX * head, baseY = tipY - dirY * head;
  context.save();
  context.globalAlpha = preview ? .7 : .86;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = cell * .13;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(x1, y1);
  if (elbow) context.lineTo(elbow[0], elbow[1]);
  context.lineTo(baseX, baseY);
  context.stroke();
  context.beginPath();
  context.moveTo(tipX, tipY);
  context.lineTo(baseX - dirY * half, baseY + dirX * half);
  context.lineTo(baseX + dirY * half, baseY - dirX * half);
  context.closePath();
  context.fill();
  context.restore();
}
function drawBoardCircle(context, square, color, width, height, preview = false) {
  if (!square) return;
  const cell = Math.min(width, height) / 8;
  const [x, y] = boardPoint(square, width, height);
  context.save();
  context.globalAlpha = preview ? .22 : .27;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, cell * .34, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = preview ? .72 : .92;
  context.strokeStyle = color;
  context.lineWidth = Math.max(3, cell * .075);
  context.beginPath();
  context.arc(x, y, cell * .34, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function renderBoardMarks(context, width, height) {
  for (const mark of boardMarks) {
    if (mark.type === 'circle') drawBoardCircle(context, mark.from, mark.color, width, height);
    else drawBoardArrow(context, mark.from, mark.to, mark.color, width, height);
  }
  if (activeBoardMark) {
    if (activeBoardMark.to && activeBoardMark.to !== activeBoardMark.from) {
      drawBoardArrow(context, activeBoardMark.from, activeBoardMark.to, activeBoardMark.color, width, height, true);
    } else {
      drawBoardCircle(context, activeBoardMark.from, activeBoardMark.color, width, height, true);
    }
  }
}

function renderBestArrow(context, best, width, height) {
  if (!best || !setting('show-arrow') || selected || activeChallenge()) return;
  const [x1, y1] = boardPoint(best.slice(0, 2), width, height);
  const [x2, y2] = boardPoint(best.slice(2, 4), width, height);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const size = width / 8;
  context.save();
  context.translate(x1, y1);
  context.rotate(angle);
  context.fillStyle = '#e8a647db';
  context.strokeStyle = '#57471c99';
  context.lineWidth = Math.max(1, size * .018);
  context.lineJoin = 'round';
  const neck = distance - size * .35;
  context.beginPath();
  context.moveTo(size * .18, -size * .077);
  context.lineTo(neck, -size * .077);
  context.lineTo(neck, -size * .205);
  context.lineTo(distance - size * .025, 0);
  context.lineTo(neck, size * .205);
  context.lineTo(neck, size * .077);
  context.lineTo(size * .18, size * .077);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function renderScore() {
  $('evalbar').classList.toggle('puzzle-hidden', Boolean(activeChallenge()));
  if (!activeChallenge()) {
    const evaluation = shownPosition().evaluation;
    const percent = winPercent(evaluation);
    $('eval-value').textContent = evaluationLabel(evaluation);
    $('eval-value').title = evaluationLabel(evaluation);
    $('eval-white').style.height = Math.max(3, Math.min(97, percent)) + '%';
    $('evalbar').classList.toggle('low-white', percent < 12);
    $('evalbar').classList.toggle('flipped', flipped);
    $('evalbar').setAttribute('aria-valuenow', percent.toFixed(0));
    $('evalbar').setAttribute('aria-valuetext', evaluation ? evaluationLabel(evaluation) : 'Sem avaliação');
    $('chart-value').textContent = evaluationLabel(evaluation);
  }
  const surface = canvasContext($('arrows'));
  if (!surface) return;
  const { context, width, height } = surface;
  if (!demo) renderBestArrow(context, cursor.lines[0]?.pv[0], width, height);
  renderBoardMarks(context, width, height);
}
function selectSquare(square) {
  if (demo) { stopDemo(); render(); return; }
  const puzzle = activeChallenge();
  const position = shownPosition();
  if (position.terminal || (tab === 'puzzles' && (puzzle?.status !== 'active' || puzzle.reviewIndex !== puzzle.decisionIndex))) return;
  const board = new Chess(position.fen);
  const piece = board.get(square);
  if (selected && selected !== square && tryMove(selected, square)) return;
  if (puzzle) puzzle.wrongSquare = null;
  selected = selected !== square && piece?.color === board.turn() ? square : null;
  renderPieces();
  renderScore();
}

function tryMove(from, to) {
  if (demo) return false;
  const puzzle = activeChallenge();
  const position = shownPosition();
  if (position.terminal || (tab === 'puzzles' && (puzzle?.status !== 'active' || puzzle.reviewIndex !== puzzle.decisionIndex)) || !/^[a-h][1-8]$/.test(from)) return false;
  const board = boardAt(position);
  const available = board.moves({ square: from, verbose: true }).filter(move => move.to === to);
  if (!available.length) return false;
  if (available[0].promotion) {
    pendingPromotion = { from, to, node: position, puzzle };
    $('promotions').replaceChildren(...available.map(move => {
      const button = element('button', undefined, 'secondary');
      button.append(...pieceGraphic({ type: move.promotion, color: move.color }));
      button.title = NAMES[move.promotion];
      button.setAttribute('aria-label', NAMES[move.promotion]);
      button.onclick = () => {
        const pending = pendingPromotion;
        $('promotion').close();
        if (pending?.node === shownPosition() && pending.puzzle === activeChallenge()) commitMoves([pending.from + pending.to + move.promotion]);
      };
      return button;
    }));
    if (!$('promotion').open) $('promotion').showModal();
    return true;
  }
  commitMoves([from + to]);
  return true;
}

function commitMoves(moves) {
  if (tab === 'puzzles') { submitPuzzleMove(moves[0]); return; }
  const board = boardAt(cursor);
  let parent = cursor;
  try {
    for (const u of moves) {
      const move = board.move(moveFromUci(u));
      parent = addChild(parent, board, move);
    }
  } catch { return; }
  if (review && parent.userEdited) { resumeReview = true; stopReview(false); }
  if (tab === 'import') setTab('lines');
  goTo(parent);
}

function badge(key) {
  const value = CLASSIFICATIONS[key];
  if (!value) return null;
  const node = element('span', undefined, 'badge class-' + key);
  node.append(icon(key));
  node.title = value[1];
  node.setAttribute('aria-label', value[1]);
  return node;
}

function moveButton(node) {
  const button = element('button');
  button.dataset.ply = node.id;
  if (CLASSIFICATIONS[node.classification]) {
    const marker = badge(node.classification);
    marker.classList.add('move-classification');
    button.append(marker);
  }
  button.append(document.createTextNode(node.move.san));
  if (node === cursor) button.setAttribute('aria-current', 'step');
  return button;
}

function renderHistory() {
  const main = mainPath();
  const active = linePath(cursor);
  const fragments = [];
  const list = $('move-list');
  const scroll = list.scrollTop;
  const focusedPly = list.contains(document.activeElement) ? document.activeElement.dataset.ply : null;
  $('ply-count').textContent = (main.length - 1) + (main.length === 2 ? ' lance' : ' lances');
  if (main.length === 1 && !cursor.userEdited && !root.children.length) {
    list.replaceChildren(element('p', 'Jogue no tabuleiro ou importe uma partida.', 'history-empty muted'));
  } else {
    const rows = [];
    for (const node of main.slice(1)) {
      const number = Number(node.parent.fen.split(' ')[5]);
      let row = rows.at(-1);
      if (!row || row.number !== number) { row = { number }; rows.push(row); }
      row[node.move.color] = node;
    }
    for (const row of rows) {
      const line = element('div', undefined, 'move-row');
      line.append(element('span', row.number + '.'), row.w ? moveButton(row.w) : element('span', '…'), row.b ? moveButton(row.b) : element('span'));
      fragments.push(line);
    }
    const branch = active.filter(node => node !== root && !main.includes(node));
    const alternatives = cursor.parent?.children.length > 1 ? cursor.parent.children : cursor.children.length > 1 ? cursor.children : [];
    if (branch.length || alternatives.length) {
      const block = element('div', undefined, 'branch pv');
      block.append(element('p', 'Variações', 'muted'));
      const unique = Array.from(new Set([...alternatives, ...branch]));
      for (const node of unique) block.append(moveButton(node));
      fragments.push(block);
    }
    list.replaceChildren(...fragments);
    list.scrollTop = scroll;
    const current = list.querySelector('[aria-current="step"]');
    if (focusedPly) list.querySelector('[data-ply="' + focusedPly + '"]')?.focus({ preventScroll: true });
    if (current) {
      const item = current.getBoundingClientRect();
      const bounds = list.getBoundingClientRect();
      if (item.top < bounds.top) list.scrollTop += item.top - bounds.top;
      else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
    }
  }
  $('first').disabled = $('prev').disabled = !cursor.parent;
  $('next').disabled = $('last').disabled = !cursor.children.length;
  $('play').disabled = !cursor.children.length && !runningTimer;
}

const CHART_INSET = 7;

function chartX(index, count, width) {
  return CHART_INSET + (width - 2 * CHART_INSET) * index / Math.max(1, count - 1);
}

function renderChart() {
  const surface = canvasContext($('chart'));
  if (!surface) return;
  const { context, width, height } = surface;
  const nodes = mainPath();
  const y = evaluation => CHART_INSET + (height - 2 * CHART_INSET) * (1 - winPercent(evaluation) / 100);
  const points = nodes.flatMap((node, index) => node.evaluation
    ? [{ node, x: chartX(index, nodes.length, width), y: y(node.evaluation) }]
    : []);

  if (points.length) {
    const first = points[0];
    const last = points.at(-1);
    context.beginPath();
    context.moveTo(first.x, height);
    for (const point of points) context.lineTo(point.x, point.y);
    context.lineTo(last.x, height);
    context.closePath();
    context.fillStyle = '#c9d0c6';
    context.fill();
  }

  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.strokeStyle = 'rgba(126, 145, 136, .65)';
  context.lineWidth = 1;
  context.stroke();

  if (points.length) {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.strokeStyle = '#f7f8f2';
    context.lineWidth = 1.5;
    context.lineJoin = 'round';
    context.stroke();
  }

  const current = chartSelectionFor(cursor, nodes);
  const selected = points.find(point => point.node === current);
  if (selected) {
    context.strokeStyle = current.chanceLost ? '#ff8b82' : '#c3e2a1';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(selected.x, 0);
    context.lineTo(selected.x, height);
    context.stroke();
  }
  renderChartMarkers(points, current);
}

function renderChartMarkers(points, current) {
  const layer = $('chart-markers');
  const activeId = document.activeElement?.dataset.chartPly;
  const rendered = new Map(Array.from(layer.children, button => [Number(button.dataset.chartPly), button]));
  for (const { node, x, y } of chartMarkerPoints(points)) {
    let button = rendered.get(node.id);
    if (!button) {
      button = element('button', undefined, 'chart-marker');
      button.type = 'button';
      button.dataset.chartPly = node.id;
      const next = Array.from(layer.children).find(child => Number(child.dataset.chartPly) > node.id);
      layer.insertBefore(button, next ?? null);
    }
    if (button.dataset.category !== node.classification) {
      button.dataset.category = node.classification;
      button.replaceChildren(badge(node.classification));
    }
    const description = moveNumber(node) + ' ' + node.move.san + ' · ' + translate(CLASSIFICATIONS[node.classification][1]);
    button.title = description;
    button.setAttribute('aria-label', description);
    if (node === current) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.style.left = x + 'px';
    button.style.top = y + 'px';
    rendered.delete(node.id);
  }
  for (const button of rendered.values()) button.remove();
  if (activeId && !layer.querySelector('[data-chart-ply="' + activeId + '"]')) $('chart').focus({ preventScroll: true });
}

function renderMoments(path) {
  const target = $('key-moments');
  const moments = reviewSide === 'all'
    ? path.slice(1).filter(node => node.coach && (node.terminal || ['blunder','mistake','brilliant','great','chance-lost'].includes(node.classification)))
    : reviewHighlights(path, reviewSide, winPercent);
  $('moment-count').textContent = moments.length + (moments.length === 1 ? ' lance' : ' lances');
  if (!moments.length) {
    target.replaceChildren(element('p', 'Nenhum momento destacado na análise disponível.', 'muted moments-empty'));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const node of moments) {
    const row = element('button', undefined, 'moment-row class-' + node.classification);
    row.type = 'button';
    row.append(badge(node.classification));
    const details = element('span', undefined, 'moment-copy');
    details.append(
      element('strong', moveNumber(node) + node.move.san),
      element('small', displayName(node.move.color) + ' · ' + CLASSIFICATIONS[node.classification][1])
    );
    if (node.chanceLost?.reason) {
      details.append(element('small', node.chanceLost.reason, 'moment-reason'));
    } else if (node.coach?.best) {
      const guide = node.momentCoach === node.coach ? node.momentGuide : inspectMove(Chess, node);
      node.momentCoach = node.coach; node.momentGuide = guide;
      details.append(element('small', guide.reason, 'moment-reason'));
    }
    row.append(details, icon('next'));
    row.title = 'Ir para ' + moveNumber(node) + node.move.san;
    row.onclick = () => selectReviewMove(node);
    fragment.append(row);
  }
  target.replaceChildren(fragment);
}

function renderRatingEstimates(path) {
  const unavailable = {
    pending: 'A revisão ainda não terminou.',
    short: 'Poucas decisões úteis para estimar.',
    'outside-range': 'Perfil fora da amostra de referência.',
    'time-control': 'Ritmo da partida não identificado.',
    pool: 'Origem da partida não identificada no PGN.',
    rating: 'O PGN não informa um rating válido.',
    bullet: 'Estimativa indisponível no bullet.',
    classical: 'Estimativa indisponível no clássico.',
  };
  const format = new Intl.NumberFormat(getLanguage());
  const detail = ['w', 'b'].map(side => {
    const white = side === 'w';
    const prefix = white ? 'white' : 'black';
    const actual = recordedRating(gameHeaders[white ? 'WhiteElo' : 'BlackElo']);
    const estimate = estimatePerformance(path, side, gameHeaders);
    $(prefix + '-pgn-rating').textContent = actual === null ? '—' : format.format(actual);
    $(prefix + '-game-rating').textContent = estimate.available ? format.format(estimate.rating) : '—';

    const card = element('div', undefined, 'rating-estimate');
    card.append(element('b', displayName(side), 'rating-player'));
    if (!estimate.available) {
      card.append(element('small', unavailable[estimate.reason] || unavailable['outside-range']));
      return card;
    }
    const pool = estimate.pool === 'chesscom' ? 'Chess.com' : 'Lichess';
    card.append(
      element('small', 'Faixa indicativa: ' + format.format(estimate.low) + '–' + format.format(estimate.high), 'rating-range'),
      element('small', 'Escala: ' + pool + ' · ' + (estimate.timeClass === 'blitz' ? 'Blitz' : 'Rapid')),
    );
    if (Number.isFinite(estimate.validation?.mae)) {
      card.append(element('small', 'Erro médio absoluto no teste histórico: ' + Math.round(estimate.validation.mae) + ' pontos'));
    }
    return card;
  });
  $('rating-estimates').replaceChildren(...detail);
}

function tacticalPosition(before,node){
 if(node.move?.captured||node.move?.promotion||node.move?.san?.includes('+'))return true;
 const best=before.lines?.[0],second=before.lines?.[1],gap=best&&second?Math.abs(best.value-second.value):0;
 if(!best?.pv?.length)return false;
 const board=new Chess(before.fen);
 for(const [index,command] of best.pv.slice(0,3).entries()){
  let move;try{move=board.move(moveFromUci(command))}catch{break}
  if(move.captured||move.promotion||move.san.includes('+'))return index===0||gap>=100;
 }
 return gap>=120;
}
function renderPhaseReport(path) {
  const target=$('phase-insights');if(!target)return;
  const entries=path.slice(1).flatMap(node=>{
    if(!node.coach||!node.classification||node.forced)return[];
    const ply=(Number(node.parent.fen.split(' ')[5])-1)*2+(node.move.color==='w'?1:2);
    node.aspects??=aspectEvidence(node,phaseForPosition(node.parent.fen,ply),Chess);
    return[{node,tags:node.aspects}];
  });
  const areas=['Abertura','Táticas','Estratégia','Final','Princípios'];
  const sections=areas.map(label=>{
    const section=element('details',undefined,'aspect-row'),summary=element('summary'),notes=element('div',undefined,'aspect-notes');
    summary.append(element('strong',label));
    for(const side of ['w','b']){
      const group=entries.filter(item=>item.node.move.color===side&&item.tags.has(label));
      const grade=aspectGrade(group.map(item=>item.node)),column=element('span',undefined,'aspect-grade');
      column.title=displayName(side);
      if(grade)column.append(badge(grade.key),element('small',CLASSIFICATIONS[grade.key][1]));
      else column.append(element('small','Sem dados'));
      summary.append(column);
      const note=element('div',undefined,'aspect-note');note.append(element('b',displayName(side)));
      if(!grade)note.append(element('small','Sem situação relevante para avaliar'));
      else{
        const sample=grade.count<3?' · Amostra curta':'';
        note.append(element('small',grade.count+' lances · '+grade.errors+' imprecisões/erros · '+grade.misses+' oportunidades perdidas'+sample,'aspect-metrics'));
        const ordered=[...group].sort((a,b)=>aspectGrade([a.node]).score-aspectGrade([b.node]).score);
        const examples=ordered.length>1?[ordered[0],ordered[ordered.length-1]]:[ordered[0]];
        for(const item of Array.from(new Set(examples))){
          const key=item.node.classification,link=element('button',undefined,'text-button aspect-example');
          link.append(badge(key),document.createTextNode(moveNumber(item.node)+item.node.move.san));
          link.title=item.tags.get(label)||CLASSIFICATIONS[key][1];link.onclick=()=>goTo(item.node);note.append(link);
        }
      }
      notes.append(note);
    }
    section.append(summary,notes);return section;
  });
  const previous=[...target.querySelectorAll('details')].map(item=>item.open);
  sections.forEach((section,index)=>section.open=previous.length?Boolean(previous[index]):index<2);
  const headings=element('div',undefined,'aspect-columns');
  headings.append(element('span','Aspecto'),element('span',displayName('w')),element('span',displayName('b')));
  target.replaceChildren(headings,...sections);
  const opening=gameHeaders.Opening||(gameHeaders.ECO?'ECO '+gameHeaders.ECO:'');
  target.append(element('p',opening?'Abertura identificada: '+opening:'As notas usam as classificações dos lances relevantes; áreas sem amostra não recebem nota.','muted phase-opening'));
}

async function reviewExploration(node, engine, cache, depth, task) {
  async function evaluate(position) {
    if (position.terminal) return {lines:[position.terminal],best:null};
    const saved = position.reviewData;
    if (saved?.cache === cache && saved.depth === depth) return saved.result;
    const raw = await engine.search(root.fen, pathTo(position).map(n => uci(n.move)), depth, 3, { signal:task.controller.signal });
    if (live !== task) throw new DOMException('Cancelled','AbortError');
    if (!raw.lines.length) throw new Error('O motor não retornou uma avaliação.');
    const result = {...raw, lines:raw.lines.map(line => normalizeLine(line, position))};
    position.reviewData = {cache,depth,result};
    return result;
  }
  const parent = node.parent;
  const before = await evaluate(parent);
  if (live !== task) return;
  const after = await evaluate(node);
  if (live !== task || cursor !== node) return;
  node.lines = after.lines;
  node.evaluation = after.lines[0];
  node.best = after.best;
  node.depth = node.terminal ? depth : node.evaluation.depth;
  gradeMove(node, before.lines, before.best, pathTo(node).length);
}

function gradeMove(node, choices, best, index) {
  const before = choices[0];
  node.coach = {before,after:node.evaluation,best,choices};
  node.forced = new Chess(node.parent.fen).moves().length <= 1;
  node.accuracy = moveAccuracyBetween(before,node.evaluation,node.move.color);
  node.aspects = null;
  node.chanceLost = missedOpportunity(Chess,node.parent,node);
  node.classification = reviewClass(node,before,node.evaluation,best,choices,index);
}

function moveSan(ChessClass,fen,command){try{return new ChessClass(fen).move(moveFromUci(command)).san}catch{return command||''}}

function variationText(fen, pv) {
  if (!pv?.length) return '';
  const chess = new Chess(fen);
  const captions = [];
  for (const [index, command] of pv.slice(0, 10).entries()) {
    const side = chess.turn();
    const number = chess.fen().split(' ')[5];
    let move;
    try { move = chess.move(moveFromUci(command)); } catch { break; }
    captions.push((side === 'w' ? number + '. ' : index === 0 ? number + '… ' : '') + move.san);
  }
  return captions.join(' ');
}

function renderVariantEvaluation(node) {
  const target=$('variant-analysis');target.replaceChildren();target.hidden=!node?.userEdited;if(!node?.userEdited)return;
  const original=pathTo(node).reverse().find(item=>!item.userEdited)||root;
  const back=element('button','Voltar à partida','mini');back.onclick=()=>{goTo(original);if(original.children[0])preferred.set(original,original.children[0])};
  target.append(back,element('h4','Análise da variante exploratória'));
  if(!node.evaluation){target.append(element('p','Aguardando a avaliação do Stockfish para esta nova posição…','muted'));return}
  const percentage=winPercent(node.evaluation);
  const advantage=percentage>55?'Vantagem das brancas · '+Math.round(percentage)+'%':percentage<45?'Vantagem das pretas · '+Math.round(100-percentage)+'%':'Posição equilibrada · '+Math.round(Math.max(percentage,100-percentage))+'%';
  const summary=element('div',undefined,'variant-summary');
  summary.append(element('strong',evaluationLabel(node.evaluation),'variant-score'),element('span',advantage));
  target.append(summary,element('p','Stockfish 19 · profundidade '+(node.depth||'…'),'muted'));
  if(node.classification&&CLASSIFICATIONS[node.classification]){
    const quality=element('div',undefined,'variant-quality');quality.append(badge(node.classification),element('strong',CLASSIFICATIONS[node.classification][1]));target.append(quality);
  }
  if(node.coach){
    const bestUci=node.coach.best||node.coach.choices?.[0]?.pv?.[0],bestSan=bestUci?moveSan(Chess,node.parent.fen,bestUci):'—';
    const comparison=element('div',undefined,'variant-comparison');
    comparison.append(element('span','Sua jogada: '+node.move.san),element('span','Melhor alternativa: '+bestSan));
    const sign=node.move.color==='w'?1:-1,before=node.coach.before,after=node.coach.after;
    if(before&&after&&before.type!=='mate'&&after.type!=='mate'){
      const loss=Math.max(0,sign*(Number(before.white||0)-Number(after.white||0)));
      comparison.append(element('small','Variação da avaliação para quem jogou: '+(loss/100).toFixed(2)+' peões'));
    }
    target.append(comparison);
  }
  if(node.lines?.[0]?.pv?.length)appendCoachLine(target,'Melhor continuação a partir da posição atual',variationText(node.fen,node.lines[0].pv));
  else target.append(element('p','O motor ainda não encontrou uma continuação completa.','muted'));
}

function placeReviewTransport() {
  const docked = tab === 'report' && reviewMode === 'guided' &&
    document.fullscreenElement !== $('board-area') && !fullscreenFallback;
  const target = $(docked ? 'review-transport' : 'board-bottom');
  const transport = $('transport');
  $('review-transport').hidden = !docked;
  if (transport.parentElement !== target) target.append(transport);
}

function syncReviewLayout() {
  const reviewing = tab === 'report';
  const guided = reviewing && reviewMode === 'guided';
  const report = $('report');
  report.dataset.reviewMode = reviewMode;
  $('review-summary').hidden = guided;
  $('review-guided').hidden = !guided;
  $('review-start').hidden = guided;
  $('review-overview-link').hidden = !guided;
  const chart = $('chart-wrap');
  const chartSlot = $(guided ? 'review-timeline' : 'review-summary-chart');
  if (chart.parentElement !== chartSlot) chartSlot.append(chart);
  const history = $('game-history');
  const historySlot = guided ? $('review-history') : report.closest('.inspector');
  if (history.parentElement !== historySlot) historySlot.append(history);
  history.hidden = reviewing && !guided || tab === 'puzzles';
  placeReviewTransport();
}

function selectReviewMove(node) {
  if (!node) return;
  if (tab === 'report' && node !== root) reviewMode = 'guided';
  if (node === cursor) render();
  else goTo(node);
}

function startGuidedReview() {
  const path = mainPath();
  selectReviewMove(reviewSide === 'all' ? path.find(isTrainingMove) || path[1] : reviewHighlights(path, reviewSide, winPercent)[0]);
  $('move-detail').querySelector('h4')?.focus({ preventScroll: true });
}

function renderReport() {
  renderChart();
  if (!root) return;
  const path = mainPath();
  const counts = { w: {}, b: {} };
  for (const node of path.slice(1)) {
    if (!node.classification) continue;
    const side = node.move.color;
    counts[side][node.classification] = (counts[side][node.classification] || 0) + 1;
  }
  $('white-accuracy-label').textContent = displayName('w');
  $('black-accuracy-label').textContent = displayName('b');
  const whiteGameAccuracy = aggregateGameAccuracy(path, 'w', winPercent);
  const blackGameAccuracy = aggregateGameAccuracy(path, 'b', winPercent);
  $('white-acc').textContent = whiteGameAccuracy === null ? '—' : whiteGameAccuracy.toFixed(1).replace('.', ',') + '%';
  $('black-acc').textContent = blackGameAccuracy === null ? '—' : blackGameAccuracy.toFixed(1).replace('.', ',') + '%';
  renderRatingEstimates(path);
  renderPhaseReport(path);
  renderVariantEvaluation(cursor);
  $('chart-end').textContent = path.length === 1 ? 'Fim' : (path.length - 1) + ' lances';
  renderMoments(path);
  $('review-btn').disabled = path.length === 1 && !review;
  $('review-side').value = reviewSide;
  $('review-filter').hidden = path.length < 2;
  $('review-start').disabled = Boolean(review) || (reviewSide === 'all'
    ? !path.some(node => node.classification) : !reviewHighlights(path, reviewSide, winPercent).length);
  renderCoach(cursor, path);
  const count = path.filter(isTrainingMove).length;
  $('practice-from-report').hidden = !count;
  $('practice-from-report').textContent = count === 1 ? 'Treinar no puzzle' : 'Treinar em ' + count + ' puzzles';
  const rows = Object.entries(CLASSIFICATIONS).map(([key, [, label]]) => {
    const row = element('tr', undefined, 'class-' + key);
    const kind = element('th');
    kind.scope = 'row';
    kind.append(badge(key), document.createTextNode(label));
    row.append(kind);
    for (const side of ['w', 'b']) {
      const count = counts[side][key] ?? 0;
      const cell = element('td', count);
      cell.dataset.count = count;
      row.append(cell);
    }
    return row;
  });
  $('class-breakdown').replaceChildren(...rows);
}

function stopDemo() {
  if (!demo) return;
  clearTimeout(demo.timer);
  demo = null;
}

function showDemo(node, better = false) {
  if (!node?.parent || !node.coach?.best) return;
  stopPlayback();
  stopDemo();
  clearTimeout(soundTimer);
  hideMate();
  const board = boardAt(node.parent);
  const moves = better ? [node.coach.best] : [uci(node.move), node.coach.after?.pv?.[0]].filter(Boolean);
  const frames = [node.parent];
  for (const move of moves) {
    try {
      const played = board.move(moveFromUci(move));
      const frame = createPosition(board, frames.at(-1), played);
      frame.evaluation = better ? node.coach.before : node.coach.after;
      if (!better && frames.length === 1) frame.classification = node.classification;
      frames.push(frame);
    } catch { break; }
  }
  selected = null;
  const state = { frames, index: 0, timer: null, better };
  demo = state;
  render();
  if (matchMedia('(max-width: 820px)').matches) $('board-area').scrollIntoView({ block: 'start', behavior: 'instant' });
  const advance = () => {
    if (demo !== state || state.index >= frames.length - 1) return;
    state.index++;
    render();
    playSound(moveSound(frames[state.index].move));
    if (state.index < frames.length - 1) state.timer = setTimeout(advance, 650);
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.index = frames.length - 1;
    render();
  } else {
    state.timer = setTimeout(advance, 475);
  }
}

function renderCoach(node, path) {
  const detail = $('move-detail');
  if (reviewMode !== 'guided') return;
  const reviewed = node;
  const wasOpen = detail.querySelector('#coach-explanation')?.hidden === false && detail.dataset.ply === String(reviewed.id);
  const focusedAction = document.activeElement?.dataset.coachAction;
  detail.dataset.ply = reviewed.id;
  detail.className = 'move-detail' + (reviewed.classification ? ' class-' + reviewed.classification : '');
  detail.replaceChildren();

  const headingText = reviewed.move ? moveNumber(reviewed) + ' ' + reviewed.move.san : 'Posição inicial';
  const classification = CLASSIFICATIONS[reviewed.classification];
  const heading = element('h4', headingText + (classification ? ' · ' + classification[1] : ''));
  heading.tabIndex = -1;
  const head = element('div', undefined, 'move-detail-head');
  head.append(classification ? badge(reviewed.classification) : icon('chart'), heading,
    element('span', evaluationLabel(reviewed.evaluation), 'move-detail-eval'));
  detail.append(head);

  const guide = reviewed.coach?.best ? inspectMove(Chess, reviewed) : null;
  const reason = guide?.reason || (reviewed.move
    ? 'A explicação aparece quando esta posição for revisada.'
    : 'Selecione um lance no histórico ou no gráfico.');
  detail.append(element('p', reason, 'coach-reason'));
  if (demo) {
    const frame = demo.frames[demo.index];
    detail.append(element('p', frame === reviewed.parent ? 'Posição antes do lance' : 'No tabuleiro: ' + moveNumber(frame) + ' ' + frame.move.san, 'coach-preview'));
  }

  const actions = element('div', undefined, 'coach-actions');
  const action = (id, label, handler) => {
    const button = element('button', label, 'mini');
    button.type = 'button';
    button.dataset.coachAction = id;
    button.onclick = handler;
    actions.append(button);
    return button;
  };

  let explanation;
  if (guide) {
    explanation = element('div', undefined, 'coach-variations');
    explanation.id = 'coach-explanation';
    explanation.hidden = !wasOpen;
    const toggle = action('explain', 'Explicar', () => {
      explanation.hidden = !explanation.hidden;
      toggle.setAttribute('aria-expanded', String(!explanation.hidden));
    });
    toggle.setAttribute('aria-controls', explanation.id);
    toggle.setAttribute('aria-expanded', String(!explanation.hidden));
    const visual = action('demo', demo ? 'Encerrar demonstração' : 'Explicar no tabuleiro', () => {
      if (demo) { stopDemo(); render(); } else showDemo(reviewed);
    });
    visual.disabled = Boolean(review);
    const flow = element('div', undefined, 'analysis-flow');
    flow.append(element('span', 'Antes ' + evaluationLabel(guide.before)),
      element('span', 'Depois ' + evaluationLabel(guide.after)));
    explanation.append(flow);
    appendCoachLine(explanation, 'Na partida', guide.chosen);
    appendCoachLine(explanation, 'Melhor linha', guide.recommended);
  }
  if (guide?.proposal && guide.played !== guide.proposal) {
    const preview = action('best', demo?.better ? 'Voltar ao lance' : 'Melhor lance', () => {
      if (demo?.better) { stopDemo(); render(); }
      else showDemo(reviewed, true);
    });
    preview.classList.add('coach-best');
    preview.disabled = Boolean(review);
  }
  const index = path.indexOf(reviewed);
  const highlights = reviewSide === 'all' ? null : reviewHighlights(path, reviewSide, winPercent);
  const next = index >= 0 ? highlights ? highlights.find(item => path.indexOf(item) > index)
    : path.slice(index + 1).find(isTrainingMove) || path[index + 1] : null;
  if (next) action('next', 'Próximo destaque', () => {
    goTo(next);
    detail.querySelector('h4')?.focus({ preventScroll: true });
  });
  if (isTrainingMove(reviewed)) action('puzzle', 'Tentar como puzzle', () => {
    startPuzzle(reviewed);
    setTab('puzzles');
  });
  if (actions.childElementCount) detail.append(actions);
  if (explanation) detail.append(explanation);
  if (focusedAction) detail.querySelector('[data-coach-action="' + focusedAction + '"]')?.focus({ preventScroll: true });
}

function appendCoachLine(target, label, variation) {
  if (!variation) return;
  const line = element('p', undefined, 'coach-line');
  line.append(element('strong', label + ' '), document.createTextNode(variation));
  target.append(line);
}

function moveNumber(node) {
  return node.parent.fen.split(' ')[5] + (node.move.color === 'w' ? '.' : '…');
}

function createPuzzleState(node, saved) {
  const reviewPath = [root, ...pathTo(node.parent)];
  const decisionIndex = reviewPath.length - 1;
  const state = {
    node: { ...node }, lives: 3, status: 'active', wrongSquare: null, lastAttempt: null,
    result: null, reviewPath, reviewIndex: decisionIndex, decisionIndex,
    attempts: Number.isInteger(saved?.attempts) ? Math.max(0, saved.attempts) : 0,
    hint: Boolean(saved?.hint),
  };
  if (saved?.status === 'active' && Number.isInteger(saved.lives)) state.lives = Math.max(1, Math.min(3, saved.lives));
  if (['solved', 'failed'].includes(saved?.status) && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(saved.answer)) {
    try {
      const board = boardAt(node.parent);
      const move = board.move(moveFromUci(saved.answer));
      state.result = createPosition(board, node.parent, move);
      state.status = saved.status;
      state.lives = saved.status === 'solved' ? Math.max(1, Math.min(3, Number(saved.lives) || 1)) : 0;
      state.reviewPath.push(state.result);
      state.reviewIndex++;
    } catch { /* Keep the position available if a saved move is obsolete. */ }
  }
  return state;
}

function puzzleHint(node) {
  if (node.chanceLost?.distance) {
    return 'Procure um mate em ' + node.chanceLost.distance + '. Comece pelos xeques.';
  }
  const reply = node.coach.after?.pv?.[0];
  if (reply) {
    const board = boardAt(node);
    const move = board.move(moveFromUci(reply));
    if (move.san.endsWith('#')) return 'O adversário ameaçava mate imediato. Procure um jeito de evitar essa resposta.';
    if (move.captured) return 'Na partida, o adversário podia capturar ' + NAMES[move.captured].toLowerCase() + ' em ' + move.to + '. Proteja essa peça ou crie uma ameaça mais forte.';
    if (move.san.endsWith('+')) return 'Observe os xeques do adversário antes de escolher seu lance.';
  }
  return 'Compare os xeques, as capturas e as ameaças dos dois lados antes de jogar.';
}

function startPuzzle(node) {
  if (!isTrainingMove(node)) return;
  if (!puzzleProgress.has(node.id)) puzzleProgress.set(node.id, createPuzzleState(node));
  activePuzzle = puzzleProgress.get(node.id);
  scheduleStudy();
  selected = null;
  if (matchMedia('(max-width: 820px)').matches) {
    requestAnimationFrame(() => $('board-area').scrollIntoView({ block: 'start' }));
  }
}

function submitPuzzleMove(command) {
  const puzzle = activeChallenge();
  if (!puzzle || puzzle.status !== 'active' || puzzle.reviewIndex !== puzzle.decisionIndex) return;
  const position = shownPosition();
  const board = boardAt(position);
  let move;
  try { move = board.move(moveFromUci(command)); } catch { playSound('illegal'); return; }
  playSound(moveSound(move));
  puzzle.attempts += 1;
  selected = null;
  puzzle.wrongSquare = null;
  const correct = acceptedMove(puzzle.node.coach, command) ||
    shortMateAfter(Chess, move.after, puzzle.node.chanceLost?.distance);
  if (command !== uci(puzzle.node.move) && correct) {
    puzzle.status = 'solved';
    puzzle.result = createPosition(board, position, move);
  } else {
    puzzle.lives -= 1;
    puzzle.lastAttempt = move.san;
    puzzle.wrongSquare = move.to;
    if (!puzzle.lives) {
      puzzle.status = 'failed';
      const solution = boardAt(position);
      const answer = solution.move(moveFromUci(puzzle.node.coach.best));
      puzzle.result = createPosition(solution, position, answer);
    }
  }
  if (puzzle.result) {
    puzzle.reviewPath.push(puzzle.result);
    puzzle.reviewIndex = puzzle.reviewPath.length - 1;
  }
  render();
  scheduleStudy();
}

function renderPuzzles() {
  const training = mainPath().filter(isTrainingMove);
  const solved = training.filter(node => puzzleProgress.get(node.id)?.status === 'solved').length;
  const puzzle = activeChallenge();
  const list = $('puzzle-list');
  const content = $('puzzle-content');
  const hearts = $('puzzle-lives');
  hearts.replaceChildren();
  hearts.hidden = !puzzle;
  content.replaceChildren();
  $('puzzle-summary').textContent = training.length ? solved + ' de ' + training.length + ' resolvidos' : 'Encontre alternativas melhores para os seus lances.';
  const card = element('div', undefined, 'puzzle-card');
  if (puzzle) {
    hearts.setAttribute('aria-label', puzzle.lives + ' de 3 vidas');
    for (let index = 0; index < 3; index += 1) {
      const heart = element('span', undefined, index < puzzle.lives ? '' : 'lost');
      heart.append(icon('heart'));
      heart.setAttribute('aria-hidden', 'true');
      hearts.append(heart);
    }
    const color = puzzle.node.move.color === 'w' ? 'Brancas' : 'Pretas';
    const atMove = 'Lance ' + moveNumber(puzzle.node) + ' · ' + color;
    const reviewIndex = puzzle.reviewIndex ?? puzzle.decisionIndex;
    const decisionIndex = puzzle.decisionIndex ?? puzzle.reviewPath.length - 1;
    const historyEnd = puzzle.reviewPath.length - 1;
    const atDecision = reviewIndex === decisionIndex;
    const previous = puzzle.node.parent;
    card.append(element('p',
      previous?.move ? 'Último lance do adversário: ' + moveNumber(previous) + previous.move.san : 'Posição inicial da partida.',
      'puzzle-last-move'
    ));
    const navigation = element('div', undefined, 'puzzle-navigation');
    const controls = [
      { label: 'Voltar ao início', icon: 'first', index: 0 },
      { label: 'Voltar um lance', icon: 'prev', index: Math.max(0, reviewIndex - 1) },
      { label: 'Avançar um lance', icon: 'next', index: Math.min(historyEnd, reviewIndex + 1) },
      { label: 'Ir ao final', icon: 'last', index: historyEnd },
    ];
    controls.forEach((control, controlIndex) => {
      const button = element('button', undefined, 'mini puzzle-nav-button');
      button.type = 'button';
      button.append(icon(control.icon));
      button.title = control.label;
      button.setAttribute('aria-label', control.label);
      button.disabled = control.index === reviewIndex ||
        (controlIndex < 2 && reviewIndex === 0) ||
        (controlIndex > 1 && reviewIndex === historyEnd);
      button.onclick = () => {
        puzzle.reviewIndex = control.index;
        selected = null;
        render();
      };
      navigation.append(button);
    });
    navigation.append(element('span', 'Posição ' + (reviewIndex + 1) + ' de ' + puzzle.reviewPath.length, 'puzzle-position-count'));
    card.append(navigation);
    if (puzzle.status === 'active') {
      card.append(element('h4', atMove), element('p',
        atDecision ? 'Encontre o melhor lance para ' + color.toLowerCase() + '.' : 'Revise a partida livremente. Avance até a posição final para resolver o puzzle.',
        'muted'
      ));
      if (atDecision) {
        const hint = element('button', puzzle.hint ? 'Ocultar dica' : 'Ver dica', 'mini puzzle-hint-button');
        hint.type = 'button';
        hint.setAttribute('aria-expanded', String(puzzle.hint));
        hint.onclick = () => { puzzle.hint = !puzzle.hint; render(); scheduleStudy(); $('puzzle-content').querySelector('.puzzle-hint-button')?.focus(); };
        card.append(hint);
        if (puzzle.hint) {
          let message;
          try { message = puzzleHint(puzzle.node); }
          catch { message = 'Compare os xeques, as capturas e as ameaças dos dois lados antes de jogar.'; }
          card.append(element('p', message, 'puzzle-hint'));
        }
      }
    } else {
      const guide = inspectMove(Chess, puzzle.node);
      card.append(element('h4', puzzle.status === 'solved' ? 'Puzzle resolvido' : 'Você ficou sem vidas', puzzle.status === 'solved' ? 'puzzle-done' : 'puzzle-failed'));
      card.append(element('p', puzzle.status === 'solved' ? 'Seu lance ' + puzzle.result.move.san + ' funciona nesta posição.' : 'O melhor lance era ' + guide.proposal + '.', 'coach-reason'));
      if (puzzle.status === 'solved' && uci(puzzle.result.move) !== puzzle.node.coach.best) {
        card.append(element('p', puzzle.node.chanceLost?.distance
          ? 'Esta alternativa também encontra o mate procurado.'
          : 'Sua alternativa mantém a avaliação próxima da melhor linha do motor.', 'muted'));
      }
      card.append(element('p', guide.reason, 'coach-reason'));
      appendCoachLine(card, 'Melhor continuação', guide.recommended);
      const next = training.find(node => node.id !== puzzle.node.id && (puzzleProgress.get(node.id)?.status ?? 'active') === 'active');
      if (next || puzzle.status === 'failed') {
        const actions = element('div', undefined, 'coach-actions');
        if (puzzle.status === 'failed') {
          const retry = element('button', 'Tentar de novo', 'mini');
          retry.onclick = () => {
            puzzleProgress.set(puzzle.node.id, createPuzzleState(puzzle.node, { attempts: puzzle.attempts }));
            startPuzzle(puzzle.node);
            render();
          };
          actions.append(retry);
        }
        const nextButton = element('button', 'Próximo puzzle', 'mini');
        nextButton.onclick = () => { startPuzzle(next); render(); };
        if (next) actions.append(nextButton);
        card.append(actions);
      }
    }
  } else {
    const empty = review ? 'Os puzzles aparecem conforme o Stockfish revisa os lances.' : 'Carregue uma partida e faça a revisão para gerar puzzles a partir dos erros.';
    card.append(element('p', training.length ? 'Escolha uma posição. Você tem três vidas por puzzle.' : empty, 'muted'));
  }
  content.append(card);
  list.replaceChildren(...training.map(node => {
    const progress = puzzleProgress.get(node.id);
    const kind = CLASSIFICATIONS[node.classification][1];
    const button = element('button', undefined, 'game-option puzzle-option');
    button.append(element('span', 'Lance ' + moveNumber(node) + ' · ' + kind));
    const status = progress?.status;
    const hint = status === 'solved' ? 'Resolvido' : status === 'failed' ? 'Encerrado' : (progress?.lives ?? 3) + ' vidas';
    button.append(element('span', hint, 'puzzle-state'));
    if (puzzle?.node.id === node.id) button.setAttribute('aria-current', 'true');
    button.onclick = () => { startPuzzle(node); render(); };
    return button;
  }));
}

function renderLines() {
  const lines = cursor.lines.filter(line => line.pv.length);
  const shown = lines.map((line, index) => {
    const moveSequence = [];
    const row = element('div', undefined, 'pv');
    if (index === 0) row.classList.add('pv-best');
    const buttons = element('div');
    row.append(element('strong', evaluationLabel(line)), buttons);
    const chess = new Chess(cursor.fen);
    for (const u of line.pv.slice(0, 9)) {
      const side = chess.turn();
      const number = chess.fen().split(' ')[5];
      let move;
      try { move = chess.move(moveFromUci(u)); } catch { break; }
      moveSequence.push(u);
      const prefix = side === 'w' ? number + '. ' : moveSequence.length === 1 ? number + '… ' : '';
      const button = element('button', prefix + move.san);
      if (index === 0 && moveSequence.length === 1) button.classList.add('best-variation');
      const sequence = [...moveSequence];
      button.onclick = () => commitMoves(sequence);
      buttons.append(button);
    }
    return row;
  });
  if (!shown.length) {
    shown.push(element('p', cursor.terminal ? 'Posição final.' : engineOn ? 'As melhores continuações aparecem aqui.' : 'Análise pausada.', 'muted'));
  }
  $('pv-lines').replaceChildren(...shown);
}

function render() {
  if (!cursor) return;
  renderPieces();
  renderPlayers();
  renderScore();
  const training = tab === 'puzzles';
  const puzzle = activeChallenge();
  $('transport').hidden = training;
  syncReviewLayout();
  $('export').hidden = training;
  const feedback = $('board-feedback');
  const rating = !puzzle && !training && CLASSIFICATIONS[cursor.classification] ? CLASSIFICATIONS[cursor.classification] : null;
  feedback.hidden = !puzzle && !rating && !demo;
  feedback.dataset.demo = String(Boolean(demo));
  if (demo) {
    const frame = demo.frames[demo.index];
    const back = element('button', 'Voltar à explicação', 'mini');
    back.onclick = () => {
      stopDemo();
      render();
      $('move-detail').scrollIntoView({ block: 'nearest' });
    };
    feedback.replaceChildren(element('span', frame.move?.san || 'Posição inicial'), back);
  } else if (puzzle) {
    feedback.textContent = puzzle.status === 'solved'
      ? 'Boa! ' + puzzle.result.move.san + ' resolve a posição.'
      : puzzle.status === 'failed'
        ? 'Fim das três vidas. A solução está no tabuleiro.'
        : puzzle.reviewIndex !== puzzle.decisionIndex
          ? 'Você está revendo o histórico. Avance até a última posição para jogar.'
          : puzzle.lastAttempt
            ? puzzle.lastAttempt + ' não resolve. ' + (puzzle.lives === 1 ? 'Resta uma vida.' : 'Restam duas vidas.')
            : 'Jogue a melhor opção no tabuleiro.';
  } else if (rating) {
    feedback.replaceChildren(badge(cursor.classification), document.createTextNode(cursor.move.san + ' · ' + rating[1]));
  }
  if (tab === 'report') renderReport();
  if (!training) renderHistory();
  if (tab === 'lines') renderLines();
  if (training) renderPuzzles();
}

function setTab(name) {
  if (name !== tab) stopDemo();
  if (name === 'puzzles') { stopPlayback(); hideMate(); }
  if (tab !== name) selected = null;
  tab = name;
  for (const id of TABS) {
    $(id).hidden = id !== name;
    const button = $('tab-' + id);
    button.setAttribute('aria-selected', String(id === name));
    button.tabIndex = id === name ? 0 : -1;
  }
  if (!cursor) return;
  if (name !== 'lines') stopLive();
  $('nav-puzzles').classList.toggle('active', name === 'puzzles');
  $('nav-today').classList.toggle('active', name !== 'puzzles');
  render();
  $('inspector-scroll').scrollTop = 0;
  if (name === 'lines' || (name === 'report' && cursor.userEdited)) queueLive();
  scheduleStudy();
}

function moveAnimationDuration() {
  const speeds = { slow: 420, normal: 235, fast: 125, natural: 205 };
  return speeds[setting('animation-speed')] ?? speeds.natural;
}


function endResult(node) {
  if (node.terminal?.type === 'mate') return node.terminal.white > 0 ? '1-0' : '0-1';
  if (node.terminal?.type === 'cp') return '1/2-1/2';
  if (originalPath && originalPath.length > 1 && originalPath.at(-1) === node) return gameHeaders.Result;
  return null;
}

function goTo(node) {
  if (!node) return;
  if (demo) { stopDemo(); if (node === cursor) render(); }
  if (node === cursor) return;
  const previous = cursor;
  if (node.parent === previous) preferred.set(previous,node);
  if (previous.parent === node) preferred.set(node,previous);
  if (!node.userEdited && previous.parent !== node && node.children[0]) preferred.set(node,node.children[0]);
  const step = previous.parent === node ? previous.move : node.move;
  stopLive();
  hideMate();
  lastMate = null;
  clearTimeout(soundTimer);
  boardMarks = [];
  activeBoardMark = null;
  cursor = node;
  selected = null;
  render();
  scheduleStudy();
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : moveAnimationDuration();
  soundTimer = setTimeout(() => {
    if (cursor !== node || tab === 'puzzles') return;
    if (node.terminal?.type === 'mate') announceMate();
    else if (step && previous.parent !== node) playSound(moveSound(step, endResult(node)));
    else playSound('move');
  }, duration * .77);
  if (resumeReview && !node.userEdited) { resumeReview = false; runReview(); }
  else if (tab === 'lines' || (tab === 'report' && node.userEdited)) queueLive();
}

function stopPlayback() {
  clearInterval(runningTimer);
  runningTimer = null;
  $('play').replaceChildren(icon('play'));
  $('play').setAttribute('aria-pressed', 'false');
  if (cursor) $('play').disabled = !cursor.children.length;
}

function togglePlayback() {
  if (demo) { stopDemo(); render(); }
  if (runningTimer) { stopPlayback(); return; }
  if (!cursor.children.length) return;
  $('play').replaceChildren(icon('pause'));
  $('play').setAttribute('aria-pressed', 'true');
  runningTimer = setInterval(() => {
    goTo(preferred.get(cursor) || cursor.children[0]);
    if (!cursor.children.length) stopPlayback();
  }, 780);
}

function hideMate() {
  clearTimeout(mateTimer);
  const layer = $('mate-effect');
  layer.hidden = true;
  $('board-area').classList.remove('mate-highlight');
}

function announceMate() {
  if (!cursor || cursor.terminal?.type !== 'mate' || tab === 'puzzles' || review) return;
  if (lastMate === cursor) return;
  lastMate = cursor;
  if (setting('mate-enabled')) {
    const layer = $('mate-effect');
    hideMate();
    const winner = cursor.terminal.white > 0 ? 'w' : 'b';
    $('mate-winner').textContent = displayName(winner) + ' · ' + (winner === 'w' ? '1–0' : '0–1');
    $('board-area').classList.add('mate-highlight');
    mateTimer = mateCelebration(layer);
  }
  playSound('win');
}

function syncBoardTools() {
  const full = document.fullscreenElement === $('board-area') || fullscreenFallback;
  placeReviewTransport();
  $('fullscreen').replaceChildren(icon(full ? 'contract' : 'expand'));
  $('fullscreen').setAttribute('aria-pressed', String(full));
  $('fullscreen').title = full ? 'Sair da tela cheia (Esc)' : 'Tela cheia (G)';
  $('fullscreen').setAttribute('aria-label', full ? 'Sair da tela cheia' : 'Tela cheia');
  const soundOn = setting('sound-enabled');
  $('sound').replaceChildren(icon(soundOn ? 'sound' : 'mute'));
  $('sound').setAttribute('aria-pressed', String(soundOn));
  $('sound').title = soundOn ? 'Silenciar tabuleiro' : 'Ativar som do tabuleiro';
}

function fallbackFullscreen(enabled) {
  fullscreenFallback = enabled;
  document.body.classList.toggle('focus-board', enabled);
  syncBoardTools();
}

async function toggleFullscreen() {
  if (fullscreenFallback) { fallbackFullscreen(false); return; }
  if (document.fullscreenElement === $('board-area')) { await document.exitFullscreen(); return; }
  try {
    if (!document.fullscreenEnabled) throw new Error('fullscreen indisponível');
    await $('board-area').requestFullscreen();
  } catch { fallbackFullscreen(true); }
}

function normalizeLine(line, node) {
  const sign = node.fen.split(' ')[1] === 'w' ? 1 : -1;
  return { ...line, white: (line.type === 'mate' ? Math.sign(line.value) : line.value) * sign };
}

function syncEngine(status, caption) {
  const chip = document.querySelector('.engine-label');
  chip.dataset.status = status;
  chip.querySelector('span').textContent = caption;
}

function readyEngine(status = 'ready') {
  if (!engineProfile) return;
  const threads = engineProfile.threads;
  syncEngine(status, engineProfile.name + ' · ' + threads + (threads === 1 ? ' thread' : ' threads'));
}

async function useEngine(onLoad) {
  const mode = setting('engine-mode');
  if (!sharedEngine || sharedEngine.mode !== mode) {
    sharedEngine?.dispose();
    sharedEngine = new Engine(mode);
  }
  const engine = sharedEngine;
  try {
    const profile = await engine.start(build => {
      const loading = build.name === 'Completo' ? 'Carregando completo (~95 MB)' : 'Carregando Lite';
      syncEngine('loading', loading);
      onLoad?.(loading);
    });
    if (sharedEngine === engine) engineProfile = profile;
    return { engine, profile, cache: profile.name + '/' + profile.threads };
  } catch (error) {
    if (sharedEngine === engine) {
      sharedEngine = null;
      engineProfile = null;
      engine.dispose();
    }
    throw error;
  }
}

function engineFailure(error, status) {
  const message = error.name === 'AbortError' ? 'Motor interrompido. Tente iniciar outra análise.' : error.message;
  $(status).textContent = message;
  syncEngine('error', 'Indisponível');
  if (sharedEngine && !sharedEngine.worker) {
    sharedEngine.dispose();
    sharedEngine = null;
    engineProfile = null;
  }
}

function stopLive() {
  clearTimeout(analysisTimer);
  live?.controller.abort();
  live = null;
}

function queueLive() {
  stopLive();
  const showInReport = tab === 'report' && Boolean(cursor?.userEdited);
  if (review && cursor?.userEdited) { resumeReview = true; stopReview(false); }
  const statusId = showInReport ? 'variant-status' : 'engine-status';
  if (!engineOn) { $(statusId).textContent = 'Análise pausada'; return; }
  if (cursor.terminal && !cursor.userEdited) { $(statusId).textContent = 'Posição final'; renderVariantEvaluation(cursor); return; }
  if (review) { $('engine-status').textContent = 'O relatório está usando o motor'; return; }
  $(statusId).textContent = cursor.lines.length ? 'Refinando variante…' : 'Preparando variante…';
  if (showInReport) renderVariantEvaluation(cursor);
  const position = cursor;
  analysisTimer = setTimeout(() => runLive(position, showInReport), 140);
}

async function runLive(position, showInReport = false) {
  const depth = setting('line-depth');
  const count = setting('multi-pv');
  const task = { controller: new AbortController() };
  const statusId = showInReport ? 'variant-status' : 'engine-status';
  const status = message => { $(statusId).textContent = message; };
  live = task;
  try {
    const { engine, profile, cache } = await useEngine(text => { if (live === task) status(text + '…'); });
    if (live !== task) return;
    const engineLabel = 'Stockfish 19 ' + profile.name + ' · profundidade ';
    const key = cache + '/' + depth + '/' + count;
    if (position.userEdited) {
      await reviewExploration(position, engine, cache, depth, task);
      if (live !== task || cursor !== position) return;
      render();
      status(engineLabel + position.depth);
      return;
    }
    if (position.liveKey === key) {
      readyEngine();
      status(engineLabel + position.depth);
      if (showInReport) renderVariantEvaluation(position);
      return;
    }
    readyEngine();
    function update(lines) {
      if (live !== task || !lines.length) return;
      position.lines = lines.map(line => normalizeLine(line, position));
      position.evaluation = position.lines[0];
      position.depth = position.lines[0].depth;
      status(engineLabel + position.depth + ' / ' + depth);
      renderScore();
      if (tab === 'lines') renderLines();
      if (showInReport) renderVariantEvaluation(position);
    }
    const result = await engine.search(root.fen, pathTo(position).map(item => uci(item.move)), depth, count, { update, signal: task.controller.signal });
    if (live !== task) return;
    update(result.lines);
    position.liveKey = key;
    status(engineLabel + position.depth);
  } catch (error) {
    if (live === task) engineFailure(error, statusId);
  } finally {
    if (live === task) live = null;
  }
}

function reviewClass(node, before, after, previousBest, runnersUp, index) {
  const color = node.move.color === 'w' ? 1 : -1;
  const loss = Math.max(0, color * (winPercent(before) - winPercent(after)));
  const actual = uci(node.move);
  const accepted = acceptedMove(node.coach, actual) || loss <= 1;
  const opening = root.fen === new Chess().fen() && loss < 5 &&
    ((index === 1 && BOOK.has(actual)) || (index === 2 && BOOK_REPLY[uci(node.parent.move)]?.includes(actual)));
  const opponentCapture = node.parent.move?.captured ? material[node.parent.move.captured] : 0;
  const staticBoard = new Chess(node.fen);
  const commitment = staticBoard.moves({ verbose: true }).some(reply =>
    reply.to === node.move.to && reply.captured && material[reply.captured] >= 3 &&
    material[reply.captured] - (node.move.captured ? material[node.move.captured] : 0) - opponentCapture >= 2);
  return classifyReviewMove({
    side: node.move.color,
    before,
    after,
    actual,
    bestMove: previousBest,
    accepted,
    chanceLost: node.chanceLost,
    opening,
    alternatives: runnersUp,
    commitment,
  });
}
function stopReview(resumeLive = true) {
  if (!review) return;
  review.controller.abort();
  review = null;
  $('review-btn').textContent = 'Revisar';
  $('review-progress').hidden = true;
  $('report-status').textContent = 'Revisão interrompida.';
  if (resumeLive && tab === 'lines') queueLive();
}

async function runReview() {
  const path = mainPath();
  if (path.length < 2 || review) return;
  stopLive();
  const task = { controller: new AbortController() };
  review = task;
  const depth = setting('review-depth');
  const progress = $('review-progress');
  progress.hidden = false;
  progress.max = path.length;
  progress.value = 0;
  $('review-btn').textContent = 'Parar';
  $('report-status').textContent = 'Iniciando Stockfish 19…';
  for (const node of path) { node.classification = null; node.accuracy = null; node.coach = null; node.chanceLost = null; }
  render();
  let completed = false;
  try {
    const { engine, cache } = await useEngine(text => { if (review === task) $('report-status').textContent = text + '…'; });
    if (review !== task) return;
    readyEngine();
    const commands = path.slice(1).map(node => uci(node.move));
    for (const [index, node] of path.entries()) {
      let result = node.terminal ? { lines: [node.terminal], best: null } : null;
      if (!result && node.reviewData?.depth === depth && node.reviewData.cache === cache) result = node.reviewData.result;
      if (!result) {
        const raw = await engine.search(root.fen, commands.slice(0, index), depth, 3, { signal: task.controller.signal });
        if (!raw.lines.length) throw new Error('O motor não retornou uma avaliação.');
        result = { ...raw, lines: raw.lines.map(line => normalizeLine(line, node)) };
        node.reviewData = { depth, cache, result };
      }
      if (review !== task) return;
      node.evaluation = result.lines[0];
      node.lines = result.lines;
      node.liveKey = null;
      node.best = result.best;
      node.depth = result.lines[0].depth;
      if (index > 0) {
        const before = path[index - 1];
        gradeMove(node, before.lines, before.best, index);
      }
      progress.value = index + 1;
      $('report-status').textContent = 'Avaliando ' + (index + 1) + ' de ' + path.length + ' posições…';
      if (node === cursor) render();
      else if (tab === 'puzzles') renderPuzzles();
      else {
        if (tab === 'report') renderReport();
        renderHistory();
      }
    }
    completed = true;
    studyAnalysis = { version: cacheVersion, depth, positions: path.map(node => ({ lines: node.lines, best: node.best })) };
    scheduleStudy();
    $('report-status').textContent = 'Revisão concluída · profundidade ' + depth;
    readyEngine();
  } catch (error) {
    if (review === task) engineFailure(error, 'report-status');
  } finally {
    if (review === task) {
      review = null;
      progress.hidden = true;
      $('review-btn').textContent = completed ? 'Revisar de novo' : 'Revisar';
      if (tab === 'lines') queueLive();
      if (tab === 'puzzles') renderPuzzles();
      if (tab === 'report') renderReport();
      if (completed) announceMate();
    }
  }
}

function setSource(value) {
  source = value;
  remoteRequest?.abort();
  remoteRequest = null;
  $('submit').disabled = false;
  reportError();
  $('remote-games').replaceChildren();
  $('remote-games').hidden = true;
  const link = value === 'link';
  $('link-options').hidden = !link;
  const external = value === 'chesscom' || value === 'lichess';
  const input = $('game-input');
  const profile = readChessProfile();
  input.value = external && profile?.platform === value ? profile.username : '';
  input.classList.toggle('username', external || link);
  input.rows = external || link ? 1 : 4;
  input.placeholder = link ? 'https://www.chess.com/game/live/…' : value === 'pgn' ? '1. e4 e5 2. Nf3 Nc6 …' : value === 'fen' ?
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : 'Nome de usuário';
  $('input-label').textContent = link ? 'Link da partida' : value === 'pgn' ? 'PGN da partida' : value === 'fen' ? 'FEN da posição' : 'Nome de usuário';
  $('submit-label').textContent = link ? 'Abrir link' : value === 'pgn' ? 'Analisar partida' : value === 'fen' ? 'Analisar posição' : 'Buscar partidas';
  $('file-btn').hidden = value !== 'pgn';
  $('example').hidden = external || link;
  $('example').querySelector('small').textContent = value === 'fen' ? 'Posição de exemplo' : 'Partida de exemplo';
  $('example').querySelector('strong').textContent = value === 'fen' ? 'Posição de meio-jogo' : 'Mate do Pastor';
  document.querySelectorAll('[data-source]').forEach(button => button.setAttribute('aria-pressed', button.dataset.source === value ? 'true' : 'false'));
}

async function fetchGames(site, username, signal) {
  if (!/^[A-Za-z0-9_-]{1,30}$/.test(username)) throw new Error('Informe um nome de usuário válido.');
  const account = encodeURIComponent(username.toLowerCase());
  async function request(url, headers) {
    const response = await fetch(url, { signal, headers });
    if (response.status === 404) throw new Error('Usuário não encontrado.');
    if (response.status === 429) throw new Error('O serviço limitou as consultas. Tente daqui a pouco.');
    if (!response.ok) throw new Error('O serviço está indisponível no momento.');
    return response;
  }
  if (site === 'lichess') {
    const response = await request('https://lichess.org/api/games/user/' + account + '?max=12&pgnInJson=true&perfType=ultraBullet,bullet,blitz,rapid,classical,correspondence', { Accept: 'application/x-ndjson' });
    const games = (await response.text()).split(/\r?\n/).filter(Boolean).map(row => JSON.parse(row));
    return games.filter(game => game.pgn).map(game => ({
      pgn: game.pgn, white: game.players.white.user?.name || 'Brancas',
      black: game.players.black.user?.name || 'Pretas', timestamp: game.createdAt,
    }));
  }
  const history = await (await request('https://api.chess.com/pub/player/' + account + '/games/archives')).json();
  const games = [];
  for (const archive of history.archives.slice(-3).reverse()) {
    const url = new URL(archive);
    if (url.origin !== 'https://api.chess.com') continue;
    const month = await (await request(url)).json();
    for (const game of month.games) {
      if (game.rules !== 'chess' || !game.pgn) continue;
      games.push({ pgn: game.pgn, white: game.white.username, black: game.black.username, timestamp: game.end_time * 1000 });
    }
    if (games.length >= 12) break;
  }
  return games.sort((a, b) => b.timestamp - a.timestamp).slice(0, 12);
}

async function importGameLink(text, signal) {
  const link = parseGameLink(text);
  if (!link) throw new Error('Cole um link público de partida do Chess.com ou do Lichess.');
  let pgn;
  if (link.platform === 'lichess') {
    const response = await fetch('https://lichess.org/game/export/' + link.id, {
      signal, headers: { Accept: 'application/x-chess-pgn' },
    });
    if (!response.ok) throw new Error('Não encontrei essa partida pública do Lichess.');
    pgn = await response.text();
  } else {
    const profile = readChessProfile();
    const player = $('link-account').value.trim() || (profile?.platform === 'chesscom' ? profile.username : '');
    const query = new URLSearchParams({ type: link.type, id: link.id });
    if (player) query.set('account', player);
    const response = await fetch('/api/import-pgn?' + query, { signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a partida.');
    pgn = result.pgn;
  }
  if (typeof pgn !== 'string' || !/^\s*\[/.test(pgn)) throw new Error('A partida não retornou um PGN válido.');
  if (!/\[Result\s+"(?:1-0|0-1|1\/2-1\/2)"\]/.test(pgn)) {
    throw new Error('Só dá para revisar pelo link depois que a partida termina.');
  }
  return { pgn, side: link.side };
}

async function submitImport(event) {
  event.preventDefault();
  if (!Chess) return;
  reportError();
  const text = $('game-input').value.trim();
  let pending;
  try {
    if (source === 'link' || (source === 'pgn' && parseGameLink(text))) {
      remoteRequest?.abort();
      pending = new AbortController();
      remoteRequest = pending;
      $('submit').disabled = true;
      $('submit-label').textContent = 'Buscando…';
      const game = await importGameLink(text, AbortSignal.any([pending.signal, AbortSignal.timeout(30000)]));
      if (remoteRequest === pending) { setGame(game, true); playSound('start'); }
      return;
    }
    if (source === 'pgn' || source === 'fen') {
      setGame({ [source]: text }, true);
      playSound('start');
      return;
    }
    remoteRequest?.abort();
    pending = new AbortController();
    remoteRequest = pending;
    $('submit').disabled = true;
    $('submit-label').textContent = 'Buscando…';
    const games = await fetchGames(source, text, AbortSignal.any([pending.signal, AbortSignal.timeout(15000)]));
    if (remoteRequest !== pending) return;
    $('remote-games').hidden = false;
    $('remote-games').replaceChildren(...games.map(game => {
      const button = element('button', game.white + ' × ' + game.black + ' · ' + new Date(game.timestamp).toLocaleDateString('pt-BR'), 'game-option');
      button.onclick = () => {
        try { setGame({ pgn: game.pgn }, true); playSound('start'); } catch { reportError('Esta partida não pôde ser importada.'); }
      };
      return button;
    }));
    if (!games.length) reportError('Nenhuma partida de xadrez padrão encontrada.');
  } catch (error) {
    if (pending && remoteRequest !== pending) return;
    if (source === 'link' || (source === 'pgn' && parseGameLink(text))) reportError(error.name === 'TimeoutError' ? 'A consulta demorou demais. Você também pode importar o PGN.' : error.message);
    else if (source === 'pgn') reportError(!text ? error.message : 'PGN inválido. Confira a notação e tente de novo.');
    else if (source === 'fen') reportError(!text ? error.message : 'FEN inválido. Confira os campos da posição.');
    else reportError(error instanceof TypeError || error.name === 'TimeoutError' ? 'A consulta falhou. Você também pode importar um PGN.' : error.message);
  } finally {
    if (pending && remoteRequest === pending) {
      remoteRequest = null;
      $('submit').disabled = false;
      $('submit-label').textContent = source === 'link' ? 'Abrir link' : source === 'pgn' ? 'Analisar partida' : 'Buscar partidas';
    }
  }
}

function exportPgn() {
  const chess = new Chess(root.fen);
  for (const [key, value] of Object.entries(gameHeaders)) {
    if (typeof value === 'string' && value !== '?' && !['FEN', 'SetUp'].includes(key)) chess.setHeader(key, value.replace(/["\r\n]/g, ' '));
  }
  if (originalPgn !== undefined) return originalPgn;
  const current = mainPath().slice(1);
  for (const node of current) chess.move(moveFromUci(uci(node.move)));
  if (current.at(-1)?.terminal?.type === 'mate') chess.setHeader('Result', current.at(-1).terminal.white > 0 ? '1-0' : '0-1');
  else if (current.at(-1)?.terminal?.type === 'cp') chess.setHeader('Result', '1/2-1/2');
  else {
    const main = mainPath();
    if (current.some((node, index) => node !== main[index + 1])) chess.setHeader('Result', '*');
  }
  return chess.pgn({ maxWidth: 85 });
}

async function copyText(text, confirmation) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const buffer = element('textarea');
      buffer.value = text;
      $('share').append(buffer);
      buffer.select();
      const copied = document.execCommand('copy');
      buffer.remove();
      if (!copied) throw new Error('clipboard denied');
    }
    toast(confirmation);
  } catch { toast('O navegador bloqueou o acesso à área de transferência.'); }
}

const archiveKey = 'livro-de-lances/arquivo/v1';
const cacheVersion = 1;

function studyFingerprint() {
  if (!studyId) {
    const { White, Black, Date, Site, Link } = gameHeaders;
    studyId = gameFingerprint(JSON.stringify([root.fen, mainPath().slice(1).map(node => uci(node.move)), White, Black, Date, Site, Link]));
  }
  return studyId;
}

function currentStudy() {
  const path = mainPath();
  const drills = {};
  for (const [index, node] of path.entries()) {
    const progress = puzzleProgress.get(node.id);
    if (!progress) continue;
    drills[index] = {
      lives: progress.lives, status: progress.status, hint: Boolean(progress.hint),
      attempts: progress.attempts || 0, answer: progress.result ? uci(progress.result.move) : null,
    };
  }
  return {
    name: displayName('w') + ' × ' + displayName('b'),
    date: Date.now(), data: snapshotGame(), analysis: studyAnalysis,
    side: reviewSide, drills, panel: tab === 'puzzles' ? 'puzzles' : 'report',
    puzzle: path.findIndex(node => node.id === activePuzzle?.node.id),
  };
}

async function persistStudy() {
  if (!root || !cursor) return;
  const entry = currentStudy();
  const id = await studyFingerprint();
  await putStudy({ ...entry, id });
}

function flushStudy() {
  if (!studyTimer) return;
  clearTimeout(studyTimer);
  studyTimer = null;
  return persistStudy().catch(() => {});
}

function scheduleStudy() {
  if (!studyAnalysis) return;
  clearTimeout(studyTimer);
  studyTimer = setTimeout(flushStudy, 200);
}

function validEngineResult(result) {
  return Array.isArray(result?.lines) && result.lines.length >= 1 && result.lines.length <= 3 &&
    (result.best === null || /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(result.best)) &&
    result.lines.every(line => line && ['cp', 'mate'].includes(line.type) &&
      Number.isFinite(line.value) && Number.isFinite(line.white) && Number.isFinite(line.depth) &&
      Array.isArray(line.pv) && line.pv.every(move => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)));
}

function restoreStudy(record, preservePly = false) {
  const path = mainPath();
  const saved = record?.analysis;
  if (saved?.version !== cacheVersion || !Array.isArray(saved.positions) ||
      saved.positions.length !== path.length || !saved.positions.every(validEngineResult)) return false;
  studyId = Promise.resolve(record.id);
  studyAnalysis = saved;
  for (const [index, node] of path.entries()) {
    const result = saved.positions[index];
    node.lines = result.lines;
    node.evaluation = result.lines[0];
    node.best = result.best;
    node.depth = node.evaluation.depth;
    if (index) gradeMove(node, path[index - 1].lines, path[index - 1].best, index);
    const progress = record.drills?.[index];
    if (progress && isTrainingMove(node)) puzzleProgress.set(node.id, createPuzzleState(node, progress));
  }
  if (!preservePly && Number.isInteger(record.data?.ply)) cursor = path[record.data.ply] ?? root;
  if (['all', 'w', 'b'].includes(record.side)) reviewSide = record.side;
  reviewMode = cursor === root ? 'summary' : 'guided';
  $('report-status').textContent = 'Revisão salva · profundidade ' + (Number(saved.depth) || '—');
  $('review-btn').textContent = 'Reanalisar';
  if (!preservePly && record.panel === 'puzzles' && path[record.puzzle]?.move && isTrainingMove(path[record.puzzle])) {
    startPuzzle(path[record.puzzle]);
    setTab('puzzles');
  } else {
    setTab('report');
  }
  return true;
}

async function openSavedReview(explicitPly) {
  const currentRoot = root;
  $('report-status').textContent = 'Buscando revisão salva…';
  const id = await studyFingerprint().catch(() => null);
  const record = id ? await getStudy(id).catch(() => null) : null;
  if (root !== currentRoot || review || studyAnalysis) return;
  if (!record || !restoreStudy(record, explicitPly)) runReview();
}

async function renderArchive() {
  const request = ++archiveRun;
  const target = $('archive-list');
  target.replaceChildren(element('p', 'Carregando arquivo…', 'muted'));
  const current = await listStudies().catch(() => []);
  if (request !== archiveRun) return;
  const archive = mergeStudies(current, []);
  const legacy = readLocal(archiveKey, []);
  const older = Array.isArray(legacy) ? legacy.filter(item => item?.data &&
    !archive.some(entry => entry.data?.pgn && entry.data.pgn === item.data.pgn || entry.data?.fen && entry.data.fen === item.data.fen)) : [];
  const games = [...archive, ...older];
  const count = (value, singular, plural) => value + ' ' + (value === 1 ? singular : plural);
  const drills = archive.flatMap(entry => Object.values(entry.drills || {}));
  const solved = drills.filter(item => item?.status === 'solved').length;
  const attempts = drills.reduce((total, item) => total + (Number.isInteger(item?.attempts) ? item.attempts : 0), 0);
  $('archive-stats').textContent = games.length
    ? [count(games.length, 'partida salva', 'partidas salvas'), count(solved, 'puzzle resolvido', 'puzzles resolvidos'),
      count(attempts, 'tentativa', 'tentativas')].join(' · ') : '';
  target.replaceChildren();
  if (!games.length) {
    target.append(element('p', 'As revisões concluídas aparecem aqui automaticamente.', 'muted'));
    return;
  }
  for (const game of games) {
    const button = element('button', undefined, 'game-option saved-game');
    button.type = 'button';
    button.append(element('span', game.name),
      element('small', game.analysis ? 'Abrir revisão salva' : 'Abrir partida', 'muted'));
    button.onclick = () => {
      try {
        setGame(game.data, false);
        if (validStudy(game) && restoreStudy(game)) {
          playSound('start');
        } else if (game.data.pgn) {
          setTab('report');
          openSavedReview(true);
        } else {
          setTab('lines');
        }
        $('archive').close();
      } catch { toast('Não foi possível abrir essa partida.'); }
    };
    target.append(button);
  }
}

async function syncStudies() {
  if (cloudBusy) return;
  const code = $('cloud-code').value.trim().toLowerCase();
  const status = $('cloud-status');
  if (!validCode(code)) {
    status.textContent = 'Crie ou cole um código de sincronização válido.';
    return;
  }
  cloudBusy = true;
  $('cloud-sync').disabled = true;
  status.textContent = 'Sincronizando revisões…';
  try {
    await flushStudy();
    const local = await listStudies();
    const cached = await syncArchive(code);
    if (!cached?.length && code !== generatedSyncCode && code !== readLocal(syncCodeKey, '')) {
      status.textContent = 'Este código ainda não tem um arquivo. Sincronize primeiro no dispositivo em que ele foi criado.';
      return;
    }
    const merged = mergeStudies(local, Array.isArray(cached) ? cached : []);
    const prepared = prepareSyncArchive(merged);
    const synced = await syncArchive(code, prepared.entries);
    const remote = mergeStudies([], Array.isArray(synced) ? synced : []);
    for (const entry of remote) await putStudy(entry);
    writeLocal(syncCodeKey, code);
    const remoteIds = new Set(remote.map(entry => entry.id));
    const localOnly = merged.filter(entry => !remoteIds.has(entry.id)).length;
    status.textContent = 'Arquivo sincronizado · ' + remote.length + (remote.length === 1 ? ' partida na nuvem.' : ' partidas na nuvem.') +
      (localOnly ? ' ' + localOnly + (localOnly === 1 ? ' revisão ficou' : ' revisões ficaram') + ' somente neste navegador.' : '');
    renderArchive();
  } catch (error) {
    status.textContent = error.message || 'Não foi possível sincronizar suas revisões.';
  } finally {
    cloudBusy = false;
    $('cloud-sync').disabled = false;
  }
}

function snapshotGame() {
  return root.children.length ? { pgn: exportPgn(), ply: mainPath().indexOf(pathTo(cursor).reverse().find(n => mainPath().includes(n)) || root) } : { fen: root.fen };
}

function boardSquareAtPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  const cell = target?.closest?.('[data-square]');
  return cell && $('board').contains(cell) ? cell.dataset.square : null;
}

function annotationColor(event) {
  if (event.altKey) return '#e6b84c';
  if (event.ctrlKey || event.metaKey) return '#45ad71';
  if (event.shiftKey) return '#5b9fe5';
  return '#e35a58';
}

function finishBoardMark(event) {
  const active = activeBoardMark;
  if (!active || active.pointerId !== event.pointerId) return;
  const destination = boardSquareAtPoint(event.clientX, event.clientY);
  activeBoardMark = null;
  try {
    if (destination) {
      const mark = destination === active.from
        ? { type: 'circle', from: active.from, to: null, color: active.color }
        : { type: 'arrow', from: active.from, to: destination, color: active.color };
      const duplicate = boardMarks.findIndex(item =>
        item.type === mark.type && item.from === mark.from && item.to === mark.to && item.color === mark.color);
      if (duplicate >= 0) boardMarks.splice(duplicate, 1);
      else {
        boardMarks.push(mark);
        if (boardMarks.length > 32) boardMarks.shift();
      }
    }
  } finally {
    try { $('board').releasePointerCapture(event.pointerId); } catch { /* Capture may already be released. */ }
    renderScore();
  }
}

function cancelBoardMark(event) {
  if (!activeBoardMark || activeBoardMark.pointerId !== event.pointerId) return;
  activeBoardMark = null;
  renderScore();
}

function bindEvents() {
  for (const key of REVIEW_CHART_MARKERS) { const item=element('span',undefined,'chart-key-item class-'+key); item.append(badge(key),document.createTextNode(CLASSIFICATIONS[key][1])); $('chart-key').append(item); }
  for (const [id, name] of Object.entries({ first: 'first', prev: 'prev', play: 'play', next: 'next', last: 'last', flip: 'flip', export: 'share', 'mate-icon': 'mate' })) {
    $(id).replaceChildren(icon(name));
  }

  document.addEventListener('pointerdown', () => unlockSound(setting('sound-enabled')), { passive: true });
  document.addEventListener('keydown', () => unlockSound(setting('sound-enabled')));
  document.addEventListener('fullscreenchange', syncBoardTools);
  $('fullscreen').onclick = toggleFullscreen;
  $('sound').onclick = () => {
    const control = $('sound-enabled');
    control.checked = !control.checked;
    unlockSound(control.checked);
    control.dispatchEvent(new Event('change'));
  };
  $('board').addEventListener('click', event => {
    if (event.button === 0 && boardMarks.length) {
      boardMarks = [];
      renderScore();
    }
    const square = event.target.closest('[data-square]')?.dataset.square;
    if (square) selectSquare(square);
  });
  $('board').addEventListener('contextmenu', event => event.preventDefault());
  $('board').addEventListener('pointerdown', event => {
    if (event.button !== 2 || event.pointerType === 'touch') return;
    const origin = boardSquareAtPoint(event.clientX, event.clientY);
    if (!origin) return;
    event.preventDefault();
    event.stopPropagation();
    selected = null;
    activeBoardMark = { pointerId: event.pointerId, from: origin, to: origin, color: annotationColor(event) };
    try { $('board').setPointerCapture(event.pointerId); } catch { /* Pointer capture is an enhancement. */ }
    renderPieces();
    renderScore();
  });
  $('board').addEventListener('pointermove', event => {
    if (!activeBoardMark || activeBoardMark.pointerId !== event.pointerId) return;
    const destination = boardSquareAtPoint(event.clientX, event.clientY);
    if (destination && destination !== activeBoardMark.to) {
      activeBoardMark.to = destination;
      renderScore();
    }
  });
  $('board').addEventListener('pointerup', event => finishBoardMark(event));
  $('board').addEventListener('pointercancel', event => cancelBoardMark(event));
  $('board').addEventListener('lostpointercapture', event => cancelBoardMark(event));
  $('board').addEventListener('dragover', event => event.preventDefault());
  $('board').addEventListener('drop', event => {
    event.preventDefault();
    const square = event.target.closest('[data-square]')?.dataset.square;
    if (square) tryMove(event.dataTransfer.getData('text/plain'), square);
    selected = null;
    renderPieces();
    renderScore();
  });
  $('board').addEventListener('dragend', () => {
    selected = null;
    renderPieces();
    renderScore();
  });
  $('board').addEventListener('keydown', event => {
    const square = event.target.dataset.square;
    const delta = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!square || delta === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const squares = Array.from($('board').children);
    const origin = squares.indexOf(event.target);
    if ((delta === -1 && origin % 8 === 0) || (delta === 1 && origin % 8 === 7)) return;
    const destination = squares[origin + delta];
    if (destination) {
      event.target.tabIndex = -1;
      destination.tabIndex = 0;
      destination.focus({ preventScroll: true });
    }
  });
  $('move-list').addEventListener('click', event => {
    const button = event.target.closest('[data-ply]');
    if (button) selectReviewMove(positions.get(Number(button.dataset.ply)));
  });
  $('chart').addEventListener('click', event => {
    const { width, left } = $('chart').getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - left - CHART_INSET) / (width - 2 * CHART_INSET)));
    const nodes = mainPath();
    selectReviewMove(nodes[Math.round(fraction * (nodes.length - 1))]);
  });
  $('chart-markers').addEventListener('click', event => {
    const button = event.target.closest('[data-chart-ply]');
    if (!button) return;
    // When nearby points overlap, use the closest point to the pointer.
    // Keyboard activation still goes directly to the focused marker.
    let selected = button;
    if (event.detail) {
      const chart = $('chart').getBoundingClientRect();
      const x = event.clientX - chart.left;
      const y = event.clientY - chart.top;
      let nearest = Infinity;
      for (const candidate of $('chart-markers').children) {
        const dx = parseFloat(candidate.style.left) - x;
        const dy = parseFloat(candidate.style.top) - y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) continue;
        const distance = dx * dx + dy * dy;
        if (distance < nearest) {
          selected = candidate;
          nearest = distance;
        }
      }
    }
    const id = Number(selected.dataset.chartPly);
    selectReviewMove(positions.get(id));
    $('chart-markers').querySelector('[data-chart-ply="' + id + '"]')?.focus({ preventScroll: true });
  });
  $('first').onclick = () => goTo(root);
  $('prev').onclick = () => goTo(cursor.parent);
  $('next').onclick = () => goTo(preferred.get(cursor) || cursor.children[0]);
  $('last').onclick = () => goTo(linePath(cursor).at(-1));
  $('play').onclick = togglePlayback;
  $('flip').onclick = () => { flipped = !flipped; render(); };
  $('settings-btn').onclick = () => $('settings').showModal();
  $('nav-today').onclick = () => setTab('import');
  $('nav-puzzles').onclick = () => setTab('puzzles');
  $('nav-library').onclick = () => { renderArchive(); $('archive').showModal(); };
  $('export').onclick = () => $('share').showModal();
  $('review-btn').onclick = () => {
    if (review) { stopReview(); renderReport(); }
    else runReview();
  };
  $('review-start').onclick = startGuidedReview;
  $('review-side').onchange = () => { reviewSide = $('review-side').value; renderReport(); scheduleStudy(); };
  $('review-overview-link').onclick = () => {
    stopPlayback();
    stopDemo();
    reviewMode = 'summary';
    render();
    $('review-summary').scrollTop = 0;
    $('review-heading').focus({ preventScroll: true });
  };
  $('practice-from-report').onclick = () => {
    const candidates = mainPath().filter(isTrainingMove);
    const next = candidates.find(node => (puzzleProgress.get(node.id)?.status ?? 'active') === 'active');
    if (next) startPuzzle(next);
    setTab('puzzles');
  };
  $('engine-toggle').onclick = () => {
    engineOn = !engineOn;
    $('engine-toggle').textContent = engineOn ? 'Pausar' : 'Retomar';
    $('engine-toggle').setAttribute('aria-pressed', String(engineOn));
    queueLive();
    renderLines();
  };
  $('import-form').onsubmit = submitImport;
  $('free-board').onclick = () => setTab('lines');
  $('example').onclick = () => {
    $('game-input').value = source === 'pgn' ? EXAMPLE : 'r3k2r/pppq1ppp/2n5/3p4/3P4/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1';
    $('import-form').requestSubmit();
  };
  $('file-btn').onclick = () => $('pgn-file').click();
  $('pgn-file').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Use um arquivo PGN menor que 1 MB.');
      $('game-input').value = await file.text();
      $('import-form').requestSubmit();
    } catch (error) { reportError(error.message); }
    finally { event.target.value = ''; }
  };
  $('promotion').addEventListener('close', () => { pendingPromotion = null; });
  for (const name of TABS) $('tab-' + name).onclick = () => setTab(name);
  document.querySelector('.tabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.indexOf(tab);
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[target]);
    $('tab-' + TABS[target]).focus();
  });
  for (const button of document.querySelectorAll('[data-source]')) button.onclick = () => setSource(button.dataset.source);
  const savedPrefs = readLocal('livro-de-lances/preferencias/v1', {});
  let migratedPrefs = false;
  if (savedPrefs['piece-set'] === 'atelier') {
    savedPrefs['piece-set'] = 'classicas';
    migratedPrefs = true;
  }
  // The former full setting was the default, so migrate old saved defaults to Lite.
  if (savedPrefs['engine-mode'] === 'full') {
    savedPrefs['engine-mode'] = 'lite';
    migratedPrefs = true;
  }
  if (migratedPrefs) {
    try { writeLocal('livro-de-lances/preferencias/v1', savedPrefs); } catch { /* Private mode. */ }
  }
  for (const id of PREFS) {
    const control = $(id);
    const value = savedPrefs[id];
    if (control.type === 'checkbox' && typeof value === 'boolean') control.checked = value;
    if (control.tagName === 'SELECT' && Array.from(control.options).some(option => option.value === String(value))) control.value = value;
    if (control.type === 'range' && Number.isFinite(Number(value))) control.value = String(Math.max(Number(control.min), Math.min(Number(control.max), Number(value))));
    control.onchange = () => {
      try { writeLocal('livro-de-lances/preferencias/v1', Object.fromEntries(PREFS.map(key => [key, setting(key)]))); } catch { /* Private mode. */ }
      if (id === 'sound-volume') {
        $('sound-volume-value').textContent = control.value + '%';
        setBoardVolume(setting('sound-enabled') ? setting('sound-volume') / 100 : 0);
      }
      if (id === 'sound-enabled') {
        unlockSound(setting('sound-enabled'));
        setBoardVolume(setting('sound-enabled') ? setting('sound-volume') / 100 : 0);
        syncBoardTools();
      }
      if (id === 'engine-mode') {
        stopReview();
        stopLive();
        sharedEngine?.dispose();
        sharedEngine = null;
        engineProfile = null;
        syncEngine('idle', setting(id) === 'full' ? 'Modo completo' : 'Modo leve');
        if (tab === 'lines') queueLive();
      }
        if (id === 'mate-enabled' && !control.checked) hideMate();
      render();
      if (tab === 'lines' && (id === 'multi-pv' || id === 'line-depth')) queueLive();
    };
  }
  $('sound-volume-value').textContent = setting('sound-volume') + '%';
  $('sound-volume').oninput = () => {
    $('sound-volume-value').textContent = $('sound-volume').value + '%';
    setBoardVolume(setting('sound-enabled') ? Number($('sound-volume').value) / 100 : 0);
  };
  syncBoardTools();
  $('copy-fen').onclick = () => copyText(cursor.fen, 'FEN copiado.');
  $('copy-pgn').onclick = () => copyText(exportPgn(), 'PGN copiado.');
  $('copy-link').onclick = () => {
    const url = new URL(location.href);
    url.hash = new URLSearchParams(snapshotGame()).toString();
    if (url.href.length > 20000) { toast('Esta partida é longa para um link. Exporte o PGN.'); return; }
    copyText(url.href, 'Link da partida copiado.');
  };
  $('download-pgn').onclick = () => {
    const address = URL.createObjectURL(new Blob([exportPgn()], { type: 'application/x-chess-pgn' }));
    const link = element('a');
    link.href = address;
    link.download = 'partida.pgn';
    link.click();
    setTimeout(() => URL.revokeObjectURL(address), 1000);
  };
  $('save-game').onclick = async () => {
    try {
      await persistStudy();
      $('share').close();
      toast('Partida salva no arquivo.');
    } catch { toast('Não foi possível salvar a partida neste navegador.'); }
  };
  $('cloud-code').value = readLocal(syncCodeKey, '');
  $('cloud-new').onclick = () => {
    generatedSyncCode = newSyncCode();
    $('cloud-code').value = generatedSyncCode;
    $('cloud-status').textContent = 'Código criado. Copie e guarde em segredo.';
  };
  $('cloud-copy').onclick = () => {
    const code = $('cloud-code').value.trim().toLowerCase();
    if (validCode(code)) copyText(code, 'Código copiado. Guarde-o em segredo.');
    else $('cloud-status').textContent = 'Crie ou cole um código de sincronização válido.';
  };
  $('cloud-sync').onclick = syncStudies;
  addEventListener('pagehide', flushStudy);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && fullscreenFallback) { fallbackFullscreen(false); return; }
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, select, textarea, dialog, [role=tab]')) return;
    if (event.key === 'g' || event.key === 'G') { event.preventDefault(); toggleFullscreen(); return; }
    if (tab === 'puzzles') return;
    const action = {
      ArrowLeft: () => goTo(cursor.parent), ArrowRight: () => goTo(preferred.get(cursor) || cursor.children[0]),
      Home: () => goTo(root), End: () => goTo(linePath(cursor).at(-1)),
      f: () => $('flip').click(),
      ' ': event.target.closest?.('button, a') ? null : togglePlayback,
    }[event.key];
    if (action) { event.preventDefault(); action(); }
  });
  new ResizeObserver(() => {
    if (cursor) { renderScore(); renderChart(); }
  }).observe(document.querySelector('.workspace'));
}

function restoreFromLink() {
  const params = new URLSearchParams(location.hash.slice(1));
  const pgn = params.get('pgn');
  const fen = params.get('fen');
  if (!pgn && !fen) return;
  try { setGame(pgn ? { pgn, ply: params.get('ply') } : { fen }, true); }
  catch { toast('O link contém uma partida ou posição inválida.'); }
}

try {
  for (const placeholder of document.querySelectorAll('[data-icon]')) placeholder.replaceWith(icon(placeholder.dataset.icon));
  $('submit').disabled = true;
  $('free-board').disabled = true;
  Chess = await loadChess();
  bindEvents();
  setGame();
  $('submit').disabled = false;
  $('free-board').disabled = false;
  restoreFromLink();
  addEventListener('hashchange', restoreFromLink);
} catch (error) {
  reportError(error.message);
  syncEngine('error', 'Indisponível');
}
