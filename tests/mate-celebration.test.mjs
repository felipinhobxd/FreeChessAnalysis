import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearMateCelebration } from '../dist/board-ui.js';

function layerWithParticles(count) {
  const layer = {
    children: [],
    querySelectorAll(selector) {
      assert.equal(selector, '.mate-particle');
      return this.children.filter(child => child.className === 'mate-particle');
    },
  };
  for (let index = 0; index < count; index++) {
    const particle = {
      className: 'mate-particle',
      remove() { layer.children = layer.children.filter(child => child !== particle); },
    };
    layer.children.push(particle);
  }
  layer.children.push({ className: 'mate-title' });
  return layer;
}

test('mate celebration cleanup removes every stale particle from the reused layer', () => {
  const layer = layerWithParticles(24);
  clearMateCelebration(layer);
  assert.equal(layer.children.filter(child => child.className === 'mate-particle').length, 0);
  assert.equal(layer.children.length, 1);
});

test('mate celebration cleanup is safe when no layer or particles exist', () => {
  assert.doesNotThrow(() => clearMateCelebration(null));
  assert.doesNotThrow(() => clearMateCelebration(layerWithParticles(0)));
});
