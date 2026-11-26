import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../dist/engine.js';
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
