import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearMateCelebration } from '../dist/board-ui.js';

function particle() {
  return { className: 'mate-particle', removed: false, remove() { this.removed = true; } };
}

function layerWith(...children) {
  return {
    children,
    querySelectorAll(selector) {
      assert.equal(selector, '.mate-particle');
      return this.children.filter(child => child.className === 'mate-particle');
    },
  };
}

test('mate celebration cleanup removes every stale particle from the reused layer', () => {
  const oldParticles = Array.from({ length: 24 }, particle);
  const unrelated = { className: 'mate-title', removed: false, remove() { this.removed = true; } };
  const layer = layerWith(...oldParticles, unrelated);
  clearMateCelebration(layer);
  assert.ok(oldParticles.every(item => item.removed));
  assert.equal(unrelated.removed, false);
});

test('mate celebration cleanup is safe when no layer or particles exist', () => {
  assert.doesNotThrow(() => clearMateCelebration(null));
  assert.doesNotThrow(() => clearMateCelebration(layerWith()));
});
