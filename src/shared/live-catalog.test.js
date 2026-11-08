'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./live-catalog');

describe('sanitizeLivePatch', () => {
  it('descarta chaves desconhecidas e tokens', () => {
    const patch = L.sanitizeLivePatch({
      twitch: { accessToken: 'x', token: 'y', 'auth-token': 'z', login: 'Fulano', vinculado: true },
    });
    assert.deepEqual(Object.keys(patch.twitch).sort(), ['login', 'vinculado']);
    assert.equal(patch.twitch.login, 'Fulano');
  });

  it('login inválido vira vazio', () => {
    assert.equal(L.sanitizeLivePatch({ twitch: { login: 'a-b' } }).twitch.login, '');
  });

  it('recompensas com tipo ou custo ruim saem', () => {
    const patch = L.sanitizeLivePatch({
      twitch: {
        recompensas: [
          { tipo: 'xp', titulo: 'Bônus', custo: 300 },
          { tipo: 'lol', titulo: 'Bônus', custo: 1 },
          { tipo: 'xp', titulo: '', custo: 1 },
          { tipo: 'xp', titulo: 'Y', custo: 0 },
          { tipo: 'xp', titulo: 'Z', custo: 1.5 },
        ],
      },
    });
    assert.deepEqual(patch.twitch.recompensas, [{ tipo: 'xp', titulo: 'Bônus', custo: 300 }]);
  });

  it('oficiais mantêm ativo e aoVivo e perdem bonus', () => {
    const patch = L.sanitizeLivePatch({
      twitch: { oficiais: [{ login: 'canala', nome: 'A', aoVivo: true, ativo: true, bonus: true, espectadores: 7 }] },
    });
    const [oficial] = patch.twitch.oficiais;
    assert.equal(oficial.aoVivo, true);
    assert.equal(oficial.ativo, true);
    assert.equal(oficial.espectadores, 7);
    assert.equal('bonus' in oficial, false);
  });

  it('bônus com valor que não é inteiro >= 0 recusa o bloco inteiro: o patch não traz bonus', () => {
    const patch = L.sanitizeLivePatch({ twitch: { bonus: { xp: 1.5, captura: -2, shiny: 'x' } } });
    assert.equal('bonus' in patch.twitch, false);
  });

  it('pacotes fora de 1..100 saem e no máximo dez passam', () => {
    const patch = L.sanitizeLivePatch({ twitch: { pacotes: [0, 3, 101, 5, 1, 2, 3, 4, 5, 6, 7, 8, 9] } });
    // Corta em dez entradas e só então filtra: as dez primeiras são 0,3,101,5,1,2,3,4,5,6.
    assert.deepEqual(patch.twitch.pacotes, [3, 5, 1, 2, 3, 4, 5, 6]);
  });

  it('twitch vazio continua presente, para sinalizar que o bloco chegou', () => {
    const patch = L.sanitizeLivePatch({ twitch: {} });
    assert.deepEqual(patch, { twitch: {} });
  });

  it('servidorAgora e completo passam; servidorAgora ruim não passa', () => {
    assert.deepEqual(L.sanitizeLivePatch({ servidorAgora: 123, completo: true }), { servidorAgora: 123, completo: true });
    assert.equal(L.sanitizeLivePatch({ servidorAgora: 'x' }), null);
  });

  it('entrada que não é objeto dá null', () => {
    assert.equal(L.sanitizeLivePatch(null), null);
    assert.equal(L.sanitizeLivePatch('x'), null);
  });
});

describe('applyBayPatch', () => {
  it('mescla campo a campo', () => {
    let bay = L.emptyBayLive();
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { login: 'a', bonus: { xp: 5, captura: 0, shiny: 0 } } }), 0);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { pct: 15 } }), 0);
    assert.equal(bay.twitch.login, 'a');
    assert.equal(bay.twitch.bonus.xp, 5);
    assert.equal(bay.twitch.pct, 15);
    assert.equal(bay.twitch.recebido, true);
  });

  it('completo zera o bloco antes de aplicar', () => {
    let bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { login: 'a', bonus: { xp: 5, captura: 0, shiny: 0 } } }), 0);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ completo: true, twitch: { pct: 0 } }), 0);
    assert.equal(bay.twitch.login, '');
    // Após completo o bloco volta ao zero de sempre, mas sem leitura válida: bonusLido falso protege o resgate.
    assert.equal(bay.twitch.bonus.xp, 0);
    assert.equal(bay.twitch.bonusLido, false);
    assert.equal(bay.twitch.pct, 0);
  });

  it('desligado zera e deixa recebido em falso', () => {
    let bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { login: 'a' } }), 0);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { desligado: true } }), 0);
    assert.equal(bay.twitch.recebido, false);
    assert.equal(bay.twitch.login, '');
  });

  it('offsetMs vem do relógio do servidor', () => {
    const bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ servidorAgora: 1000 }), 400);
    assert.equal(bay.offsetMs, 600);
  });

  it('patch da Twitch não mexe na Kick', () => {
    let bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ kick: { pct: 5 } }), 0);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { pct: 9 } }), 0);
    assert.equal(bay.kick.pct, 5);
  });
});

describe('toPublicSnapshot', () => {
  it('kickAoVivo sem repetição e sem nada da Twitch', () => {
    const kick = { oficiais: [{ slug: 'k1', nome: 'K', aoVivo: true, espectadores: 3 }] };
    const bays = [
      { kick, twitch: L.emptyTwitchLive() },
      { kick, twitch: L.emptyTwitchLive() },
      L.emptyBayLive(),
    ];
    const snap = L.toPublicSnapshot(bays);
    assert.deepEqual(Object.keys(snap).sort(), ['bays', 'kickAoVivo']);
    assert.equal(snap.kickAoVivo.length, 1);
    assert.equal(snap.bays.length, 4);
    assert.equal(JSON.stringify(snap).includes('login'), false);
  });

  it('a Kick de cada baía aparece com pct e minutos', () => {
    const bays = [{ kick: { oficiais: [], pct: 12, minutos: 30 } }];
    assert.deepEqual(L.toPublicSnapshot(bays).bays[0].kick, { pct: 12, minutos: 30 });
  });
});

describe('bônus e leitura válida (rodada prazo)', () => {
  it('frame completo { xp: N } num bloco novo: bonusLido true, captura e shiny zero', () => {
    const bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ completo: true, twitch: { bonus: { xp: 5 } } }), 0);
    assert.equal(bay.twitch.bonusLido, true);
    assert.deepEqual(bay.twitch.bonus, { xp: 5, captura: 0, shiny: 0 });
  });

  it('frame parcial { xp: N } num bloco novo não vale como leitura: nada prova que captura acabou', () => {
    const bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { bonus: { xp: 5 } } }), 0);
    assert.equal(bay.twitch.bonusLido, false);
    assert.equal(bay.twitch.bonus.xp, 5);
  });

  it('frame parcial com todos os tipos vale como leitura', () => {
    const bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { bonus: { xp: 5, captura: 0, shiny: 0 } } }), 0);
    assert.equal(bay.twitch.bonusLido, true);
  });

  it('depois de uma leitura válida, frame parcial atualiza o prazo e mantém a leitura', () => {
    let bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ completo: true, twitch: { bonus: { xp: 5 } } }), 0);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { bonus: { xp: 9 } } }), 0);
    assert.equal(bay.twitch.bonusLido, true);
    assert.equal(bay.twitch.bonus.xp, 9);
  });

  it('frame sem bonus deixa bonusLido falso', () => {
    const bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { login: 'a' } }), 0);
    assert.equal(bay.twitch.bonusLido, false);
    assert.equal(bay.twitch.relogioLido, false);
  });

  it('sanitizar duas vezes não inventa zero e dá o mesmo resultado', () => {
    const raw = { twitch: { bonus: { xp: 5 } } };
    const uma = L.sanitizeLivePatch(raw);
    assert.deepEqual(L.sanitizeLivePatch(uma), uma);
    assert.deepEqual(uma.twitch.bonus, { xp: 5 });
  });

  it('{ xp: N } mantém captura e shiny anteriores e a leitura', () => {
    let bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { bonus: { xp: 5, captura: 3, shiny: 1 } } }), 0);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { bonus: { xp: 7 } } }), 0);
    assert.deepEqual(bay.twitch.bonus, { xp: 7, captura: 3, shiny: 1 });
    assert.equal(bay.twitch.bonusLido, true);
  });

  it('valor inválido mantém o anterior e não marca lido', () => {
    let bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { bonus: { xp: 5 } } }), 0);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { bonus: { xp: -1 } } }), 0);
    assert.equal(bay.twitch.bonus.xp, 5);
    const fresca = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { bonus: { xp: -1 } } }), 0);
    assert.equal(fresca.twitch.bonusLido, false);
    assert.deepEqual(fresca.twitch.bonus, { xp: 0, captura: 0, shiny: 0 });
  });

  it('completo e desligado limpam os dois flags', () => {
    let bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ completo: true, twitch: { bonus: { xp: 5 } }, servidorAgora: 1000 }), 0);
    assert.equal(bay.twitch.bonusLido, true);
    assert.equal(bay.twitch.relogioLido, true);
    const completo = L.applyBayPatch(bay, L.sanitizeLivePatch({ completo: true }), 0);
    assert.equal(completo.twitch.bonusLido, false);
    assert.equal(completo.twitch.relogioLido, false);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { bonus: { xp: 5 } }, servidorAgora: 1000 }), 0);
    const desligado = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { desligado: true } }), 0);
    assert.equal(desligado.twitch.bonusLido, false);
    assert.equal(desligado.twitch.relogioLido, false);
  });

  it('servidorAgora marca relogioLido', () => {
    const bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ servidorAgora: 1000 }), 400);
    assert.equal(bay.twitch.relogioLido, true);
    assert.equal(bay.offsetMs, 600);
  });
});

describe('copyBonusLive: chaves renomeadas não viram leitura válida (correção final)', () => {
  it('{ outra: 1 } não marca bonusLido e mantém o anterior', () => {
    let bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ completo: true, twitch: { bonus: { xp: 5 } } }), 0);
    bay = L.applyBayPatch(bay, L.sanitizeLivePatch({ twitch: { bonus: { outra: 1 } } }), 0);
    assert.equal(bay.twitch.bonus.xp, 5);
    assert.equal(bay.twitch.bonusLido, true);
    const fresca = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ completo: true, twitch: { bonus: { outra: 1 } } }), 0);
    assert.equal(fresca.twitch.bonusLido, false);
    assert.equal(fresca.twitch.bonus.xp, 0);
  });

  it('{ xp: N, outra: 1 } marca e aplica xp; a chave extra não atrapalha', () => {
    const bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ completo: true, twitch: { bonus: { xp: 9, outra: 1 } } }), 0);
    assert.equal(bay.twitch.bonusLido, true);
    assert.equal(bay.twitch.bonus.xp, 9);
  });

  it('{} em frame completo marca lido e não inventa tipo; em frame parcial não marca', () => {
    const bay = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ completo: true, twitch: { bonus: {} } }), 0);
    assert.equal(bay.twitch.bonusLido, true);
    assert.equal(bay.twitch.bonus.xp, 0);
    const parcial = L.applyBayPatch(L.emptyBayLive(), L.sanitizeLivePatch({ twitch: { bonus: {} } }), 0);
    assert.equal(parcial.twitch.bonusLido, false);
  });

  it('sanitizar duas vezes segue idempotente com chave extra', () => {
    const raw = { twitch: { bonus: { xp: 5, outra: 1 } } };
    const uma = L.sanitizeLivePatch(raw);
    assert.deepEqual(L.sanitizeLivePatch(uma), uma);
    assert.deepEqual(uma.twitch.bonus, { xp: 5 });
  });
});
