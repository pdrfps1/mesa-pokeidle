'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const MesaBayAudio = require('./bay-audio.js');

describe('MesaBayAudio.calls', () => {
  it('índice 0 mudo devolve só a baía 0 com muted true', () => {
    const bays = [{ muted: true }, { muted: false }];
    assert.deepEqual(MesaBayAudio.calls(bays, 0), [{ index: 0, muted: true }]);
  });

  it('índice 0 não mudo devolve muted false e não inclui a baía 1', () => {
    const bays = [{ muted: false }, { muted: true }];
    assert.deepEqual(MesaBayAudio.calls(bays, 0), [{ index: 0, muted: false }]);
  });

  it('índice 1 não mudo devolve só essa baía mesmo com a 0 muda', () => {
    const bays = [{ muted: true }, { muted: false }];
    assert.deepEqual(MesaBayAudio.calls(bays, 1), [{ index: 1, muted: false }]);
  });

  it('índice inválido devolve lista vazia', () => {
    const bays = [{ muted: true }, { muted: false }];
    assert.deepEqual(MesaBayAudio.calls(bays, -1), []);
    assert.deepEqual(MesaBayAudio.calls(bays, 2), []);
    assert.deepEqual(MesaBayAudio.calls(bays, 1.5), []);
    assert.deepEqual(MesaBayAudio.calls(bays, null), []);
  });
});
