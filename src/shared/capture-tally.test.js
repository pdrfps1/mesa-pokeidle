'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const tally = require('./capture-tally');

const rel = (normal, shiny) => ({ normal, shiny });

describe('empty', () => {
  it('devolve a forma zerada', () => {
    assert.deepEqual(tally.empty(), {
      normal: 0, shiny: 0, lastNormalAt: null, lastShinyAt: null, seen: { normal: 0, shiny: 0 }, nick: '', melhor: null,
    });
  });
});

describe('apply', () => {
  it('soma o delta de normais e grava a hora', () => {
    const next = tally.apply(tally.empty(), rel(2, 0), 'ash', 1000);
    assert.equal(next.normal, 2);
    assert.equal(next.shiny, 0);
    assert.equal(next.lastNormalAt, 1000);
    assert.equal(next.lastShinyAt, null);
  });

  it('soma o delta de shiny e grava a hora só dele', () => {
    const next = tally.apply(tally.empty(), rel(0, 1), 'ash', 1000);
    assert.equal(next.shiny, 1);
    assert.equal(next.lastShinyAt, 1000);
    assert.equal(next.lastNormalAt, null);
  });

  it('relatório repetido não soma e não muda a hora', () => {
    const first = tally.apply(tally.empty(), rel(3, 1), 'ash', 1000);
    const again = tally.apply(first, rel(3, 1), 'ash', 2000);
    assert.equal(again.normal, 3);
    assert.equal(again.shiny, 1);
    assert.equal(again.lastNormalAt, 1000);
    assert.equal(again.lastShinyAt, 1000);
  });

  it('recarga da página (contador menor) soma o valor atual inteiro', () => {
    const first = tally.apply(tally.empty(), rel(5, 0), 'ash', 1000);
    const reloaded = tally.apply(first, rel(2, 0), 'ash', 2000);
    assert.equal(reloaded.normal, 7);
    assert.equal(reloaded.lastNormalAt, 2000);
  });

  it('relatório perdido não perde: o próximo cumulativo traz a diferença', () => {
    const first = tally.apply(tally.empty(), rel(1, 0), 'ash', 1000);
    const later = tally.apply(first, rel(4, 0), 'ash', 3000);
    assert.equal(later.normal, 4);
    assert.equal(later.lastNormalAt, 3000);
  });

  it('troca de nick zera o acumulado e grava o relatório atual como visto', () => {
    const first = tally.apply(tally.empty(), rel(4, 2), 'ash', 1000);
    const switched = tally.apply(first, rel(6, 2), 'misty', 2000);
    assert.equal(switched.normal, 0);
    assert.equal(switched.shiny, 0);
    assert.equal(switched.lastNormalAt, null);
    assert.equal(switched.lastShinyAt, null);
    assert.deepEqual(switched.seen, { normal: 6, shiny: 2 });
    assert.equal(switched.nick, 'misty');
    const after = tally.apply(switched, rel(7, 2), 'misty', 3000);
    assert.equal(after.normal, 1);
  });

  it('nick vazio não dispara troca', () => {
    const first = tally.apply(tally.empty(), rel(2, 0), 'ash', 1000);
    const blank = tally.apply(first, rel(3, 0), '', 2000);
    assert.equal(blank.normal, 3);
    assert.equal(blank.nick, 'ash');
  });

  it('entrada inválida devolve o tally intacto', () => {
    const base = tally.apply(tally.empty(), rel(1, 1), 'ash', 1000);
    for (const bad of [null, undefined, 'x', 7, [], {}, { normal: 1 }, rel(-1, 0), rel(1.5, 0), rel('2', 0)]) {
      assert.equal(tally.apply(base, bad, 'ash', 2000), base);
    }
  });

  it('não muta a entrada e devolve objeto novo', () => {
    const base = tally.empty();
    const snapshot = JSON.stringify(base);
    const next = tally.apply(base, rel(2, 1), 'ash', 1000);
    assert.notEqual(next, base);
    assert.equal(JSON.stringify(base), snapshot);
  });
});

describe('apply com o limite 1e9', () => {
  it('relatório com 1e9+1 devolve o tally intacto', () => {
    const base = tally.apply(tally.empty(), rel(5, 0), 'ash', 1000);
    assert.equal(tally.apply(base, rel(1e9 + 1, 0), 'ash', 2000), base);
    assert.equal(tally.apply(base, rel(0, 1e9 + 1), 'ash', 2000), base);
  });

  it('relatório com 1e9 soma normalmente', () => {
    const next = tally.apply(tally.empty(), rel(1e9, 1e9), 'ash', 1000);
    assert.equal(next.normal, 1e9);
    assert.equal(next.shiny, 1e9);
    assert.equal(next.lastNormalAt, 1000);
    assert.equal(next.lastShinyAt, 1000);
  });
});

describe('cleanCapturaReport', () => {
  it('aceita contadores inteiros válidos e devolve cópia limpa', () => {
    assert.deepEqual(tally.cleanCapturaReport(rel(3, 1)), { normal: 3, shiny: 1 });
    assert.deepEqual(tally.cleanCapturaReport(rel(0, 0)), { normal: 0, shiny: 0 });
  });

  it('aceita exatamente 1e9 na borda', () => {
    assert.deepEqual(tally.cleanCapturaReport(rel(1e9, 1e9)), { normal: 1e9, shiny: 1e9 });
  });

  it('recusa acima de 1e9, negativo, string, float, NaN, Infinity, array, null e ausente', () => {
    const bad = [
      rel(1e9 + 1, 0), rel(0, 1e9 + 1),
      rel(-1, 0), rel(0, -1),
      rel('2', 0), rel(0, '2'),
      rel(1.5, 0), rel(0, 2.5),
      rel(NaN, 0), rel(0, Infinity),
      rel([1], 0), rel(0, null),
      { normal: 1 }, { shiny: 1 }, {},
      null, undefined, 'x', 7, [],
    ];
    for (const raw of bad) assert.equal(tally.cleanCapturaReport(raw), null);
  });

  it('não confunde relatório inválido com zero: apply mantém a base', () => {
    const base = tally.apply(tally.empty(), rel(5, 0), 'ash', 1000);
    assert.equal(tally.apply(base, tally.cleanCapturaReport(rel(-1, 0)), 'ash', 2000), base);
  });
});

describe('mais forte', () => {
  const forte = { nome: 'Tyranitar', level: 50, ivSum: 186, shiny: false };
  const fraco = { nome: 'Magikarp', level: 5, ivSum: 90, shiny: false };
  const com = (melhor) => ({ normal: 1, shiny: 0, melhor });

  it('guarda o mais forte e não troca por um mais fraco', () => {
    let t = tally.apply(tally.empty(), com(forte), 'ash', 1000);
    t = tally.apply(t, { normal: 2, shiny: 0, melhor: fraco }, 'ash', 2000);
    assert.equal(t.melhor.nome, 'Tyranitar');
  });

  it('empate de nível vai para a maior soma de IVs', () => {
    const t = tally.apply(tally.empty(), com({ nome: 'A', level: 50, ivSum: 100 }), 'ash', 1000);
    const next = tally.apply(t, { normal: 2, shiny: 0, melhor: { nome: 'B', level: 50, ivSum: 150 } }, 'ash', 2000);
    assert.equal(next.melhor.nome, 'B');
  });

  it('troca de conta zera o mais forte da baía', () => {
    const t = tally.apply(tally.empty(), com(forte), 'ash', 1000);
    const next = tally.apply(t, { normal: 1, shiny: 0 }, 'misty', 2000);
    assert.equal(next.melhor, null);
  });

  it('relatório sem o campo melhor mantém o que já havia', () => {
    const t = tally.apply(tally.empty(), com(forte), 'ash', 1000);
    assert.equal(tally.apply(t, rel(2, 0), 'ash', 2000).melhor.nome, 'Tyranitar');
  });
});
