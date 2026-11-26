import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, analysisLimits } from '../dist/engine.js';
import { STOCKFISH_INTEGRITY } from '../dist/engine-integrity.js';

function installBrowserMocks({ fetch, Worker, verifiedEngine = false }) {
  const originals = {
    fetch: globalThis.fetch,
    Worker: globalThis.Worker,
    crypto: Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
  };
  globalThis.fetch = fetch;
  globalThis.Worker = Worker;
  if (verifiedEngine) {
    const digest = Uint8Array.from(STOCKFISH_INTEGRITY['stockfish-19-lite-single.js'].match(/../g), byte => parseInt(byte, 16));
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { subtle: { digest: async () => digest.buffer } },
    });
  }
  URL.createObjectURL = () => 'blob:stockfish-test';
  URL.revokeObjectURL = () => {};
  return () => {
    globalThis.fetch = originals.fetch;
    globalThis.Worker = originals.Worker;
    if (originals.crypto) Object.defineProperty(globalThis, 'crypto', originals.crypto);
    else delete globalThis.crypto;
    URL.createObjectURL = originals.createObjectURL;
    URL.revokeObjectURL = originals.revokeObjectURL;
  };
}

function respondingWorker() {
  return class MockWorker {
    constructor() {
      this.onmessage = null;
      this.onerror = null;
    }
    postMessage(command) {
      queueMicrotask(() => {
        const data = command === 'uci'
          ? 'id name Stockfish 19.0.1\noption name Threads type spin default 1 min 1 max 1\nuciok'
          : 'readyok';
        this.onmessage?.({ data });
      });
    }
    terminate() {}
  };
}

test('engine can retry initialization after every source initially fails', async () => {
  let available = false;
  const restore = installBrowserMocks({
    fetch: async () => available ? ({ ok: true, arrayBuffer: async () => new TextEncoder().encode('worker fixture').buffer }) : ({ ok: false }),
    Worker: respondingWorker(),
    verifiedEngine: true,
  });
  const engine = new Engine('lite');
  try {
    await assert.rejects(engine.start(), /Não foi possível iniciar o Stockfish 19/);
    available = true;
    const initialized = await engine.start();
    assert.equal(initialized.name, 'Lite');
    assert.match(initialized.identity, /^Stockfish 19/);
    assert.strictEqual(await engine.start(), initialized);
  } finally {
    engine.dispose();
    restore();
  }
});

test('engine falls back after a Worker crash and keeps the successful initialization cached', async () => {
  let workerCount = 0;
  class FallbackWorker extends respondingWorker() {
    constructor() {
      super();
      workerCount++;
      this.crash = workerCount === 1;
    }
    postMessage(command) {
      if (this.crash && command === 'uci') {
        queueMicrotask(() => this.onerror?.({
          message: 'Worker boot failed',
          preventDefault() {},
        }));
        return;
      }
      super.postMessage(command);
    }
  }
  const restore = installBrowserMocks({
    fetch: async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode('worker fixture').buffer }),
    Worker: FallbackWorker,
    verifiedEngine: true,
  });
  const engine = new Engine('lite');
  try {
    const initialized = await engine.start();
    assert.equal(initialized.name, 'Lite');
    assert.equal(workerCount, 2);
    assert.strictEqual(await engine.start(), initialized);
    assert.equal(workerCount, 2);
  } finally {
    engine.dispose();
    restore();
  }
});

test('MultiPV publishes lines from one depth even when a newer iteration is incomplete', async () => {
  const engine = new Engine('lite');
  engine.exchange = async (_commands, parse) => {
    parse('info depth 7 multipv 1 score cp 30 pv e2e4 e7e5');
    parse('info depth 7 multipv 2 score cp 20 pv d2d4 d7d5');
    parse('info depth 8 multipv 1 score cp 31 pv e2e4 e7e5');
    return parse('bestmove e2e4');
  };
  const updates = [];
  const result = await engine.search('fixture', [], 8, 2, { update: batch => updates.push(batch) });
  assert.deepEqual(updates.map(batch => batch.map(line => line.depth)), [[7, 7]]);
  assert.deepEqual(result.lines.map(line => line.depth), [8]);
  assert.equal(result.lines[0].pv[0], result.best);
});

test('Economy profile reuses the verified Stockfish 19 Lite worker with a smaller hash', async () => {
  const commands = [];
  const sources = [];
  class CapturingWorker extends respondingWorker() {
    postMessage(command) {
      commands.push(command);
      super.postMessage(command);
    }
  }
  const restore = installBrowserMocks({
    fetch: async source => {
      sources.push(String(source));
      return { ok: true, arrayBuffer: async () => new TextEncoder().encode('worker fixture').buffer };
    },
    Worker: CapturingWorker,
    verifiedEngine: true,
  });
  const engine = new Engine('economy');
  try {
    const profile = await engine.start();
    assert.equal(profile.name, 'Eco');
    assert.equal(profile.mode, 'economy');
    assert.equal(profile.version, '19.0.1');
    assert.equal(profile.file, 'stockfish-19-lite-single');
    assert.equal(profile.hash, 8);
    assert.equal(profile.threads, 1);
    assert.ok(commands.includes('setoption name Hash value 8'));
    assert.ok(commands.includes('setoption name Threads value 1'));
    assert.ok(sources.some(source => source.includes('stockfish-19-lite-single.js')));
  } finally {
    engine.dispose();
    restore();
  }
});

test('Economy analysis limits reduce search work without changing normal profiles', () => {
  assert.deepEqual(analysisLimits('economy', 'review', 18, 3), { depth: 12, lines: 3 });
  assert.deepEqual(analysisLimits('economy', 'live', 24, 5), { depth: 14, lines: 2 });
  assert.deepEqual(analysisLimits('lite', 'review', 18, 3), { depth: 18, lines: 3 });
  assert.deepEqual(analysisLimits('full', 'live', 24, 5), { depth: 24, lines: 5 });
});
