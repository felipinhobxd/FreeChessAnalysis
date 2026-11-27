import { STOCKFISH_INTEGRITY, verifyAsset } from './engine-integrity.js';

const PACKAGE = 'stockfish@19.0.1/bin/';
const MIRRORS = ['https://unpkg.com/', 'https://cdn.jsdelivr.net/npm/'];
const FALLBACK_LITE = 'https://chessanalysis.dev/engine/sf19.0.1/stockfish-19-lite-single.js';

const MAX_FULL_THREADS = 16;
const MAX_FULL_HASH_MB = 512;

// Reserve one logical processor for the browser UI, but let powerful desktops
// and phones use more than the previous eight-thread ceiling.
export function threadCountFor(logicalCount) {
  const reported = Number(logicalCount);
  const logical = Number.isFinite(reported) && reported > 0 ? Math.floor(reported) : 2;
  return Math.max(1, Math.min(MAX_FULL_THREADS, logical - 1));
}

export function hashSizeForDeviceMemory(deviceMemory) {
  const memory = Number(deviceMemory);
  if (!Number.isFinite(memory) || memory <= 0) return 64;
  return Math.max(64, Math.min(MAX_FULL_HASH_MB, Math.round(memory * 64)));
}

function availableThreads() {
  let reported = Number(globalThis.navigator?.hardwareConcurrency);
  if (nativeStockfishAvailable()) {
    try {
      // WebView may expose a lower or privacy-capped hardwareConcurrency value.
      // Ask the Android process that will actually host native Stockfish.
      const nativeCount = Number(globalThis.MoveByMoveAndroid.getNativeStockfishProcessorCount?.());
      if (Number.isFinite(nativeCount) && nativeCount > 0) reported = nativeCount;
    } catch {
      // Fall back to the browser's hardwareConcurrency value.
    }
  }
  return threadCountFor(reported);
}

function fullHashSize() {
  return hashSizeForDeviceMemory(globalThis.navigator?.deviceMemory);
}

function nativeStockfishAvailable() {
  try {
    return typeof globalThis.MoveByMoveAndroid?.supportsNativeStockfish === 'function' &&
      globalThis.MoveByMoveAndroid.supportsNativeStockfish() === true;
  } catch {
    return false;
  }
}

function engineBuilds(mode) {
  const lite = {
    name: 'Lite',
    mode: 'lite',
    version: '19.0.1',
    file: 'stockfish-19-lite-single',
    threads: 1,
    hash: 24,
    timeout: 20000,
  };
  if (mode === 'economy') return [{ ...lite, name: 'Eco', mode: 'economy', hash: 8 }];
  if (mode !== 'full') return [lite];

  const threads = availableThreads();
  const hash = fullHashSize();
  const native = nativeStockfishAvailable() ? [{
    name: 'ARM64 nativo',
    mode: 'full',
    version: '19.0',
    file: 'stockfish-19-arm64-universal',
    threads,
    hash,
    timeout: 30000,
    native: true,
  }] : [];
  const wasmThreads = globalThis.crossOriginIsolated ? threads : 1;
  const full = {
    name: 'Completo',
    mode: 'full',
    version: '19.0.1',
    file: 'stockfish-19-single',
    threads: 1,
    hash,
    timeout: 55000,
  };
  const wasm = wasmThreads > 1
    ? [{ ...full, file: 'stockfish-19', threads: wasmThreads }, full, lite]
    : [full, lite];
  return [...native, ...wasm];
}


export function analysisLimits(mode, purpose, requestedDepth, requestedLines = 1) {
  const depth = Number.isFinite(Number(requestedDepth)) ? Math.max(1, Math.floor(Number(requestedDepth))) : 14;
  const lines = Number.isFinite(Number(requestedLines)) ? Math.max(1, Math.floor(Number(requestedLines))) : 1;
  if (mode !== 'economy') return { depth, lines };
  if (purpose === 'review') return { depth: Math.min(depth, 12), lines };
  if (purpose === 'live') return { depth: Math.min(depth, 14), lines: Math.min(lines, 2) };
  return { depth, lines };
}

class AndroidNativeStockfishWorker {
  constructor() {
    const bridge = globalThis.MoveByMoveAndroid;
    if (typeof bridge?.startNativeStockfish !== 'function' ||
        typeof bridge?.sendNativeStockfishCommand !== 'function' ||
        !bridge.startNativeStockfish()) {
      throw new Error('O Stockfish nativo ARM64 não pôde ser iniciado.');
    }

    this.bridge = bridge;
    this.active = true;
    this.onmessage = null;
    this.onerror = null;
    this.receive = data => {
      if (this.active) this.onmessage?.({ data: String(data) });
    };
    this.fail = message => {
      if (!this.active) return;
      const event = { message: String(message || 'Falha no Stockfish nativo.'), preventDefault() {} };
      this.onerror?.(event);
    };
    globalThis.__moveByMoveNativeStockfishReceive = this.receive;
    globalThis.__moveByMoveNativeStockfishError = this.fail;
  }

  postMessage(command) {
    if (!this.active) return;
    try {
      if (!this.bridge.sendNativeStockfishCommand(String(command))) {
        throw new Error('Não foi possível enviar um comando ao Stockfish nativo.');
      }
    } catch (error) {
      this.fail(error?.message || error);
    }
  }

  terminate() {
    if (!this.active) return;
    this.active = false;
    if (globalThis.__moveByMoveNativeStockfishReceive === this.receive) {
      delete globalThis.__moveByMoveNativeStockfishReceive;
    }
    if (globalThis.__moveByMoveNativeStockfishError === this.fail) {
      delete globalThis.__moveByMoveNativeStockfishError;
    }
    try { this.bridge.stopNativeStockfish(); } catch { /* The native process is already gone. */ }
  }
}

const aborted = () => new DOMException('Análise cancelada', 'AbortError');

export class Engine {
  constructor(mode) {
    this.mode = mode;
    this.worker = null;
    this.url = null;
    this.pending = null;
    this.controller = new AbortController();
    this.tail = Promise.resolve();
    this.initialization = null;
    this.multiPV = null;
  }

  start(onProgress) {
    if (!this.initialization) {
      const attempt = this.initialize(onProgress);
      this.initialization = attempt;
      attempt.catch(() => {
        if (this.initialization === attempt) this.initialization = null;
      });
    }
    return this.initialization;
  }

  async initialize(onProgress) {
    let failure;
    const signal = this.controller.signal;
    for (const build of engineBuilds(this.mode)) {
      onProgress?.(build);
      if (build.native) {
        try {
          signal.throwIfAborted();
          this.attachWorker(new AndroidNativeStockfishWorker());
          return await this.configureWorker(build);
        } catch (error) {
          this.closeWorker();
          signal.throwIfAborted();
          failure = error;
          continue;
        }
      }

      const sources = MIRRORS.map(prefix => prefix + PACKAGE + build.file + '.js');
      if (build.name === 'Lite') sources.push(FALLBACK_LITE);
      for (const source of sources) {
        try {
          signal.throwIfAborted();
          const response = await fetch(source, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
          const scriptBytes = await verifyAsset(response, STOCKFISH_INTEGRITY[build.file + '.js']);
          const script = new TextDecoder().decode(scriptBytes);
          if (script.trimStart().startsWith('<')) throw new Error('Arquivo do motor inválido.');
          signal.throwIfAborted();
          const wasm = source.replace(/\.js$/, '.wasm');
          const wasmHash = STOCKFISH_INTEGRITY[build.file + '.wasm'];
          const bootstrap = [
            'const sfClientFetch = self.fetch.bind(self);',
            'self.fetch = async (resource, options) => {',
            '  const value = typeof resource === "string" ? resource : resource && typeof resource.url === "string" ? resource.url : String(resource);',
            '  const isWasm = /\\.wasm(?:[?#]|$)/.test(value);',
            '  const response = await sfClientFetch(isWasm ? ' + JSON.stringify(wasm) + ' : resource, options);',
            '  if (!isWasm || !response.ok) return response;',
            '  const bytes = await response.arrayBuffer();',
            '  const digest = await crypto.subtle.digest("SHA-256", bytes);',
            '  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");',
            '  if (hash !== ' + JSON.stringify(wasmHash) + ') throw new Error("A verificação SHA-256 do WebAssembly Stockfish falhou.");',
            '  return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });',
            '};',
            script,
          ].join('\n');
          this.url = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }));
          this.attachWorker(new Worker(this.url + '#' + encodeURIComponent(wasm)));
          return await this.configureWorker(build);
        } catch (error) {
          this.closeWorker();
          signal.throwIfAborted();
          failure = error;
        }
      }
    }
    throw new Error('Não foi possível iniciar o Stockfish 19. Verifique a conexão e tente novamente.', { cause: failure });
  }

  attachWorker(worker) {
    this.worker = worker;
    worker.onmessage = ({ data }) => String(data).split(/\r?\n/).forEach(line => this.pending?.read(line));
    worker.onerror = event => {
      event.preventDefault?.();
      const error = new Error(event.message || 'Falha no motor de xadrez.');
      this.closeWorker(error);
    };
  }

  async configureWorker(build) {
    let identity = '';
    let maxThreads = 1;
    await this.exchange(['uci'], line => {
      if (line.startsWith('id name ')) identity = line.slice(8);
      const option = /^option name Threads .* max (\d+)/.exec(line);
      if (option) maxThreads = Number(option[1]);
      return line === 'uciok' ? true : undefined;
    }, build.timeout);
    if (!/^Stockfish 19(?:\b|$)/i.test(identity)) throw new Error('Versão do motor incompatível.');
    if (build.threads > maxThreads) throw new Error('Compilação sem suporte às linhas de processamento.');
    await this.exchange([
      'setoption name Threads value ' + build.threads,
      'setoption name Hash value ' + build.hash,
      'isready',
    ], line => line === 'readyok' ? true : undefined, 18000);
    this.multiPV = null;
    return {
      name: build.name,
      mode: build.mode,
      version: build.version,
      file: build.file,
      hash: build.hash,
      threads: build.threads,
      identity,
      native: Boolean(build.native),
    };
  }

  exchange(commands, parse, timeout) {
    if (!this.worker) return Promise.reject(aborted());
    if (this.pending) return Promise.reject(new Error('Consulta anterior em andamento'));
    return new Promise((resolve, reject) => {
      const settle = (error, value) => {
        clearTimeout(timer);
        this.pending = null;
        if (error) reject(error);
        else resolve(value);
      };
      const timer = setTimeout(() => {
        settle(new Error('O motor excedeu o tempo de resposta.'));
        this.closeWorker();
      }, timeout);
      this.pending = {
        read(line) {
          try {
            const result = parse(line.trim());
            if (result !== undefined) settle(null, result);
          } catch (error) {
            settle(error);
          }
        },
        fail: error => settle(error),
      };
      commands.forEach(command => this.worker.postMessage(command));
    });
  }

  search(rootFen, moves, depth, lines, { signal, update } = {}) {
    const next = this.tail.then(async () => {
      signal?.throwIfAborted();
      const byDepth = new Map();
      let publishedDepth = 7;
      const stop = () => this.worker?.postMessage('stop');
      signal?.addEventListener('abort', stop, { once: true });
      try {
        const commands = [];
        if (this.multiPV !== lines) {
          commands.push('setoption name MultiPV value ' + lines);
          this.multiPV = lines;
        }
        commands.push(
          'position fen ' + rootFen + (moves.length ? ' moves ' + moves.join(' ') : ''),
          'go depth ' + depth,
        );
        const best = await this.exchange(commands, line => {
          const best = /^bestmove (\S+)/.exec(line);
          if (best) return best[1];
          const result = /^info depth (\d+).*? multipv (\d+) score (cp|mate) (-?\d+)(?: lowerbound| upperbound)?.*? pv (.+)$/.exec(line);
          if (!result || signal?.aborted) return;
          const [, level, id, type, value, pv] = result;
          const depth = Number(level);
          if (!byDepth.has(depth)) byDepth.set(depth, new Map());
          const batch = byDepth.get(depth);
          batch.set(Number(id), { depth, type, value: Number(value), pv: pv.trim().split(/\s+/) });
          if (update && depth >= publishedDepth && batch.size === lines && batch.has(1)) {
            publishedDepth = depth;
            update(this.sorted(batch));
          }
        }, 150000);
        signal?.throwIfAborted();
        const batches = Array.from(byDepth).sort(([a], [b]) => b - a).map(([, batch]) => batch);
        const final = batches.find(batch => batch.get(1)?.pv[0] === best) ?? batches.find(batch => batch.has(1));
        return { best, lines: final ? this.sorted(final) : [] };
      } finally {
        signal?.removeEventListener('abort', stop);
      }
    });
    this.tail = next.catch(() => {});
    return next;
  }

  sorted(info) {
    return Array.from(info).sort(([a], [b]) => a - b).map(([, line]) => line);
  }

  closeWorker(error = aborted()) {
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.onerror = null;
      worker.onmessage = null;
      worker.terminate();
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.multiPV = null;
    const pending = this.pending;
    if (pending) pending.fail(error);
  }

  dispose() {
    this.controller.abort();
    this.closeWorker();
  }
}
