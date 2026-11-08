'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const MesaXpHistory = require('./xp-history');

describe('MesaXpHistory', () => {
  it('recusa ponto antes do intervalo mínimo', () => {
    const base = MesaXpHistory.empty();
    const t0 = 1_700_000_000_000;
    const first = MesaXpHistory.appendPoint(base, 0, t0, 1200, true);
    assert.equal(first.added, true);
    const early = MesaXpHistory.appendPoint(first.doc, 0, t0 + 5 * 60 * 1000, 1300, true);
    assert.equal(early.added, false);
    assert.equal(early.doc.bays[0].length, 1);
    const later = MesaXpHistory.appendPoint(first.doc, 0, t0 + MesaXpHistory.MIN_INTERVAL_MS, 1400, true);
    assert.equal(later.added, true);
    assert.equal(later.doc.bays[0].length, 2);
  });

  it('poda pontos com mais de 24 horas', () => {
    const now = Date.now();
    const doc = MesaXpHistory.normalize({
      v: 1,
      bays: [[
        { t: now - 25 * 60 * 60 * 1000, xpH: 100 },
        { t: now - 2 * 60 * 60 * 1000, xpH: 200 },
      ], [], [], []],
    });
    MesaXpHistory.pruneSeries(doc.bays[0], now);
    assert.equal(doc.bays[0].length, 1);
    assert.equal(doc.bays[0][0].xpH, 200);
  });

  it('JSON inválido vira documento vazio', () => {
    const doc = MesaXpHistory.parseJson('{ quebrado');
    assert.deepEqual(doc, MesaXpHistory.empty());
  });

  it('só grava com taxa finita e sessão', () => {
    const base = MesaXpHistory.empty();
    const t = Date.now();
    assert.equal(MesaXpHistory.appendPoint(base, 0, t, null, true).added, false);
    assert.equal(MesaXpHistory.appendPoint(base, 0, t, Number.NaN, true).added, false);
    assert.equal(MesaXpHistory.appendPoint(base, 0, t, 500, false).added, false);
    assert.equal(MesaXpHistory.appendPoint(base, 0, t, 500, true).added, true);
  });
});
