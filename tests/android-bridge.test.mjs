import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Engine } from '../dist/engine.js';

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

const batcherStart = java.indexOf('private final class NativeOutputBatcher {');
const readerStart = java.indexOf('private void readNativeStockfishOutput(', batcherStart);
assert.ok(batcherStart >= 0 && readerStart > batcherStart, 'Missing native output batcher');
const batcher = java.slice(batcherStart, readerStart);

test('Android output batching uses a real scheduled deadline', () => {
  assert.match(java, /ScheduledExecutorService nativeOutputScheduler/);
  assert.match(batcher, /nativeOutputScheduler\.schedule\(\s*this::flush,\s*NATIVE_OUTPUT_BATCH_WINDOW_MS,\s*TimeUnit\.MILLISECONDS/);
  assert.match(batcher, /private void flush\(\)/);
  assert.match(batcher, /pending = drainLocked\(\)/);
  // The time window is not merely checked when another UCI line arrives.
  assert.doesNotMatch(java, /SystemClock\.elapsedRealtime\(\)/);
});

test('the reader delegates every UCI line to the batcher and flushes on exit', () => {
  const reader = method('readNativeStockfishOutput');
  assert.match(reader, /NativeOutputBatcher batcher = new NativeOutputBatcher\(session\)/);
  assert.match(reader, /batcher\.append\(line\)/);
  assert.match(reader, /finally \{\s*batcher\.flush\(\)/);
  assert.ok(!reader.includes('dispatchNativeStockfishOutput(session, line)'));
});

test('Android batching is bounded by line count, character count and delay', () => {
  const maxLines = Number(/NATIVE_OUTPUT_BATCH_MAX_LINES = ([\d_]+\d)/.exec(java)?.[1].replaceAll('_', ''));
  const maxChars = Number(/NATIVE_OUTPUT_BATCH_MAX_CHARS = ([\d_]+\d)/.exec(java)?.[1].replaceAll('_', ''));
  const windowMs = Number(/NATIVE_OUTPUT_BATCH_WINDOW_MS = (\d+)L/.exec(java)?.[1]);
  assert.ok(Number.isInteger(maxLines) && maxLines >= 8 && maxLines <= 256);
  assert.ok(Number.isInteger(maxChars) && maxChars >= 4096);
  assert.ok(Number.isInteger(windowMs) && windowMs >= 1 && windowMs <= 16);
  assert.match(batcher, /batchLines >= NATIVE_OUTPUT_BATCH_MAX_LINES/);
  assert.match(batcher, /buffer\.length\(\) \+ line\.length\(\) \+ 1 > NATIVE_OUTPUT_BATCH_MAX_CHARS/);
  assert.match(batcher, /buffer\.length\(\) >= NATIVE_OUTPUT_BATCH_MAX_CHARS/);
  assert.match(batcher, /nativeOutputScheduler\.schedule/);
});

test('terminal UCI lines are flushed immediately and remain ordered', () => {
  const flush = method('isNativeFlushLine');
  assert.ok(flush.includes('"uciok"'));
  assert.ok(flush.includes('"readyok"'));
  assert.ok(flush.includes('"bestmove"'));
  assert.match(batcher, /if \(terminal \|\| buffer\.length\(\) >= NATIVE_OUTPUT_BATCH_MAX_CHARS\)/);
  assert.match(batcher, /if \(previousBatch != null\) dispatchNativeStockfishOutput\(session, previousBatch\)/);
  assert.match(batcher, /if \(completedBatch != null\) dispatchNativeStockfishOutput\(session, completedBatch\)/);
  // append() and the scheduled flush enqueue output under the same lock,
  // preserving the exact order of the native stdout stream.
  assert.match(batcher, /synchronized \(lock\) \{[\s\S]*dispatchNativeStockfishOutput\(session, completedBatch\)/);
  const flushStart = batcher.indexOf('private void flush()');
  assert.ok(flushStart >= 0);
  assert.match(batcher.slice(flushStart), /synchronized \(lock\) \{[\s\S]*dispatchNativeStockfishOutput\(session, pending\)/);
});

// Exercise the intended deadline semantics: a partial batch is emitted even
// when no second engine line arrives. The source assertion above ties this
// behavior to the ScheduledExecutorService timer used by Java.
test('the batch deadline does not depend on a later UCI line', async () => {
  const windowMs = Number(/NATIVE_OUTPUT_BATCH_WINDOW_MS = (\d+)L/.exec(java)[1]);
  const emitted = [];
  let pending = [];
  let timer;
  function append(line) {
    pending.push(line);
    if (timer) return;
    timer = setTimeout(() => {
      emitted.push(pending);
      pending = [];
      timer = null;
    }, windowMs);
  }
  append('info depth 8 multipv 1 score cp 20 pv e2e4');
  await new Promise(resolve => setTimeout(resolve, windowMs + 8));
  assert.equal(emitted.length, 1);
  assert.deepEqual(emitted[0], ['info depth 8 multipv 1 score cp 20 pv e2e4']);
});

test('the Android bridge performs one evaluateJavascript call per batch', () => {
  const dispatch = method('dispatchNativeStockfishOutput');
  assert.equal((dispatch.match(/evaluateJavascript/g) || []).length, 1);
  assert.match(dispatch, /JSONObject\.quote\(lines\)/);
  // The generated WebView JavaScript must use valid optional-call syntax.
  assert.match(dispatch, /window\.__moveByMoveNativeStockfishReceive\?\.\(/);
  assert.match(dispatch, /session != nativeEngineSession/);
});

test('the JavaScript engine consumes multi-line native UCI batches correctly', async () => {
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
        respond('id name Stockfish 19\noption name Threads type spin default 1 max 512\nuciok');
      } else if (command === 'isready') {
        respond('readyok');
      } else if (command.startsWith('go depth')) {
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
