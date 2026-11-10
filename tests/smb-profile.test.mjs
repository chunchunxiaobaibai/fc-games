import assert from 'node:assert/strict';
import test from 'node:test';
import { bindingPresets, defaultBindings, defaultProfile, parseProfile, rebind } from '../src/pages/play/smb/smb-profile.ts';

const levels = ['1-1', '1-2'];

test('a remap preserves other actions and rejects collisions and reserved keys', () => {
  const { bindings } = rebind(defaultBindings, 'jump', 'KeyJ');
  assert.deepEqual(bindings.jump, ['KeyJ', 'ArrowUp', 'KeyZ', 'KeyW']);
  assert.deepEqual(bindings.right, defaultBindings.right);
  assert.match(rebind(bindings, 'right', 'KeyJ').error, /跳跃/);
  assert.ok(rebind(bindings, 'jump', 'Tab').error);
  assert.ok(rebind(bindings, 'jump', 'Escape').error);
  assert.deepEqual(rebind(bindings, 'pause', 'Escape').bindings.pause, ['Escape']);
});

test('a backup key preserves the main key and both presets survive a save round trip', () => {
  const { bindings } = rebind(bindingPresets.wasd, 'jump', 'KeyJ', 'alternate');
  assert.deepEqual(bindings.jump, ['KeyW', 'KeyJ']);
  assert.ok(rebind(bindings, 'jump', 'KeyW', 'alternate').error);
  assert.match(rebind(bindings, 'jump', 'KeyD', 'alternate').error, /向右移动/);
  for (const keys of [bindings, ...Object.values(bindingPresets)]) {
    const saved = JSON.parse(JSON.stringify({ ...defaultProfile(), bindings: keys }));
    assert.deepEqual(parseProfile(saved, levels).bindings, keys);
  }
});

test('the profile restores a remap and a level checkpoint and validates damaged saves', () => {
  const checkpoint = { level: '1-2', lives: 2, score: 12300, coins: 8, power: 'fire' };
  const bindings = rebind(defaultBindings, 'jump', 'KeyJ').bindings;
  const saved = { ...defaultProfile(), bindings, startingLevel: '1-2', startingLives: 5,
    cleared: ['1-1', '1-1', 'future'], checkpoint };
  assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(saved)), levels), { ...saved, cleared: ['1-1'] });
  assert.equal(parseProfile({ ...saved, checkpoint: { ...checkpoint, lives: 0 } }, levels).checkpoint, null);
  assert.equal(parseProfile({ ...saved, startingLevel: '9-1' }, levels).startingLevel, '1-1');
  assert.deepEqual(parseProfile({ ...saved, version: 2 }, levels), defaultProfile());
  const invalid = { ...bindings, jump: ['KeyD'] };
  assert.deepEqual(parseProfile({ ...saved, bindings: invalid }, levels).bindings, defaultBindings);
});
