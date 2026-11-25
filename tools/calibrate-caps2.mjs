#!/usr/bin/env node
/**
 * Reproducible Chess.com accuracy calibration pipeline.
 * collect -> analyze -> fit. See tools/CAPS2-CALIBRATION.md.
 * CAPS2 is proprietary; this fits a transparent approximation to public game scores.
 */
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const DIR = resolve(ROOT, '.calibration');
const GAMES_FILE = resolve(DIR, 'caps2-games.json');
const ANALYSIS_FILE = resolve(DIR, 'caps2-analysis.json');
const ENGINE_LABEL = 'Stockfish 19 Lite single-threaded (npm 19.0.1)';
const REPORT_FILE = resolve(ROOT, 'dist', 'caps2-calibration-report.json');
const MODEL_FILE = resolve(ROOT, 'dist', 'caps2-model.js');
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const USER_AGENT = 'MoveByMove-CAPS2-Research/1.0 (public game-accuracy calibration)';
const args = parseArgs(process.argv.slice(3));
const command = process.argv[2];

function parseArgs(tokens) {
  const out = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith('--')) continue;
    const equal = token.indexOf('=');
    if (equal >= 0) out[token.slice(2, equal)] = token.slice(equal + 1);
    else if (tokens[i + 1] && !tokens[i + 1].startsWith('--')) out[token.slice(2)] = tokens[++i];
    else out[token.slice(2)] = true;
  }
  return out;
}
const numberArg = (name, fallback) => Number.isFinite(Number(args[name])) ? Number(args[name]) : fallback;
const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
const exists = async path => { try { await access(path); return true; } catch { return false; } };
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, data) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
};
function shuffle(values) {
  const list = values.slice();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
function pgnPlyCount(pgn) {
  const moves = String(pgn).split(/\r?\n/).filter(line => !line.startsWith('[')).join(' ');
  const withoutComments = moves.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  const fullMoves = (withoutComments.match(/\b\d+\.(?:\.\.)?/g) || []).length;
  return fullMoves * 2;
}
async function apiJson(url, state) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const remaining = state.delay - (Date.now() - state.lastRequest);
    if (remaining > 0) await wait(remaining);
    state.lastRequest = Date.now();
    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
    } catch (error) {
      if (attempt === 5) throw error;
      await wait(1500 * (attempt + 1));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      if (attempt === 5) throw new Error('Chess.com API rate limit/service error: HTTP ' + response.status);
      const retry = Number(response.headers.get('Retry-After')) * 1000 || 2000 * (2 ** attempt);
      process.stderr.write('Rate limit/service response ' + response.status + ', retrying in ' + Math.ceil(retry / 1000) + 's\n');
      await wait(retry);
      continue;
    }
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Chess.com API returned HTTP ' + response.status + ' for ' + url);
    }
    return response.json();
  }
  return null;
}
async function collect() {
  const targetGames = Math.max(1, numberArg('games', 5000));
  const targetPlayers = Math.max(1, numberArg('players', 1200));
  const months = Math.max(1, Math.min(12, numberArg('months', 2)));
  const perPlayer = Math.max(1, numberArg('per-player', 18));
  const state = { delay: Math.max(650, numberArg('delay-ms', 1000)), lastRequest: 0 };
  await mkdir(DIR, { recursive: true });
  const previous = await exists(GAMES_FILE) ? await readJson(GAMES_FILE) : { games: [] };
  const games = new Map((previous.games || []).map(game => [String(game.url), game]));
  const seenPlayers = new Set((previous.scannedPlayers || []).map(name => String(name).toLowerCase()));
  let seeds = [];
  if (args['seed-file']) {
    const contents = await readFile(resolve(ROOT, String(args['seed-file'])), 'utf8');
    seeds = contents.split(/\r?\n/).map(line => line.trim().split(/[,\s]+/)[0])
      .filter(name => /^[A-Za-z0-9_-]{1,30}$/.test(name));
  } else {
    const countries = String(args.countries || 'US,IN,BR,GB,CA,DE,FR,ES,PH,TR,PL,AU,NL,SE,NO,IT,ID,MX,AR,ZA,UA,JP,KR').split(',');
    for (const country of countries) {
      try {
        const response = await apiJson('https://api.chess.com/pub/country/' + country.trim().toUpperCase() + '/players', state);
        if (response?.players?.length) seeds.push(...shuffle(response.players).slice(0, Math.ceil(targetPlayers / countries.length * 1.5)));
      } catch (error) {
        process.stderr.write('Could not list country ' + country + ': ' + error.message + '\n');
      }
    }
    try {
      const boards = await apiJson('https://api.chess.com/pub/leaderboards', state);
      for (const key of ['live_blitz', 'live_rapid', 'live_bullet']) {
        for (const entry of boards?.[key] || []) if (entry.username) seeds.push(entry.username);
      }
    } catch (error) {
      process.stderr.write('Leaderboard seed skipped: ' + error.message + '\n');
    }
  }
  seeds = shuffle([...new Set(seeds.map(name => String(name).toLowerCase()))]).slice(0, targetPlayers);
  const cutoff = Date.parse(String(args.since || '2023-01-01')) / 1000;
  let scanned = 0;
  for (const username of seeds) {
    if (games.size >= targetGames) break;
    if (seenPlayers.has(username)) continue;
    seenPlayers.add(username);
    scanned++;
    try {
      const archives = await apiJson('https://api.chess.com/pub/player/' + encodeURIComponent(username) + '/games/archives', state);
      if (!archives?.archives?.length) continue;
      const monthsToRead = archives.archives.slice(-months).reverse();
      let addedByPlayer = 0;
      for (const archiveUrl of monthsToRead) {
        if (games.size >= targetGames || addedByPlayer >= perPlayer) break;
        const archive = await apiJson(archiveUrl, state);
        for (const game of archive?.games || []) {
          if (games.size >= targetGames || addedByPlayer >= perPlayer) break;
          if (game.rules !== 'chess' || game.rated !== true || !game.pgn || !game.accuracies) continue;
          if (!['blitz', 'rapid'].includes(game.time_class)) continue;
          if (!Number.isFinite(game.end_time) || game.end_time < cutoff) continue;
          if (!game.white?.username || !game.black?.username) continue;
          if (!Number.isFinite(game.white.rating) || !Number.isFinite(game.black.rating)) continue;
          if (!Number.isFinite(game.accuracies.white) || !Number.isFinite(game.accuracies.black)) continue;
          if (pgnPlyCount(game.pgn) < 20) continue;
          const url = game.url || game.uuid;
          if (!url) continue;
          const key = String(url);
          if (games.has(key)) continue;
          games.set(key, {
            url: key, endTime: game.end_time, timeClass: game.time_class,
            timeControl: game.time_control || null,
            white: { username: game.white.username.toLowerCase(), rating: game.white.rating, accuracy: game.accuracies.white },
            black: { username: game.black.username.toLowerCase(), rating: game.black.rating, accuracy: game.accuracies.black },
            pgn: game.pgn
          });
          addedByPlayer++;
        }
      }
    } catch (error) {
      process.stderr.write('Skipped ' + username + ': ' + error.message + '\n');
    }
    if (scanned % 10 === 0) {
      process.stdout.write('Players scanned: ' + scanned + '/' + seeds.length + ' · reviewed games: ' + games.size + '\n');
      await writeJson(GAMES_FILE, {
        schema: 1, source: 'Chess.com Published Data API', accuracyEraStart: '2023-01-01',
        collectedAt: new Date().toISOString(), games: [...games.values()], scannedPlayers: [...seenPlayers]
      });
    }
  }
  const dataset = {
    schema: 1, source: 'Chess.com Published Data API',
    note: 'Only rated standard chess games with public game-level accuracies are included. The API does not expose official per-move CAPS2 scores.',
    accuracyEraStart: '2023-01-01', collectedAt: new Date().toISOString(),
    games: [...games.values()], scannedPlayers: [...seenPlayers]
  };
  await writeJson(GAMES_FILE, dataset);
  console.log('Saved ' + dataset.games.length + ' distinct reviewed games to ' + GAMES_FILE);
  console.log('Players scanned this run: ' + scanned + '; unique accounts seen: ' + seenPlayers.size);
  console.log('The API only exposes game-level accuracy for games where Chess.com has published that review value.');
}
class UciEngine {
  constructor() {
    this.engine = null;
    this.waiters = [];
    this.searching = null;
    this.idName = '';
  }
  send(command) {
    if (!this.engine) throw new Error('Stockfish.js engine is not running.');
    this.engine.processCommand(command);
  }
  line(rawLine) {
    const lines = String(rawLine).replace(/b\s*e\s*s\s*t\s*m\s*o\s*v\s*e/gi, 'bestmove').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('id name ')) this.idName = line.slice(8);
      if (this.searching) {
        const match = /^info depth (\d+).*?\bscore (cp|mate) (-?\d+)(?: lowerbound| upperbound)?(?:\s|$)/.exec(line);
        if (match && !/ lowerbound| upperbound/.test(line) && Number(match[1]) >= this.searching.depth) {
          this.searching.score = { type: match[2], value: Number(match[3]) };
          this.searching.seenDepth = Number(match[1]);
        }
        if (line.startsWith('bestmove ')) {
          const pending = this.searching;
          this.searching = null;
          clearTimeout(pending.timer);
          if (!pending.score) pending.reject(new Error('Stockfish returned no score for the requested depth.'));
          else pending.resolve({ ...pending.score, depth: pending.seenDepth, bestMove: line.split(/\s+/)[1] });
        }
      }
      for (const waiter of [...this.waiters]) {
        if (waiter.predicate(line)) {
          this.waiters.splice(this.waiters.indexOf(waiter), 1);
          clearTimeout(waiter.timer);
          waiter.resolve(line);
        }
      }
    }
  }
  waitFor(predicate, timeout = 20000) {
    return new Promise((resolveWaiter, rejectWaiter) => {
      const waiter = {
        predicate, resolve: resolveWaiter, reject: rejectWaiter,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter(item => item !== waiter);
          rejectWaiter(new Error('Stockfish did not respond in time.'));
        }, timeout)
      };
      this.waiters.push(waiter);
    });
  }
  async boot() {
    const factory = require('stockfish');
    this.engine = factory('lite-single', line => this.line(line));
    if (!this.engine || typeof this.engine.processCommand !== 'function') {
      throw new Error('The installed stockfish package did not create a UCI engine.');
    }
    const ready = this.waitFor(line => line === 'uciok', 60000);
    this.send('uci');
    await ready;
    if (!/^Stockfish 19(?:\b|$)/i.test(this.idName)) {
      throw new Error('Expected the app-matching Stockfish 19 Lite build, received: ' + (this.idName || 'unknown engine'));
    }
    this.send('setoption name Hash value 128');
    this.send('setoption name MultiPV value 1');
    const initialized = this.waitFor(line => line === 'readyok', 60000);
    this.send('isready');
    await initialized;
    return this.idName;
  }
  async newGame() {
    this.send('ucinewgame');
    const ready = this.waitFor(line => line === 'readyok', 60000);
    this.send('isready');
    await ready;
  }
  search(rootFen, moves, depth) {
    if (this.searching) return Promise.reject(new Error('Concurrent Stockfish search is not supported.'));
    return new Promise((resolveSearch, rejectSearch) => {
      const pending = {
        depth, score: null, seenDepth: 0, resolve: resolveSearch, reject: rejectSearch,
        timer: setTimeout(() => {
          if (this.searching !== pending) return;
          this.searching = null;
          rejectSearch(new Error('Stockfish search timed out.'));
          try { this.send('stop'); } catch {}
        }, 180000)
      };
      this.searching = pending;
      const position = rootFen === START_FEN
        ? 'position startpos' + (moves.length ? ' moves ' + moves.join(' ') : '')
        : 'position fen ' + rootFen + (moves.length ? ' moves ' + moves.join(' ') : '');
      this.send(position);
      this.send('go depth ' + depth);
    });
  }
  close() {
    try { this.engine?.terminate(); } catch {}
    this.engine = null;
  }
}
async function analyze() {
  const sample = await readJson(GAMES_FILE);
  if (!sample.games?.length) throw new Error('No collected games found. Run the collect command first.');
  let Chess;
  try { ({ Chess } = await import('chess.js')); }
  catch { throw new Error('Install local calibration tools first with: npm install'); }
  const depth = Math.max(8, Math.min(30, numberArg('depth', 14)));
  const limit = Math.max(0, numberArg('limit', 0));
  const binary = 'npm stockfish@19.0.1 lite-single';
  const existing = await exists(ANALYSIS_FILE) ? await readJson(ANALYSIS_FILE) : null;
  const results = new Map((existing?.engine === 'Stockfish 19' && existing.depth === depth ? existing.games : []).map(game => [game.url, game]));
  const engine = new UciEngine();
  const identity = await engine.boot();
  const pending = sample.games.filter(game => !results.has(game.url));
  const work = limit ? pending.slice(0, limit) : pending;
  console.log('Stockfish: ' + identity + ' · depth ' + depth + ' · remaining games ' + work.length);
  try {
    for (let index = 0; index < work.length; index++) {
      const game = work[index];
      try {
        await engine.newGame();
        const parser = new Chess();
        parser.loadPgn(game.pgn);
        const headers = parser.getHeaders();
        const history = parser.history({ verbose: true });
        if (history.length < 10) continue;
        const rootFen = headers.FEN || history[0]?.before || START_FEN;
        const board = new Chess(rootFen);
        const moves = [];
        const positions = [];
        for (let ply = 0; ply <= history.length; ply++) {
          const legalMoves = board.moves({ verbose: true });
          const terminal = board.isCheckmate() ? 'mate' : board.isDraw() ? 'draw' : null;
          positions.push({ legalMoves: legalMoves.length, terminal });
          if (ply < history.length) {
            const move = history[ply];
            const applied = board.move({ from: move.from, to: move.to, promotion: move.promotion });
            if (!applied) throw new Error('PGN replay diverged at ply ' + (ply + 1));
            moves.push(move.from + move.to + (move.promotion || ''));
          }
        }
        for (let ply = 0; ply < positions.length; ply++) {
          const position = positions[ply];
          if (position.terminal === 'mate') position.score = { type: 'mate', value: -1 };
          else if (position.terminal === 'draw') position.score = { type: 'cp', value: 0 };
          else {
            const line = await engine.search(rootFen, moves.slice(0, ply), depth);
            position.score = { type: line.type, value: line.value };
          }
        }
        const scoredMoves = history.map((move, ply) => ({
          color: move.color, forced: positions[ply].legalMoves <= 1,
          before: positions[ply].score, after: positions[ply + 1].score
        }));
        results.set(game.url, {
          url: game.url, timeClass: game.timeClass, white: game.white, black: game.black,
          moves: scoredMoves, depth, engine: ENGINE_LABEL
        });
      } catch (error) {
        process.stderr.write('Skipped game ' + game.url + ': ' + error.message + '\n');
      }
      if ((index + 1) % 10 === 0 || index + 1 === work.length) {
        await writeJson(ANALYSIS_FILE, {
          schema: 1, source: 'Chess.com Published Data API',
          engine: ENGINE_LABEL, engineIdentity: identity, depth,
          analyzedAt: new Date().toISOString(), games: [...results.values()]
        });
        process.stdout.write('Analyzed ' + (index + 1) + '/' + work.length + ' · cached total ' + results.size + '\n');
      }
    }
  } finally { engine.close(); }
  console.log('Analysis cache: ' + ANALYSIS_FILE);
  console.log('Cached scores are Stockfish annotations, not Chess.com per-move labels.');
}
function sigmoid(score, k) {
  if (!score) return 50;
  if (score.type === 'mate') return score.value > 0 ? 100 : score.value < 0 ? 0 : 50;
  return 100 / (1 + Math.exp(-k * Math.max(-1000, Math.min(1000, score.value))));
}
function scoreMove(move, params) {
  const before = sigmoid(move.before, params.winK);
  const afterForMover = 100 - sigmoid(move.after, params.winK);
  const loss = Math.max(0, before - afterForMover);
  const raw = 103.1668100711649 * Math.exp(-params.decay * loss) - 3.166924740191411 + 1;
  return Math.max(params.floor || 0, Math.min(100, raw + (params.offset || 0)));
}
function aggregate(values, mode) {
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mode === 'mean') return average;
  const harmonic = values.length / values.reduce((sum, value) => sum + 1 / Math.max(1, value), 0);
  return mode === 'harmonic' ? harmonic : average * 0.8 + harmonic * 0.2;
}
function playerSplit(username) {
  const hash = createHash('sha256').update(String(username).toLowerCase()).digest();
  return hash[0] % 10 <= 6 ? 'train' : 'test';
}
function prepareSplits(games) {
  const train = [], test = [];
  const trainPlayers = new Set(), testPlayers = new Set();
  let crossSplitGames = 0;
  for (const game of games) {
    if (!game.white?.username || !game.black?.username) continue;
    const whiteSplit = playerSplit(game.white.username), blackSplit = playerSplit(game.black.username);
    if (whiteSplit !== blackSplit) { crossSplitGames++; continue; }
    const target = whiteSplit === 'train' ? train : test;
    target.push(game);
    const players = whiteSplit === 'train' ? trainPlayers : testPlayers;
    players.add(game.white.username.toLowerCase());
    players.add(game.black.username.toLowerCase());
  }
  return { train, test, trainPlayers, testPlayers, crossSplitGames };
}
function sideAccuracy(game, side, params) {
  const player = game[side];
  if (!Number.isFinite(player?.accuracy)) return null;
  let moves = game.moves.filter(move => move.color === (side === 'white' ? 'w' : 'b'));
  if (params.forcedPolicy === 'exclude') {
    const nonForced = moves.filter(move => !move.forced);
    if (nonForced.length >= 5) moves = nonForced;
  }
  return aggregate(moves.map(move => scoreMove(move, params)), params.aggregation);
}
function collectErrors(games, params) {
  const errors = [];
  for (const game of games) for (const side of ['white', 'black']) {
    const predicted = sideAccuracy(game, side, params);
    if (predicted !== null) errors.push({
      error: predicted - game[side].accuracy, actual: game[side].accuracy,
      timeClass: game.timeClass, rating: game[side].rating
    });
  }
  return errors;
}
function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function metrics(games, params) {
  const errors = collectErrors(games, params);
  if (!errors.length) return { n: 0, mae: null };
  const values = errors.map(row => row.error);
  const mae = values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length;
  const rmse = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
  const bias = values.reduce((sum, value) => sum + value, 0) / values.length;
  const result = {
    n: values.length, mae: Number(mae.toFixed(3)), rmse: Number(rmse.toFixed(3)),
    medianAbsoluteError: Number(median(values.map(Math.abs)).toFixed(3)),
    bias: Number(bias.toFixed(3)),
    within1: values.filter(value => Math.abs(value) <= 1).length,
    within2: values.filter(value => Math.abs(value) <= 2).length,
    within5: values.filter(value => Math.abs(value) <= 5).length
  };
  for (const timeClass of ['blitz', 'rapid']) {
    const subset = errors.filter(row => row.timeClass === timeClass).map(row => row.error);
    if (subset.length) result[timeClass] = {
      n: subset.length,
      mae: Number((subset.reduce((sum, value) => sum + Math.abs(value), 0) / subset.length).toFixed(3)),
      rmse: Number(Math.sqrt(subset.reduce((sum, value) => sum + value * value, 0) / subset.length).toFixed(3)),
      bias: Number((subset.reduce((sum, value) => sum + value, 0) / subset.length).toFixed(3))
    };
  }
  return result;
}
const PARAM_GRIDS = {
  winK: Array.from({ length: 8 }, (_, i) => Number((0.0015 + i * 0.0005).toFixed(5))),
  decay: Array.from({ length: 15 }, (_, i) => Number((0.03 + i * 0.005).toFixed(3))),
  offset: [-4, -2, 0, 2, 4]
};
function fitTrain(train) {
  const starts = [];
  for (const aggregation of ['mean', 'blend80', 'harmonic']) for (const forcedPolicy of ['include', 'exclude']) {
    starts.push({ winK: 0.00368208, decay: 0.055, offset: 0, floor: 0, aggregation, forcedPolicy });
  }
  let best = null;
  for (let candidateIndex = 0; candidateIndex < starts.length; candidateIndex++) {
    let current = starts[candidateIndex];
    let currentMae = metrics(train, current).mae;
    for (let round = 0; round < 3; round++) {
      let improved = false;
      for (const field of ['winK', 'decay', 'offset']) for (const value of PARAM_GRIDS[field]) {
        const trial = { ...current, [field]: value };
        const score = metrics(train, trial).mae;
        if (score < currentMae - 1e-7) { current = trial; currentMae = score; improved = true; }
      }
      if (!improved) break;
    }
    if (!best || currentMae < best.mae) best = { params: current, mae: currentMae };
    process.stdout.write('Fitted candidate ' + (candidateIndex + 1) + '/' + starts.length + ' · training MAE ' + currentMae.toFixed(3) + '\n');
  }
  return best;
}
async function fit() {
  const dataset = await readJson(ANALYSIS_FILE);
  if (dataset.engine !== ENGINE_LABEL || !dataset.games?.length) throw new Error('No compatible Stockfish analysis cache found. Run analyze first.');
  const splits = prepareSplits(dataset.games);
  const baseline = { winK: 0.00368208, decay: 0.055, offset: 0, floor: 0, aggregation: 'mean', forcedPolicy: 'include' };
  const baselineTrain = metrics(splits.train, baseline), baselineTest = metrics(splits.test, baseline);
  console.log('Player-disjoint split: train ' + splits.train.length + ' games / ' + splits.trainPlayers.size + ' players; test ' + splits.test.length + ' games / ' + splits.testPlayers.size + ' players.');
  console.log('Cross-split games excluded: ' + splits.crossSplitGames);
  const fitted = fitTrain(splits.train);
  const trainedMetrics = metrics(splits.train, fitted.params), testMetrics = metrics(splits.test, fitted.params);
  const enoughData = trainedMetrics.n >= numberArg('min-train-sides', 1000) &&
    testMetrics.n >= numberArg('min-test-sides', 200) &&
    splits.testPlayers.size >= numberArg('min-test-players', 100);
  const improved = Number.isFinite(testMetrics.mae) && Number.isFinite(baselineTest.mae) &&
    testMetrics.mae <= baselineTest.mae - numberArg('min-improvement', 0.3);
  const accepted = enoughData && improved;
  const report = {
    schema: 1, createdAt: new Date().toISOString(),
    target: 'Chess.com published game-level accuracy (CAPS2-era games)',
    disclaimer: 'CAPS2 is proprietary. This is a supervised approximation, not the private Chess.com formula or official per-move labels.',
    engine: dataset.engine, depth: dataset.depth, sourceGames: dataset.games.length,
    split: 'SHA-256 player split (70% train / 30% holdout); only games whose two players share the same split are included. No player or game appears in both sets.',
    excludedCrossSplitGames: splits.crossSplitGames,
    trainPlayers: splits.trainPlayers.size, holdoutPlayers: splits.testPlayers.size,
    baseline: { parameters: baseline, train: baselineTrain, holdout: baselineTest },
    fitted: { parameters: fitted.params, train: trainedMetrics, holdout: testMetrics },
    acceptance: {
      accepted, enoughData, improved,
      requirements: {
        trainPlayerSides: numberArg('min-train-sides', 1000),
        holdoutPlayerSides: numberArg('min-test-sides', 200),
        holdoutPlayers: numberArg('min-test-players', 100),
        holdoutMaeImprovement: numberArg('min-improvement', 0.3)
      },
      reason: accepted ? 'The fitted model improves the untouched player-disjoint holdout and meets sample thresholds.'
        : !enoughData ? 'Not enough independent player/game observations. Collect more games before publishing a calibrated model.'
          : 'The fitted model did not improve the player-disjoint holdout enough. The provisional model was retained.'
    }
  };
  await writeJson(REPORT_FILE, report);
  if (accepted || args.force === true) {
    const model = {
      version: 1, status: accepted ? 'calibrated' : 'experimental',
      source: 'Chess.com Published Data API · player-disjoint calibration',
      winK: fitted.params.winK, decay: fitted.params.decay,
      floor: fitted.params.floor, offset: fitted.params.offset,
      aggregation: fitted.params.aggregation, forcedPolicy: fitted.params.forcedPolicy,
      trainedGames: splits.train.length, heldOutGames: splits.test.length,
      heldOutSides: testMetrics.n, heldOutMae: testMetrics.mae,
      baselineHeldOutMae: baselineTest.mae, engine: dataset.engine, depth: dataset.depth
    };
    const source = '// Generated by tools/calibrate-caps2.mjs. Review the report before publishing.\n' +
      'export const calibrationModel = Object.freeze(' + JSON.stringify(model, null, 2) + ');\n';
    await writeFile(MODEL_FILE, source, 'utf8');
    console.log('Wrote dist/caps2-model.js (' + model.status + ').');
  } else {
    console.log('Kept the provisional production model. See dist/caps2-calibration-report.json for held-out metrics.');
  }
  console.log('Baseline holdout MAE: ' + (baselineTest.mae ?? 'n/a') + '; fitted holdout MAE: ' + (testMetrics.mae ?? 'n/a'));
  console.log('Report: ' + REPORT_FILE);
}
if (command === 'collect') await collect();
else if (command === 'analyze') await analyze();
else if (command === 'fit') await fit();
else {
  console.log('Usage:\n  node tools/calibrate-caps2.mjs collect --games 5000 --players 1200\n  node tools/calibrate-caps2.mjs analyze --depth 14\n  node tools/calibrate-caps2.mjs fit');
}
