import { Engine } from './engine.js';
import { acceptedMove, inspectMove, isTrainingMove } from './coach.js';
import { icon, unlockSound, boardSound, setBoardVolume, mateCelebration } from './board-ui.js';

const $ = id => document.getElementById(id);
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
  brilliant: ['!!', 'Brilhante'], critical: ['!', 'Crítico'], best: ['★', 'Melhor lance'],
  excellent: ['✓', 'Excelente'], good: ['○', 'Bom lance'], inaccuracy: ['?!', 'Imprecisão'],
  mistake: ['?', 'Erro'], blunder: ['??', 'Erro grave'], theory: ['▤', 'Teoria'],
};
const BOOK = new Set(['e2e4', 'd2d4', 'c2c4', 'g1f3']);
const BOOK_REPLY = {
  e2e4: ['e7e5', 'c7c5', 'e7e6', 'c7c6', 'd7d6', 'd7d5', 'g8f6', 'g7g6', 'b8c6'],
  d2d4: ['d7d5', 'g8f6', 'e7e6', 'f7f5', 'c7c5', 'd7d6'],
  c2c4: ['e7e5', 'g8f6', 'c7c5', 'e7e6', 'c7c6', 'g7g6'],
  g1f3: ['d7d5', 'g8f6', 'c7c5', 'g7g6', 'e7e6', 'b7b6'],
};
const PREFS = ['review-depth', 'line-depth', 'multi-pv', 'show-arrow', 'show-coordinates', 'engine-mode', 'piece-set', 'sound-enabled', 'sound-volume', 'animation-speed', 'mate-enabled'];
const MOVE_DOT_CLASSES = new Set(['brilliant', 'critical', 'inaccuracy', 'mistake', 'blunder', 'theory']);
const TABS = ['import', 'report', 'lines', 'puzzles'];

let Chess;
let root;
let cursor;
let gameHeaders = {};
let turnCounter = 0;
let selected;
let flipped = false;
let tab = 'import';
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
const chartColors = {
  brilliant: '#63d5cc', critical: '#8cb9e0', best: '#a6d579', excellent: '#86c8a0',
  good: '#b4c899', inaccuracy: '#edce69', mistake: '#f3a464', blunder: '#ef7d78',
};
let chartMarkers = [];
let boardAnimations = new Set();
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
  const nodes = [root];
  while (nodes.at(-1).children[0]) nodes.push(nodes.at(-1).children[0]);
  return nodes;
}

function linePath(node) {
  const path = [root, ...pathTo(node)];
  while (path.at(-1).children[0]) path.push(path.at(-1).children[0]);
  return path;
}

function boardAt(node) {
  const board = new Chess(root.fen);
  for (const item of pathTo(node)) board.move(moveFromUci(uci(item.move)));
  return board;
}

function addChild(parent, board, move) {
  const existing = parent.children.find(child => uci(child.move) === uci(move));
  if (existing) return existing;
  const node = createPosition(board, parent, move);
  parent.children.push(node);
  positions.set(node.id, node);
  return node;
}

function setGame({ pgn, fen, ply } = {}, shouldReview = false) {
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
  let nextRoot = createPosition(position);
  const newPositions = [nextRoot];
  for (const incoming of moves) {
    const move = position.move(moveFromUci(uci(incoming)));
    const parent = newPositions.at(-1);
    const child = createPosition(position, parent, move);
    parent.children.push(child);
    newPositions.push(child);
  }
  stopReview();
  stopLive();
  stopPlayback();
  cancelBoardAnimations();
  hideMate();
  activePuzzle = null;
  puzzleProgress.clear();
  positions.clear();
  boardMarks = [];
  activeBoardMark = null;
  for (const child of newPositions) positions.set(child.id, child);
  root = nextRoot;
  cursor = newPositions[Math.min(Math.max(Number(ply) || 0, 0), newPositions.length - 1)];
  gameHeaders = loader.getHeaders();
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
    runReview();
  } else if (shouldReview) {
    setTab('lines');
  }
}

function activeChallenge() {
  return tab === 'puzzles' ? activePuzzle : null;
}

function shownPosition() {
  const puzzle = activeChallenge();
  if (!puzzle) return cursor;
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
      playSound('select');
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
      const rating = !puzzle && piece && position.move?.to === square && MOVE_DOT_CLASSES.has(position.classification) ? CLASSIFICATIONS[position.classification]?.[1] : null;
      const ariaName = piece ? square + ', ' + NAMES[piece.type] + (piece.color === 'w' ? ' das brancas' : ' das pretas') : square;
      button.setAttribute('aria-label', ariaName + (rating ? ' · ' + rating : ''));
      if (rating) button.title = rating;
      button.tabIndex = square === (focused || selected || files[0] + ranks[0]) ? 0 : -1;
      if (piece) {
        button.append(...pieceGraphic(piece, square, piece.color === board.turn() && !position.terminal && (!puzzle || puzzle.status === 'active')));
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

function winPercent(score) {
  if (!score) return 50;
  if (score.type === 'mate') return score.white > 0 ? 100 : 0;
  return 100 / (1 + Math.exp(-.00368208 * Math.max(-1300, Math.min(1300, score.white))));
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
    const evaluation = cursor.evaluation;
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
  renderBestArrow(context, cursor.lines[0]?.pv[0], width, height);
  renderBoardMarks(context, width, height);
}
function selectSquare(square) {
  const puzzle = activeChallenge();
  const position = shownPosition();
  if (position.terminal || (tab === 'puzzles' && (puzzle?.status !== 'active' || puzzle.reviewIndex !== puzzle.decisionIndex))) return;
  const board = new Chess(position.fen);
  const piece = board.get(square);
  if (selected && selected !== square && tryMove(selected, square)) return;
  if (puzzle) puzzle.wrongSquare = null;
  selected = selected !== square && piece?.color === board.turn() ? square : null;
  if (selected) playSound('select');
  renderPieces();
  renderScore();
}

function tryMove(from, to) {
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
  parent.userEdited = true;
  if (review) stopReview(false);
  if (tab === 'import') setTab('lines');
  goTo(parent);
  if (tab === 'report') queueLive();
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
  if (MOVE_DOT_CLASSES.has(node.classification)) {
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
  $('ply-count').textContent = (main.length - 1) + (main.length === 2 ? ' lance' : ' lances');
  if (main.length === 1) {
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

function renderChart() {
  chartMarkers = [];
  const surface = canvasContext($('chart'));
  if (!surface) return;
  const { context, width, height } = surface;
  const nodes = mainPath();
  const x = index => 5 + (width - 10) * index / Math.max(1, nodes.length - 1);
  const y = evaluation => 5 + (height - 10) * (1 - winPercent(evaluation) / 100);
  context.strokeStyle = '#637466';
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
  context.setLineDash([]);
  const evaluated = nodes.flatMap((node, index) => node.evaluation ? [[x(index), y(node.evaluation)]] : []);
  if (evaluated.length) {
    context.beginPath();
    evaluated.forEach(([px, py], index) => index ? context.lineTo(px, py) : context.moveTo(px, py));
    context.lineTo(evaluated.at(-1)[0], height - 2);
    context.lineTo(evaluated[0][0], height - 2);
    context.closePath();
    context.fillStyle = '#424f38';
    context.fill();
    context.beginPath();
    evaluated.forEach(([px, py], index) => index ? context.lineTo(px, py) : context.moveTo(px, py));
    context.strokeStyle = '#bad69b';
    context.lineWidth = 2.2;
    context.stroke();
  }

  const markerRadius = Math.min(7.5, Math.max(5.2, (width - 10) / Math.max(1, nodes.length - 1) * .48));
  for (const [index, node] of nodes.entries()) {
    const color = chartColors[node.classification];
    if (!node.evaluation || !color || index === 0) continue;
    const marker = { node, index, x: x(index), y: y(node.evaluation), color };
    chartMarkers.push(marker);
    context.beginPath();
    context.arc(marker.x, marker.y, markerRadius + 1.8, 0, Math.PI * 2);
    context.fillStyle = '#1c211bdd';
    context.fill();
    context.beginPath();
    context.arc(marker.x, marker.y, markerRadius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    context.lineWidth = 1.7;
    context.strokeStyle = '#f3f5e7';
    context.stroke();
    context.beginPath();
    context.arc(marker.x, marker.y, Math.max(1.3, markerRadius * .3), 0, Math.PI * 2);
    context.fillStyle = '#f4f5e9';
    context.fill();
  }

  const index = nodes.indexOf(cursor);
  if (index >= 0 && cursor.evaluation) {
    context.strokeStyle = '#ffd382';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x(index), 1);
    context.lineTo(x(index), height - 1);
    context.stroke();
    context.beginPath();
    context.arc(x(index), y(cursor.evaluation), 4.5, 0, Math.PI * 2);
    context.fillStyle = '#ffd382';
    context.fill();
    context.strokeStyle = '#343b2d';
    context.lineWidth = 1.2;
    context.stroke();
  }
}

function chartMarkerAt(event) {
  const rect = $('chart').getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;
  let closest = null;
  let distance = 19;
  for (const marker of chartMarkers) {
    const candidate = Math.hypot(marker.x - px, marker.y - py);
    if (candidate <= distance) {
      closest = marker;
      distance = candidate;
    }
  }
  return closest;
}

function updateChartTooltip(event) {
  const marker = chartMarkerAt(event);
  const canvas = $('chart');
  const tooltip = $('chart-tooltip');
  canvas.style.cursor = marker ? 'pointer' : 'crosshair';
  if (!marker) {
    tooltip.hidden = true;
    return;
  }
  const node = marker.node;
  const label = CLASSIFICATIONS[node.classification]?.[1] ?? 'Lance analisado';
  tooltip.textContent = displayName(node.move.color) + ' · ' + moveNumber(node) + node.move.san + ' · ' + label;
  tooltip.hidden = false;
  const chartRect = canvas.getBoundingClientRect();
  const wrapRect = $('chart-wrap').getBoundingClientRect();
  const left = chartRect.left - wrapRect.left + marker.x;
  const top = chartRect.top - wrapRect.top + marker.y;
  const maxLeft = Math.max(8, wrapRect.width - tooltip.offsetWidth - 8);
  tooltip.style.left = Math.max(8, Math.min(maxLeft, left - tooltip.offsetWidth / 2)) + 'px';
  tooltip.style.top = Math.max(7, top - tooltip.offsetHeight - 9) + 'px';
}

function renderMoments(path) {
  const target = $('key-moments');
  const moments = path.slice(1).filter(node => node.evaluation && chartColors[node.classification]);
  $('moment-count').textContent = moments.length + (moments.length === 1 ? ' lance' : ' lances');
  if (!moments.length) {
    target.replaceChildren(element('p', 'Os momentos importantes aparecerão aqui depois que a revisão da partida for concluída.', 'muted moments-empty'));
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
    row.append(details, icon('next'));
    row.title = 'Ir para ' + moveNumber(node) + node.move.san;
    row.onclick = () => goTo(node);
    fragment.append(row);
  }
  target.replaceChildren(fragment);
}

function estimatePlayerPerformance(path, side) {
  const records = [];
  const playerMoves = path.slice(1).filter(node => node.move?.color === side && node.evaluation && node.parent?.evaluation);
  for (const node of playerMoves) {
    const before = node.coach?.before ?? node.parent.evaluation;
    const after = node.evaluation;
    const sign = side === 'w' ? 1 : -1;
    const loss = Math.max(0, sign * (winPercent(before) - winPercent(after)));
    const quality = Math.exp(-loss / 11);
    let legalCount = 20;
    try { legalCount = new Chess(node.parent.fen).moves().length; } catch { /* Neutral complexity. */ }
    const candidates = node.parent.lines ?? [];
    const gap = candidates.length > 1 ? Math.abs(winPercent(candidates[0]) - winPercent(candidates[1])) : 0;
    const difficulty = Math.max(.55, Math.min(1, .55 + .25 * Math.min(1, legalCount / 40) + .2 * Math.min(1, gap / 30)));
    records.push({ node, loss, quality, difficulty, weight: .85 + difficulty * .3 });
  }
  if (records.length < 5) return { moves: records.length, rating: null, low: null, high: null, depth: 0 };
  const weightTotal = records.reduce((sum, item) => sum + item.weight, 0);
  const weightedQuality = records.reduce((sum, item) => sum + item.quality * item.weight, 0) / weightTotal;
  const meanLoss = records.reduce((sum, item) => sum + item.loss, 0) / records.length;
  const deviation = Math.sqrt(records.reduce((sum, item) => sum + (item.loss - meanLoss) ** 2, 0) / records.length);
  const consistency = 1 / (1 + deviation / 18);
  const errors = records.reduce((counts, item) => {
    counts[item.node.classification] = (counts[item.node.classification] || 0) + 1;
    return counts;
  }, {});
  const tacticalQuality = Math.max(.2, Math.min(1,
    1 - ((errors.blunder || 0) + (errors.mistake || 0) * .7 + (errors.inaccuracy || 0) * .3) / records.length
  ));
  const hardest = [...records].sort((a, b) => b.difficulty - a.difficulty).slice(0, Math.max(3, Math.ceil(records.length / 2)));
  const complexPositionQuality = hardest.reduce((sum, item) => sum + item.quality, 0) / hardest.length;
  const performance = Math.max(.12, Math.min(1,
    weightedQuality * .63 + consistency * .14 + tacticalQuality * .15 + complexPositionQuality * .08
  ));
  // A single game is weak evidence, so use a conservative curve and cap the point estimate.
  const rating = Math.max(700, Math.min(2200, Math.round((700 + 1500 * performance ** 3.2) / 50) * 50));
  const depth = Math.round(records.reduce((sum, item) => sum + (item.node.depth || 0), 0) / records.length);
  const uncertainty = Math.max(180, Math.min(380, Math.round((390 - records.length * 4 - depth * 3) / 50) * 50));
  return { moves: records.length, rating, low: Math.max(600, rating - uncertainty), high: Math.min(2400, rating + uncertainty), depth };
}

function renderRatingEstimates(path) {
  const target = $('rating-estimates');
  target.replaceChildren();
  for (const side of ['w', 'b']) {
    const estimate = estimatePlayerPerformance(path, side);
    const card = element('div', undefined, 'rating-estimate');
    card.append(element('span', displayName(side), 'rating-player'));
    if (estimate.rating === null) {
      card.append(element('strong', '—'));
      card.append(element('small', estimate.moves + ' lances analisados; são necessários pelo menos 5.', 'muted'));
    } else {
      const number = value => new Intl.NumberFormat('pt-BR').format(value);
      card.append(element('strong', '≈ ' + number(estimate.rating)));
      card.append(element('small', 'Faixa indicativa: ' + number(estimate.low) + '–' + number(estimate.high) + ' · ' + estimate.moves + ' lances', 'muted'));
    }
    target.append(card);
  }
}

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
  const target = $('variant-analysis');
  target.replaceChildren();
  target.hidden = !node?.userEdited;
  if (!node?.userEdited) return;
  target.append(element('h4', 'Análise da variante editada'));
  if (!node.evaluation) {
    target.append(element('p', 'Aguardando a avaliação do Stockfish para esta nova posição…', 'muted'));
    return;
  }
  const percentage = winPercent(node.evaluation);
  const advantage = percentage > 55
    ? 'Vantagem das brancas · ' + Math.round(percentage) + '%'
    : percentage < 45
      ? 'Vantagem das pretas · ' + Math.round(100 - percentage) + '%'
      : 'Posição equilibrada · ' + Math.round(Math.max(percentage, 100 - percentage)) + '%';
  const summary = element('div', undefined, 'variant-summary');
  summary.append(element('strong', evaluationLabel(node.evaluation), 'variant-score'), element('span', advantage));
  target.append(summary, element('p', 'Stockfish 19 · profundidade ' + (node.depth || '…'), 'muted'));
  if (node.lines?.[0]?.pv?.length) appendCoachLine(target, 'Melhor linha', variationText(node.fen, node.lines[0].pv));
  else target.append(element('p', 'O motor ainda não encontrou uma continuação completa.', 'muted'));
}

function renderReport() {
  renderChart();
  if (!root) return;
  const path = mainPath();
  const scores = { w: [], b: [] };
  const counts = { w: {}, b: {} };
  for (const node of path.slice(1)) {
    if (!node.classification) continue;
    const side = node.move.color;
    counts[side][node.classification] = (counts[side][node.classification] || 0) + 1;
    scores[side].push(node.accuracy);
  }
  const average = side => scores[side].length
    ? (scores[side].reduce((sum, score) => sum + score, 0) / scores[side].length).toFixed(1).replace('.', ',') + '%'
    : '—';
  $('white-accuracy-label').textContent = displayName('w');
  $('black-accuracy-label').textContent = displayName('b');
  $('white-acc').textContent = average('w');
  $('black-acc').textContent = average('b');
  renderRatingEstimates(path);
  renderVariantEvaluation(cursor);
  $('chart-end').textContent = path.length === 1 ? 'Fim' : (path.length - 1) + ' lances';
  renderMoments(path);
  $('review-btn').disabled = path.length === 1 && !review;
  renderCoach(cursor);
  const count = path.filter(isTrainingMove).length;
  $('practice-from-report').hidden = !count;
  $('practice-from-report').textContent = count === 1 ? 'Treinar no puzzle' : 'Treinar em ' + count + ' puzzles';
  const rows = Object.entries(CLASSIFICATIONS).map(([key, [, label]]) => {
    const row = element('tr');
    const kind = element('td');
    kind.append(badge(key), document.createTextNode(label));
    row.append(kind, element('td', counts.w[key] ?? 0), element('td', counts.b[key] ?? 0));
    return row;
  });
  $('class-table').tBodies[0].replaceChildren(...rows);
}

function renderCoach(node) {
  const detail = $('move-detail');
  detail.className = 'move-detail' + (node.classification ? ' class-' + node.classification : '');
  detail.hidden = !node.classification || !node.coach?.best;
  detail.replaceChildren();
  if (detail.hidden) return;
  const guide = inspectMove(Chess, node);
  const head = element('div', undefined, 'move-detail-head');
  head.append(badge(node.classification), element('h4', moveNumber(node) + ' ' + node.move.san + ' · ' + CLASSIFICATIONS[node.classification][1]));
  const flow = element('div', undefined, 'analysis-flow');
  flow.append(element('span', 'Antes ' + evaluationLabel(guide.before)), element('span', 'Depois ' + evaluationLabel(guide.after)));
  detail.append(head, flow, element('p', guide.reason, 'coach-reason'));
  if (guide.proposal && guide.played !== guide.proposal) {
    appendCoachLine(detail, 'Na partida', guide.chosen);
    appendCoachLine(detail, 'Melhor linha', guide.recommended);
    const actions = element('div', undefined, 'coach-actions');
    const inspect = element('button', 'Ver ' + guide.proposal + ' no tabuleiro', 'mini');
    inspect.onclick = () => { goTo(node.parent); setTab('lines'); commitMoves([node.coach.best]); };
    actions.append(inspect);
    if (isTrainingMove(node)) {
      const train = element('button', 'Tentar como puzzle', 'mini');
      train.onclick = () => { startPuzzle(node); setTab('puzzles'); };
      actions.append(train);
    }
    detail.append(actions);
  }
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

function startPuzzle(node) {
  if (!isTrainingMove(node)) return;
  if (!puzzleProgress.has(node.id)) {
    const reviewPath = [root, ...pathTo(node.parent)];
    const decisionIndex = reviewPath.length - 1;
    puzzleProgress.set(node.id, {
      node: { ...node }, lives: 3, status: 'active', wrongSquare: null, lastAttempt: null,
      result: null, reviewPath, reviewIndex: decisionIndex, decisionIndex,
    });
  }
  activePuzzle = puzzleProgress.get(node.id);
  if (!activePuzzle.reviewPath) {
    activePuzzle.reviewPath = [root, ...pathTo(activePuzzle.node.parent)];
    activePuzzle.decisionIndex = activePuzzle.reviewPath.length - 1;
    activePuzzle.reviewIndex = activePuzzle.decisionIndex;
  }
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
  try { move = board.move(moveFromUci(command)); } catch { return; }
  playSound(move.captured ? 'capture' : 'move');
  selected = null;
  puzzle.wrongSquare = null;
  if (command !== uci(puzzle.node.move) && acceptedMove(puzzle.node.coach, command)) {
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
    } else {
      const guide = inspectMove(Chess, puzzle.node);
      card.append(element('h4', puzzle.status === 'solved' ? 'Puzzle resolvido' : 'Você ficou sem vidas', puzzle.status === 'solved' ? 'puzzle-done' : 'puzzle-failed'));
      card.append(element('p', puzzle.status === 'solved' ? 'Você jogou ' + puzzle.result.move.san + '.' : 'O melhor lance era ' + guide.proposal + '.', 'coach-reason'));
      card.append(element('p', guide.reason, 'coach-reason'));
      appendCoachLine(card, 'Melhor continuação', guide.recommended);
      const next = training.find(node => node.id !== puzzle.node.id && (puzzleProgress.get(node.id)?.status ?? 'active') === 'active');
      if (next) {
        const actions = element('div', undefined, 'coach-actions');
        const nextButton = element('button', 'Próximo puzzle', 'mini');
        nextButton.onclick = () => { startPuzzle(next); render(); };
        actions.append(nextButton);
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
  $('game-history').hidden = training;
  $('export').hidden = training;
  const feedback = $('board-feedback');
  const rating = puzzle || training ? null : CLASSIFICATIONS[cursor.classification];
  feedback.hidden = !puzzle && !rating;
  if (puzzle) {
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
  if (!training) renderHistory();
  if (tab === 'report') renderReport();
  if (tab === 'lines') renderLines();
  if (training) renderPuzzles();
}

function setTab(name) {
  if (name === 'puzzles') { stopPlayback(); hideMate(); }
  if (tab !== name) selected = null;
  tab = name;
  $('inspector-scroll').scrollTop = 0;
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
  if (name === 'lines') queueLive();
}

function cancelBoardAnimations() {
  for (const animation of boardAnimations) {
    try { animation.cancel(); } catch { /* Animação já finalizada. */ }
  }
  boardAnimations.clear();
  $('board').querySelectorAll('.square.moving').forEach(square => square.classList.remove('moving'));
  document.querySelectorAll('.capture-ghost').forEach(ghost => ghost.remove());
}

function captureSquare(step) {
  return step.flags?.includes('e') ? step.to[0] + step.from[1] : step.to;
}

function snapshotCapturedPiece(step) {
  if (!step.captured) return null;
  const cell = $('board').querySelector('[data-square="' + captureSquare(step) + '"]');
  const graphic = cell?.querySelector('.piece-art:not([hidden]), .fallback:not([hidden])');
  if (!graphic) return null;
  const rect = graphic.getBoundingClientRect();
  const ghost = graphic.cloneNode(true);
  ghost.classList.add('capture-ghost');
  Object.assign(ghost.style, {
    position: 'fixed', left: rect.left + 'px', top: rect.top + 'px',
    width: rect.width + 'px', height: rect.height + 'px',
    margin: '0', zIndex: '30', pointerEvents: 'none',
  });
  return ghost;
}

function trackBoardAnimation(animation, cleanup = () => {}) {
  boardAnimations.add(animation);
  const finish = () => {
    boardAnimations.delete(animation);
    cleanup();
  };
  animation.addEventListener('finish', finish, { once: true });
  animation.addEventListener('cancel', finish, { once: true });
}

function animatePiece(from, to, duration, easing) {
  const board = $('board');
  const origin = board.querySelector('[data-square="' + from + '"]');
  const destination = board.querySelector('[data-square="' + to + '"]');
  const piece = destination?.querySelector('.piece-art:not([hidden]), .fallback:not([hidden])');
  if (!origin || !destination || !piece || typeof piece.animate !== 'function') return;
  const start = origin.getBoundingClientRect();
  const end = destination.getBoundingClientRect();
  const dx = start.left - end.left;
  const dy = start.top - end.top;
  destination.classList.add('moving');
  const animation = piece.animate([
    { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.96)' },
    { transform: 'translate(0,0) scale(1)' },
  ], { duration, easing, fill: 'both' });
  trackBoardAnimation(animation, () => destination.classList.remove('moving'));
}

function animateCapture(step, reversed, ghost, duration, easing) {
  const square = captureSquare(step);
  if (!reversed && ghost) {
    document.body.append(ghost);
    const animation = ghost.animate([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(.58)' },
    ], { duration: Math.max(110, duration * .72), easing, fill: 'forwards' });
    trackBoardAnimation(animation, () => ghost.remove());
    return;
  }
  if (reversed) {
    const cell = $('board').querySelector('[data-square="' + square + '"]');
    const restored = cell?.querySelector('.piece-art:not([hidden]), .fallback:not([hidden])');
    if (!restored || typeof restored.animate !== 'function') return;
    const animation = restored.animate([
      { opacity: 0, transform: 'scale(.58)' },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: Math.max(110, duration * .72), easing, fill: 'both' });
    trackBoardAnimation(animation);
  }
}

function moveAnimationDuration() {
  const speeds = { slow: 420, normal: 235, fast: 125, natural: 205 };
  return speeds[setting('animation-speed')] ?? speeds.natural;
}

function animateBoardMove(step, reversed, ghost) {
  if (!step || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const speed = setting('animation-speed');
  const duration = moveAnimationDuration();
  const easing = speed === 'natural' ? 'cubic-bezier(.22,.75,.32,1)' : 'cubic-bezier(.2,.65,.3,1)';
  animateCapture(step, reversed, ghost, duration, easing);
  animatePiece(reversed ? step.to : step.from, reversed ? step.from : step.to, duration, easing);
  if (step.flags?.includes('k') || step.flags?.includes('q')) {
    const rank = step.from[1];
    const short = step.to[0] === 'g';
    const rookFrom = (short ? 'h' : 'a') + rank;
    const rookTo = (short ? 'f' : 'd') + rank;
    animatePiece(reversed ? rookTo : rookFrom, reversed ? rookFrom : rookTo, duration, easing);
  }
}

function playMoveSound(step, node) {
  if (node.terminal?.type === 'cp') { playSound('end'); return; }
  const position = new Chess(node.fen);
  if (step.flags?.includes('k') || step.flags?.includes('q')) playSound('castle');
  else if (step.promotion) playSound('promotion');
  else if (step.captured && position.isCheck()) {
    playSound('capture');
    playSound('check-alert');
  } else if (step.captured) playSound('capture');
  else if (position.isCheck()) playSound('check');
  else playSound('move');
}

function goTo(node) {
  if (!node || node === cursor) return;
  const movedForward = node.parent === cursor;
  const reversed = cursor.parent === node;
  const step = movedForward ? node.move : reversed ? cursor.move : null;

  hideMate();
  boardMarks = [];
  activeBoardMark = null;
  cancelBoardAnimations();
  const captureGhost = step && movedForward && step.captured ? snapshotCapturedPiece(step) : null;
  cursor = node;
  selected = null;
  render();
  if (step) {
    animateBoardMove(step, reversed, captureGhost);
    if (node.terminal?.type !== 'mate') playMoveSound(step, node);
  }
  if (tab === 'report') $('inspector-scroll').scrollTop = 0;
  announceMate();
  if (tab === 'lines') queueLive();
}
function stopPlayback() {
  clearInterval(runningTimer);
  runningTimer = null;
  $('play').replaceChildren(icon('play'));
  $('play').setAttribute('aria-pressed', 'false');
  if (cursor) $('play').disabled = !cursor.children.length;
}

function togglePlayback() {
  if (runningTimer) { stopPlayback(); return; }
  if (!cursor.children.length) return;
  $('play').replaceChildren(icon('pause'));
  $('play').setAttribute('aria-pressed', 'true');
  runningTimer = setInterval(() => {
    goTo(cursor.children[0]);
    if (!cursor.children.length) stopPlayback();
  }, 780);
}

function hideMate() {
  clearTimeout(mateTimer);
  const layer = $('mate-effect');
  layer.hidden = true;
  for (const particle of layer.querySelectorAll('.mate-particle')) particle.remove();
  $('board-area').classList.remove('mate-highlight');
}

function announceMate() {
  if (!cursor || cursor.terminal?.type !== 'mate' || tab === 'puzzles' || review) return;
  if (setting('mate-enabled')) {
    const layer = $('mate-effect');
    hideMate();
    const winner = cursor.terminal.white > 0 ? 'w' : 'b';
    $('mate-winner').textContent = displayName(winner) + ' · ' + (winner === 'w' ? '1–0' : '0–1');
    $('board-area').classList.add('mate-highlight');
    mateTimer = mateCelebration(layer);
  }
  playSound('mate');
}

function syncBoardTools() {
  const full = document.fullscreenElement === $('board-area') || fullscreenFallback;
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
  if (review && cursor?.userEdited) stopReview(false);
  const statusId = showInReport ? 'report-status' : 'engine-status';
  if (!engineOn) { $(statusId).textContent = 'Análise pausada'; return; }
  if (cursor.terminal) { $(statusId).textContent = 'Posição final'; renderVariantEvaluation(cursor); return; }
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
  const statusId = showInReport ? 'report-status' : 'engine-status';
  const status = message => { $(statusId).textContent = message; };
  live = task;
  try {
    const { engine, profile, cache } = await useEngine(text => { if (live === task) status(text + '…'); });
    if (live !== task) return;
    const engineLabel = 'Stockfish 19 ' + profile.name + ' · profundidade ';
    const key = cache + '/' + depth + '/' + count;
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
  const top = previousBest === actual || loss < 1.2;
  const opening = root.fen === new Chess().fen() && loss < 6 &&
    ((index === 1 && BOOK.has(actual)) || (index === 2 && BOOK_REPLY[uci(node.parent.move)]?.includes(actual)));
  const margin = runnersUp?.[1] ? color * (winPercent(runnersUp[0]) - winPercent(runnersUp[1])) : 0;
  const opponentCapture = node.parent.move?.captured ? material[node.parent.move.captured] : 0;
  const staticBoard = new Chess(node.fen);
  const commitment = staticBoard.moves({ verbose: true }).some(reply =>
    reply.to === node.move.to && reply.captured && material[reply.captured] >= 3 &&
    material[reply.captured] - (node.move.captured ? material[node.move.captured] : 0) - opponentCapture >= 2);
  if (opening) return 'theory';
  if (top && margin > 12 && commitment && color * (winPercent(after) - 50) >= -5) return 'brilliant';
  if (top && margin > 14) return 'critical';
  if (top) return 'best';
  if (loss < 3.5) return 'excellent';
  if (loss < 7) return 'good';
  if (loss < 13) return 'inaccuracy';
  if (loss < 24) return 'mistake';
  return 'blunder';
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
  for (const node of path) { node.classification = null; node.accuracy = null; node.coach = null; }
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
        const sign = node.move.color === 'w' ? 1 : -1;
        const loss = Math.max(0, sign * (winPercent(before.evaluation) - winPercent(node.evaluation)));
        node.accuracy = before.best === uci(node.move) ? 100 : Math.min(100, Math.max(0, 103.1668 * Math.exp(-.04354 * loss) - 3.1669));
        node.classification = reviewClass(node, before.evaluation, node.evaluation, before.best, before.lines, index);
        node.coach = { before: before.evaluation, after: node.evaluation, best: before.best, choices: before.lines };
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
  const external = value === 'chesscom' || value === 'lichess';
  const input = $('game-input');
  input.value = '';
  input.classList.toggle('username', external);
  input.rows = external ? 1 : 4;
  input.placeholder = value === 'pgn' ? '1. e4 e5 2. Nf3 Nc6 …' : value === 'fen' ?
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : 'Nome de usuário';
  $('input-label').textContent = value === 'pgn' ? 'PGN da partida' : value === 'fen' ? 'FEN da posição' : 'Nome de usuário';
  $('submit-label').textContent = value === 'pgn' ? 'Analisar partida' : value === 'fen' ? 'Analisar posição' : 'Buscar partidas';
  $('file-btn').hidden = value !== 'pgn';
  $('example').hidden = external;
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

async function submitImport(event) {
  event.preventDefault();
  if (!Chess) return;
  reportError();
  const text = $('game-input').value.trim();
  let pending;
  try {
    if (source === 'pgn' || source === 'fen') {
      setGame({ [source]: text }, true);
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
        try { setGame({ pgn: game.pgn }, true); } catch { reportError('Esta partida não pôde ser importada.'); }
      };
      return button;
    }));
    if (!games.length) reportError('Nenhuma partida de xadrez padrão encontrada.');
  } catch (error) {
    if (pending && remoteRequest !== pending) return;
    if (source === 'pgn') reportError(!text ? error.message : 'PGN inválido. Confira a notação e tente de novo.');
    else if (source === 'fen') reportError(!text ? error.message : 'FEN inválido. Confira os campos da posição.');
    else reportError(error instanceof TypeError || error.name === 'TimeoutError' ? 'A consulta falhou. Você também pode importar um PGN.' : error.message);
  } finally {
    if (pending && remoteRequest === pending) {
      remoteRequest = null;
      $('submit').disabled = false;
      $('submit-label').textContent = 'Buscar partidas';
    }
  }
}

function exportPgn() {
  const chess = new Chess(root.fen);
  for (const [key, value] of Object.entries(gameHeaders)) {
    if (typeof value === 'string' && value !== '?' && !['FEN', 'SetUp'].includes(key)) chess.setHeader(key, value.replace(/["\r\n]/g, ' '));
  }
  const current = linePath(cursor).slice(1);
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
function renderArchive() {
  const games = readLocal(archiveKey, []);
  $('archive-list').replaceChildren();
  if (!games.length) $('archive-list').append(element('p', 'Use Compartilhar ou exportar para salvar uma partida aqui.', 'muted'));
  for (const game of games) {
    const button = element('button', game.name + ' · ' + new Date(game.date).toLocaleDateString('pt-BR'), 'game-option');
    button.onclick = () => {
      try {
        setGame(game.data, Boolean(game.data.pgn));
        if (!game.data.pgn) setTab('lines');
        $('archive').close();
      } catch { toast('Não foi possível abrir essa partida.'); }
    };
    $('archive-list').append(button);
  }
}

function snapshotGame() {
  return root.children.length ? { pgn: exportPgn(), ply: pathTo(cursor).length } : { fen: root.fen };
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
    if (control.checked) playSound('select');
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
    if (button) goTo(positions.get(Number(button.dataset.ply)));
  });
  $('chart').addEventListener('pointermove', updateChartTooltip);
  $('chart').addEventListener('pointerleave', () => {
    $('chart-tooltip').hidden = true;
    $('chart').style.cursor = 'crosshair';
  });
  $('chart').addEventListener('click', event => {
    const marker = chartMarkerAt(event);
    if (marker) { goTo(marker.node); return; }
    const { width, left } = $('chart').getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - left - 5) / (width - 10)));
    const nodes = mainPath();
    goTo(nodes[Math.round(fraction * (nodes.length - 1))]);
  });
  $('first').onclick = () => goTo(root);
  $('prev').onclick = () => goTo(cursor.parent);
  $('next').onclick = () => goTo(cursor.children[0]);
  $('last').onclick = () => goTo(linePath(cursor).at(-1));
  $('play').onclick = togglePlayback;
  $('flip').onclick = () => { flipped = !flipped; render(); };
  $('settings-btn').onclick = () => $('settings').showModal();
  $('nav-today').onclick = () => setTab('import');
  $('nav-puzzles').onclick = () => setTab('puzzles');
  $('nav-library').onclick = () => { renderArchive(); $('archive').showModal(); };
  $('export').onclick = () => $('share').showModal();
  $('review-btn').onclick = () => review ? stopReview() : runReview();
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
  $('save-game').onclick = () => {
    try {
      const games = readLocal(archiveKey, []);
      games.unshift({ name: displayName('w') + ' × ' + displayName('b'), date: Date.now(), data: snapshotGame() });
      writeLocal(archiveKey, games.slice(0, 50));
      $('share').close();
      toast('Partida salva no arquivo local.');
    } catch { toast('Não foi possível salvar a partida neste navegador.'); }
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && fullscreenFallback) { fallbackFullscreen(false); return; }
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, select, textarea, dialog, [role=tab]')) return;
    if (event.key === 'g' || event.key === 'G') { event.preventDefault(); toggleFullscreen(); return; }
    if (tab === 'puzzles') return;
    const action = {
      ArrowLeft: () => goTo(cursor.parent), ArrowRight: () => goTo(cursor.children[0]),
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
