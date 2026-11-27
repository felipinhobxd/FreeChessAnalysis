import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Engine } from '../dist/engine.js';

// The Android reader thread groups native Stockfish output lines and crosses
// the Java -> JavaScript bridge once per batch. These tests pin the two sides
// of that contract: the Java source must implement the batching policy, and
// the JavaScript receiver must consume exactly the batched payloads the Java
// side emits, without any protocol change.
const java = await readFile(
  new URL('../android/app/src/main/java/com/movebymove/android/MainActivity.java', import.meta.url),
  'utf8');

function method(name) {
  const start = java.indexOf('private void ' + name + '(') >= 0
    ? java.indexOf('private void ' + name + '(')
    : java.indexOf('private static boolean ' + name + '(');
  assert.ok(start >= 0, 'Missing method: ' + name);
  const next = java.indexOf('\n    private ', start + 1);
  return java.slice(start, next < 0 ? undefined : next);
}

test('the Android reader groups output lines into one bridge crossing per batch', () => {
  const reader = method('readNativeStockfishOutput');
  // Lines are accumulated in a batch buffer and dispatched as one payload.
  assert.match(reader, /StringBuilder batch = new StringBuilder/);
  assert.match(reader, /batch\.append\(line\)\.append\('\\n'\)/);
  // The reader itself never dispatches a single raw line anymore.
  assert.ok(!reader.includes('dispatchNativeStockfishOutput(session, line)'));
  // Every dispatch sends the accumulated batch, without its trailing newline.
  assert.ok((reader.match(/dispatchNativeStockfishOutput\(session, batch\.substring\(0, batch\.length\(\) - 1\)\)/g) || []).length >= 2);
  // The batch is flushed once more when the stream ends.
  assert.match(reader, /finally \{\s*if \(batchLines > 0\)/);
});

test('one evaluateJavascript crossing per dispatched batch on the Android bridge', () => {
  const dispatch = method('dispatchNativeStockfishOutput');
  assert.equal((dispatch.match(/evaluateJavascript/g) || []).length, 1);
  assert.match(dispatch, /JSONObject\.quote\(lines\)/);
  assert.match(dispatch, /session != nativeEngineSession/);
});

test('the Android bridge flushes immediately on synchronization and terminal lines', () => {
  const flush = method('isNativeFlushLine');
  assert.ok(flush.includes('"uciok"'));
  assert.ok(flush.includes('"readyok"'));
  assert.ok(flush.includes('"bestmove"'));
  // The reader consults the flush flag both before and after appending a line,
  // so a terminal line never waits for the latency window.
  const reader = method('readNativeStockfishOutput');
  assert.match(reader, /final boolean flush = isNativeFlushLine\(line\)/);
  assert.match(reader, /else if \(flush\b/);
  assert.match(reader, /if \(flush\) \{/);
});

test('the Android bridge bounds every batch by line count, size and latency window', () => {
  const maxLines = Number(/NATIVE_OUTPUT_BATCH_MAX_LINES = ([\d_]+\d)/.exec(java)?.[1].replaceAll('_', ''));
  const maxChars = Number(/NATIVE_OUTPUT_BATCH_MAX_CHARS = ([\d_]+\d)/.exec(java)?.[1].replaceAll('_', ''));
  const windowMs = Number(/NATIVE_OUTPUT_BATCH_WINDOW_MS = (\d+)L/.exec(java)?.[1]);
  assert.ok(Number.isInteger(maxLines) && maxLines >= 8 && maxLines <= 256);
  assert.ok(Number.isInteger(maxChars) && maxChars >= 4096);
  assert.ok(Number.isInteger(windowMs) && windowMs >= 1 && windowMs <= 16);
  const reader = method('readNativeStockfishOutput');
  assert.ok(reader.includes('batchLines >= NATIVE_OUTPUT_BATCH_MAX_LINES'));
  assert.ok(reader.includes('batch.length() + line.length() + 1 > NATIVE_OUTPUT_BATCH_MAX_CHARS'));
  assert.ok(reader.includes('>= NATIVE_OUTPUT_BATCH_WINDOW_MS'));
  assert.match(reader, /SystemClock\.elapsedRealtime\(\)/);
});

test('the Java batching policy preserves order and isolates terminal lines (mirrored from source)', () => {
  const maxLines = Number(/NATIVE_OUTPUT_BATCH_MAX_LINES = ([\d_]+\d)/.exec(java)[1].replaceAll('_', ''));
  const maxChars = Number(/NATIVE_OUTPUT_BATCH_MAX_CHARS = ([\d_]+\d)/.exec(java)[1].replaceAll('_', ''));
  const windowMs = Number(/NATIVE_OUTPUT_BATCH_WINDOW_MS = (\d+)L/.exec(java)[1]);
  // Mirror of the reader loop, driven by the constants parsed from the Java
  // source, to document the batch semantics the JavaScript side relies on.
  function batch(input) {
    const batches = [];
    let current = [];
    let openedAt = null;
    let chars = 0;
    for (const { line, at } of input) {
      const flush = line === 'uciok' || line === 'readyok' || line.startsWith('bestmove');
      if (current.length === 0) {
        openedAt = at;
      } else if (flush || current.length >= maxLines
          || chars + line.length + 1 > maxChars || at - openedAt >= windowMs) {
        batches.push(current);
        current = [];
        openedAt = at;
        chars = 0;
      }
      current.push(line);
      chars += line.length + 1;
      if (flush) {
        batches.push(current);
        current = [];
        chars = 0;
      }
    }
    if (current.length) batches.push(current);
    return batches;
  }
  const info = n => 'info depth 8 multipv 1 score cp 20 pv e2e4 e7e5 ' + 'x'.repeat(n);
  const lines = [];
  let t = 0;
  for (let index = 0; index < 40; index++) lines.push({ line: info(index % 3 === 0 ? 900 : 40), at: (t += 0.2) });
  lines.push({ line: 'bestmove e2e4', at: (t += 0.2) });
  const batches = batch(lines);
  // Order and completeness are preserved across every batch boundary.
  assert.deepEqual(batches.flat(), lines.map(item => item.line));
  // Terminal lines are flushed immediately and travel alone.
  assert.deepEqual(batches.at(-1), ['bestmove e2e4']);
  // A latency gap splits the stream even under the line limit.
  const withGap = batch([
    { line: info(40), at: 0 },
    { line: info(40), at: windowMs + 1 },
  ]);
  assert.equal(withGap.length, 2);
});

test('the JavaScript engine consumes batched native output exactly as the bridge emits it', async () => {
  const originalBridge = Object.getOwnPropertyDescriptor(globalThis, 'MoveByMoveAndroid');
  const commands = [];
  const respond = payload => {
    queueMicrotask(() => globalThis.__moveByMoveNativeStockfishReceive?.(payload));
  };
  const bridge = {
    supportsNativeStockfish: () => true,
    startNativeStockfish: () => true,
    sendNativeStockfishCommand(command) {
      commands.push(command);
      if (command === 'uci') {
        // One batch: identity, options and the uciok synchronization line,
        // joined with line breaks exactly like the Java batcher does.
        respond('id name Stockfish 19\noption name Threads type spin default 1 min 1 max 512\nuciok');
      } else if (command === 'isready') {
        respond('readyok');
      } else if (command.startsWith('go depth')) {
        // Multi-line info batches across depths, then bestmove flushed alone.
        respond('info depth 7 multipv 1 score cp 20 pv e2e4 e7e5\n'
            + 'info depth 7 multipv 2 score cp 10 pv d2d4 d7d5');
        respond('info depth 8 multipv 1 score cp 30 pv e2e4 e7e5\n'
            + 'info depth 8 multipv 2 score cp 15 pv d2d4 d7d5');
        respond('bestmove e2e4');
      }
      return true;
    },
    stopNativeStockfish: () => {},
  };
  Object.defineProperty(globalThis, 'MoveByMoveAndroid', { configurable: true, value: bridge });

  const engine = new Engine('full');
  try {
    const initialized = await engine.start();
    assert.equal(initialized.native, true);
    assert.equal(initialized.name, 'ARM64 nativo');

    const updates = [];
    const searched = await engine.search(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      [], 8, 2,
      { update: batch => updates.push(batch.map(line => line.depth)) },
    );
    // Depth batches are split correctly out of the joined payloads.
    assert.deepEqual(updates, [[7, 7], [8, 8]]);
    assert.equal(searched.best, 'e2e4');
    assert.deepEqual(searched.lines.map(line => line.depth), [8, 8]);
    assert.deepEqual(searched.lines.map(line => line.pv[0]), ['e2e4', 'd2d4']);
    assert.ok(commands.includes('setoption name Threads value ' + initialized.threads));
  } finally {
    engine.dispose();
    if (originalBridge) Object.defineProperty(globalThis, 'MoveByMoveAndroid', originalBridge);
    else delete globalThis.MoveByMoveAndroid;
  }
});
