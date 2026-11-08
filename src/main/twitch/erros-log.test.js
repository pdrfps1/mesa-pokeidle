'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { caminhoPadrao, registrarErro, lerUltimosErros } = require('./erros-log');

const CHAVES_ESPERADAS = ['em', 'baia', 'tipo', 'motivo', 'fase', 'trava', 'clicou', 'pausado', 'detalhe'];
const AGORA = () => Date.UTC(2026, 10, 6, 12, 0, 0);

let raiz;
let caminho;

beforeEach(() => {
  raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'erros-log-'));
  caminho = path.join(raiz, 'logs', 'twitch-resgate.log');
});

afterEach(() => {
  fs.rmSync(raiz, { recursive: true, force: true });
});

describe('caminhoPadrao', () => {
  it('monta userData/logs/twitch-resgate.log', () => {
    assert.equal(caminhoPadrao(raiz), path.join(raiz, 'logs', 'twitch-resgate.log'));
  });
});

describe('registrarErro', () => {
  it('acrescenta uma linha JSON por chamada, com o ISO da hora', () => {
    registrarErro({ baia: 0, tipo: 'xp', motivo: 'indisponivel' }, { caminho, agora: AGORA });
    registrarErro({ baia: 1, tipo: 'captura', motivo: 'tempo' }, { caminho, agora: AGORA });
    const linhas = fs.readFileSync(caminho, 'utf8').split('\n').filter(Boolean);
    assert.equal(linhas.length, 2);
    const primeira = JSON.parse(linhas[0]);
    assert.equal(primeira.em, new Date(AGORA()).toISOString());
    assert.equal(primeira.baia, 0);
    assert.equal(primeira.motivo, 'indisponivel');
    assert.equal(JSON.parse(linhas[1]).tipo, 'captura');
  });

  it('cria a pasta quando ela falta e omite campos ausentes', () => {
    assert.equal(fs.existsSync(path.dirname(caminho)), false);
    registrarErro({ baia: 2, tipo: 'shiny' }, { caminho, agora: AGORA });
    assert.equal(fs.existsSync(caminho), true);
    const obj = JSON.parse(fs.readFileSync(caminho, 'utf8').trim());
    assert.equal(Object.prototype.hasOwnProperty.call(obj, 'trava'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(obj, 'pausado'), false);
    assert.equal(obj.baia, 2);
  });

  it('rotaciona para .1.log quando passa do limite (um rodízio só)', () => {
    const limiteBytes = 50;
    registrarErro({ baia: 0, tipo: 'xp', motivo: 'primeira' }, { caminho, agora: AGORA, limiteBytes });
    registrarErro({ baia: 0, tipo: 'xp', motivo: 'segunda' }, { caminho, agora: AGORA, limiteBytes });
    const rodado = path.join(path.dirname(caminho), 'twitch-resgate.1.log');
    assert.equal(fs.existsSync(rodado), true);
    assert.equal(JSON.parse(fs.readFileSync(rodado, 'utf8').trim()).motivo, 'primeira');
    assert.equal(JSON.parse(fs.readFileSync(caminho, 'utf8').trim()).motivo, 'segunda');
  });

  it('não lança quando a escrita falha (pasta bloqueada por arquivo)', () => {
    const bloqueio = path.join(raiz, 'arquivo');
    fs.writeFileSync(bloqueio, 'x');
    const avisos = [];
    const original = console.warn;
    console.warn = (...args) => avisos.push(args);
    try {
      assert.doesNotThrow(() => registrarErro({ baia: 0, tipo: 'xp' }, { caminho: path.join(bloqueio, 'logs', 'a.log'), agora: AGORA }));
    } finally {
      console.warn = original;
    }
    assert.equal(avisos.length, 1);
    assert.equal(avisos[0].length, 2);
    assert.match(String(avisos[0][1]), /^[A-Za-z]+$/);
  });

  it('não grava nenhum campo fora da lista (texto de página fica de fora)', () => {
    registrarErro(
      { baia: 0, tipo: 'xp', texto: 'Texto da página que não deve sair', pagina: 'http://x', fase: 'clique' },
      { caminho, agora: AGORA },
    );
    const obj = JSON.parse(fs.readFileSync(caminho, 'utf8').trim());
    for (const k of Object.keys(obj)) assert.ok(CHAVES_ESPERADAS.includes(k), `chave inesperada: ${k}`);
    assert.equal(fs.readFileSync(caminho, 'utf8').includes('Texto da página'), false);
  });

  it('pausado NaN ou Infinity não lança e não grava texto inválido', () => {
    for (const ruim of [NaN, Infinity]) {
      assert.doesNotThrow(() => registrarErro({ baia: 0, tipo: 'pausa', motivo: 'falhas-repetidas', pausado: ruim }, { caminho, agora: AGORA }));
      const linhas = fs.readFileSync(caminho, 'utf8').split('\n').filter(Boolean);
      const obj = JSON.parse(linhas[linhas.length - 1]);
      assert.equal(Object.prototype.hasOwnProperty.call(obj, 'pausado'), false);
      assert.equal(fs.readFileSync(caminho, 'utf8').includes('Invalid Date'), false);
      assert.equal(obj.motivo, 'falhas-repetidas');
    }
  });

  it('pausado numérico finito vira ISO da hora de volta', () => {
    const volta = AGORA() + 3600000;
    registrarErro({ baia: 0, tipo: 'pausa', pausado: volta }, { caminho, agora: AGORA });
    const obj = JSON.parse(fs.readFileSync(caminho, 'utf8').trim());
    assert.equal(obj.pausado, new Date(volta).toISOString());
  });
});

describe('lerUltimosErros', () => {
  it('devolve as últimas n linhas e ignora linhas inválidas', () => {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, [
      JSON.stringify({ n: 1 }),
      'isto não é json',
      JSON.stringify({ n: 2 }),
      '',
      JSON.stringify({ n: 3 }),
    ].join('\n') + '\n');
    assert.deepEqual(lerUltimosErros(caminho, 2), [{ n: 2 }, { n: 3 }]);
    assert.deepEqual(lerUltimosErros(caminho, 10), [{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it('devolve [] quando o arquivo não existe', () => {
    assert.deepEqual(lerUltimosErros(path.join(raiz, 'nada.log'), 5), []);
  });
});

describe('multi-live: canal e vaga no registro (erros-log)', () => {
  const { montarLinha } = require('./erros-log');
  const agora = () => Date.UTC(2026, 10, 6);

  it('canal só entra como login validado, em minúsculas', () => {
    assert.equal(montarLinha({ canal: 'CanalA', motivo: 'x' }, agora).canal, 'canala');
    assert.equal(montarLinha({ canal: '<img src=x>', motivo: 'x' }, agora).canal, undefined);
    assert.equal(montarLinha({ canal: 'Título da página com espaços', motivo: 'x' }, agora).canal, undefined);
  });

  it('vaga só entra como inteiro de 0 a 3', () => {
    assert.equal(montarLinha({ stream: 2 }, agora).stream, 2);
    assert.equal(montarLinha({ stream: 4 }, agora).stream, undefined);
    assert.equal(montarLinha({ stream: '1' }, agora).stream, undefined);
    assert.equal(montarLinha({ stream: -1 }, agora).stream, undefined);
  });
});
