'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const MesaHuntRank = require('../renderer/hunt-rank.js');

const NOW = 1_000_000;
const OFFSET = 500;

function summary(overrides) {
  return Object.assign({
    centroLivreEm: null,
    serverOffsetMs: OFFSET,
    trocaHuntLivreEm: null,
    semCena: false,
    waveClear: false,
    ondaSeq: 0,
    combateOndaSeq: 0,
    safariDentro: false,
  }, overrides);
}

describe('MesaHuntRank.pick', () => {
  it('mantém o limiar de 8% para move', () => {
    const estimates = [
      { hunt: { s: 'a', n: 'A' }, xpTrainerPerHour: 108 },
      { hunt: { s: 'b', n: 'B' }, xpTrainerPerHour: 116 },
    ];
    const allowed = new Set(['a', 'b']);
    const stay = MesaHuntRank.pick(estimates, 'a', allowed);
    assert.equal(stay.move, false);
    assert.equal(stay.slug, 'a');
    const move = MesaHuntRank.pick([
      { hunt: { s: 'a', n: 'A' }, xpTrainerPerHour: 100 },
      { hunt: { s: 'b', n: 'B' }, xpTrainerPerHour: 109 },
    ], 'a', allowed);
    assert.equal(move.move, true);
    assert.equal(move.slug, 'b');
  });
});

describe('MesaHuntRank.switchBlocked', () => {
  it('bloqueia com carimbo de combate no futuro', () => {
    const hunt = summary({ centroLivreEm: NOW + OFFSET + 2000 });
    assert.equal(MesaHuntRank.switchBlocked(hunt, NOW), true);
  });

  it('libera entre ondas com cena ligada quando combateOndaSeq < ondaSeq', () => {
    const hunt = summary({
      centroLivreEm: NOW + OFFSET + 5000,
      ondaSeq: 3,
      combateOndaSeq: 2,
      semCena: false,
    });
    assert.equal(MesaHuntRank.switchBlocked(hunt, NOW), false);
  });

  it('não libera combateOndaSeq < ondaSeq no modo sem cena', () => {
    const hunt = summary({
      centroLivreEm: NOW + OFFSET + 5000,
      ondaSeq: 3,
      combateOndaSeq: 2,
      semCena: true,
    });
    assert.equal(MesaHuntRank.switchBlocked(hunt, NOW), true);
  });

  it('libera waveClear só com cena ligada', () => {
    const open = summary({ waveClear: true, semCena: false, centroLivreEm: NOW + OFFSET + 9000 });
    assert.equal(MesaHuntRank.switchBlocked(open, NOW), false);
    const closed = summary({ waveClear: true, semCena: true, centroLivreEm: NOW + OFFSET + 9000 });
    assert.equal(MesaHuntRank.switchBlocked(closed, NOW), true);
  });

  it('bloqueia pela porta de 10 s mesmo com onda livre', () => {
    const hunt = summary({
      combateOndaSeq: 1,
      ondaSeq: 2,
      trocaHuntLivreEm: NOW + OFFSET + 8000,
      semCena: false,
    });
    assert.equal(MesaHuntRank.switchBlocked(hunt, NOW), true);
  });

  it('bloqueia no Safari', () => {
    const hunt = summary({ safariDentro: true, combateOndaSeq: 0, ondaSeq: 5 });
    assert.equal(MesaHuntRank.switchBlocked(hunt, NOW), true);
  });
});
