import { STOCKFISH_INTEGRITY, verifyAsset } from './engine-integrity.js';

const PACKAGE = 'stockfish@19.0.1/bin/';
const MIRRORS = ['https://unpkg.com/', 'https://cdn.jsdelivr.net/npm/'];
const FALLBACK_LITE = 'https://chessanalysis.dev/engine/sf19.0.1/stockfish-19-lite-single.js';

function engineBuilds(mode) {
  const lite = { name: 'Lite', file: 'stockfish-19-lite-single', threads: 1, timeout: 20000 };
  if (mode !== 'full') return [lite];
  const threads = globalThis.crossOriginIsolated ? Math.max(1, Math.min(8, Math.floor((navigator.hardwareConcurrency || 2) / 2))) : 1;
  const full = { name: 'Completo', file: 'stockfish-19-single', threads: 1, timeout: 55000 };
  return threads > 1 ? [{ ...full, file: 'stockfish-19', threads }, full, lite] : [full, lite];
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
          this.worker = new Worker(this.url + '#' + encodeURIComponent(wasm));
          this.worker.onmessage = ({ data }) => String(data).split(/\r?\n/).forEach(line => this.pending?.read(line));
          this.worker.onerror = event => {
            event.preventDefault();
            const error = new Error(event.message || 'Falha no WebAssembly');
            this.closeWorker(error);
          };
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
            'setoption name Hash value ' + (build.name === 'Lite' ? 24 : 64),
            'isready',
          ], line => line === 'readyok' ? true : undefined, 18000);
          return { name: build.name, threads: build.threads, identity };
        } catch (error) {
          this.closeWorker();
          signal.throwIfAborted();
          failure = error;
        }
      }
    }
    throw new Error('Não foi possível iniciar o Stockfish 19. Verifique a conexão e tente novamente.', { cause: failure });
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
      const info = new Map();
      const stop = () => this.worker?.postMessage('stop');
      signal?.addEventListener('abort', stop, { once: true });
      try {
        const best = await this.exchange([
          'setoption name MultiPV value ' + lines,
          'position fen ' + rootFen + (moves.length ? ' moves ' + moves.join(' ') : ''),
          'go depth ' + depth,
        ], line => {
          const best = /^bestmove (\S+)/.exec(line);
          if (best) return best[1];
          const result = /^info depth (\d+).*? multipv (\d+) score (cp|mate) (-?\d+)(?: lowerbound| upperbound)?.*? pv (.+)$/.exec(line);
          if (!result || signal?.aborted) return;
          const [, level, id, type, value, pv] = result;
          info.set(Number(id), { depth: Number(level), type, value: Number(value), pv: pv.trim().split(/\s+/) });
          if (update && id === '1' && Number(level) >= 7) update(this.sorted(info));
        }, 150000);
        signal?.throwIfAborted();
        return { best, lines: this.sorted(info) };
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
    const pending = this.pending;
    if (pending) pending.fail(error);
  }

  dispose() {
    this.controller.abort();
    this.closeWorker();
  }
}
