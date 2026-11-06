'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Carrega só os trechos da página num contexto isolado. Sem DOM: os scripts não tocam em window.
function ler(nome) {
  return fs.readFileSync(path.join(__dirname, nome), 'utf8');
}

const API = vm.runInNewContext([
  ler('hunt-page-switch-gate.js'),
  ler('hunt-page-state.js'),
  ler('hunt-page-live.js'),
  '({ createHuntReader, livePatchFromEstado });',
].join('\n'));

// Copia o resultado para o realm deste teste, para o deepEqual comparar protótipos iguais.
function nesteRealm(valor) {
  return valor === null || valor === undefined ? valor : JSON.parse(JSON.stringify(valor));
}

describe('livePatchFromEstado', () => {
  it('welcome com bloco da Twitch leva os campos e completo', () => {
    const patch = API.livePatchFromEstado({
      servidorAgora: 5000,
      twitch: { vinculado: true, login: 'a', bonus: { xp: 1, captura: 0, shiny: 0 }, pct: 15, minutos: 60 },
    }, true);
    assert.deepEqual(nesteRealm(patch), {
      twitch: { vinculado: true, login: 'a', bonus: { xp: 1, captura: 0, shiny: 0 }, pct: 15, minutos: 60 },
      servidorAgora: 5000,
      completo: true,
    });
  });

  it('estado sem twitch e sem kick não gera patch', () => {
    assert.equal(API.livePatchFromEstado({ level: 3 }, false), null);
  });

  it('twitch: null vira desligado', () => {
    assert.deepEqual(nesteRealm(API.livePatchFromEstado({ twitch: null }, false)), { twitch: { desligado: true } });
  });

  it('servidorAgora só vai junto com bloco ou com completo', () => {
    assert.equal(API.livePatchFromEstado({ servidorAgora: 5 }, false), null);
    assert.deepEqual(nesteRealm(API.livePatchFromEstado({ servidorAgora: 5, kick: { pct: 3 } }, false)), {
      kick: { pct: 3 },
      servidorAgora: 5,
    });
  });

  it('welcome sem twitch manda só completo e o relógio', () => {
    assert.deepEqual(nesteRealm(API.livePatchFromEstado({ servidorAgora: 5 }, true)), { servidorAgora: 5, completo: true });
  });

  it('campos fora da lista não passam para o patch', () => {
    const patch = API.livePatchFromEstado({ twitch: { login: 'a', accessToken: 'x' } }, false);
    assert.equal('accessToken' in patch.twitch, false);
  });
});

describe('createHuntReader().twitchPctNow', () => {
  it('XP ativo devolve o pct do bloco', () => {
    const reader = API.createHuntReader();
    reader.applyEstado({
      servidorAgora: Date.now(),
      twitch: { pct: 15, bonus: { xp: Date.now() + 3600000, captura: 0, shiny: 0 } },
    }, true);
    assert.equal(reader.twitchPctNow(), 15);
  });

  it('XP vencido devolve zero, medido pelo relógio do servidor', () => {
    const reader = API.createHuntReader();
    reader.applyEstado({
      servidorAgora: Date.now(),
      twitch: { pct: 15, bonus: { xp: Date.now() - 1000, captura: 0, shiny: 0 } },
    }, true);
    assert.equal(reader.twitchPctNow(), 0);
  });

  it('bloco sem bônus devolve zero', () => {
    const reader = API.createHuntReader();
    reader.applyEstado({ servidorAgora: Date.now(), twitch: { pct: 15 } }, true);
    assert.equal(reader.twitchPctNow(), 0);
  });

  it('twitch null zera o bônus que estava ativo', () => {
    const reader = API.createHuntReader();
    reader.applyEstado({
      servidorAgora: Date.now(),
      twitch: { pct: 15, bonus: { xp: Date.now() + 3600000, captura: 0, shiny: 0 } },
    }, true);
    reader.applyEstado({ servidorAgora: Date.now(), twitch: null }, false);
    assert.equal(reader.twitchPctNow(), 0);
  });
});

describe('welcome zera o bônus anterior (S5)', () => {
  it('um welcome sem a chave twitch zera o bônus que estava ativo', () => {
    const reader = API.createHuntReader();
    reader.applyEstado({
      servidorAgora: Date.now(),
      twitch: { pct: 15, bonus: { xp: Date.now() + 3600000, captura: 0, shiny: 0 } },
    }, true);
    assert.equal(reader.twitchPctNow(), 15);
    reader.applyEstado({ servidorAgora: Date.now() }, true);
    assert.equal(reader.twitchPctNow(), 0);
  });
});
