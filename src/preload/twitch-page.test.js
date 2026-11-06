'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..');

// Roda o bundle do preload da Twitch (DOM + preload) num contexto isolado e conta o que ele registra.
function rodar(topoDaJanela) {
  const registros = { on: 0, send: 0, timers: 0 };
  const ipcRenderer = {
    on() { registros.on += 1; },
    send() { registros.send += 1; },
  };
  const janela = { top: topoDaJanela };
  janela.top = topoDaJanela === 'self' ? janela : topoDaJanela;
  const contexto = {
    require: () => ({ ipcRenderer }),
    window: janela,
    location: { hostname: 'www.twitch.tv', pathname: '/x' },
    localStorage: { setItem() {} },
    document: { querySelector: () => null, querySelectorAll: () => [] },
    setInterval() { registros.timers += 1; return 0; },
    setTimeout: () => 0,
    JSON,
  };
  vm.createContext(contexto);
  const fonte = [
    fs.readFileSync(path.join(SRC, 'shared', 'twitch-dom.js'), 'utf8'),
    '\n',
    fs.readFileSync(path.join(SRC, 'preload', 'twitch-page.js'), 'utf8'),
  ].join('');
  vm.runInContext(fonte, contexto);
  return registros;
}

describe('twitch-page: só o frame principal (S-8, A1)', () => {
  it('controle: no frame principal registra o IPC, o intervalo e manda o primeiro ciclo', () => {
    const r = rodar('self');
    assert.equal(r.on, 1);
    assert.equal(r.timers, 1);
    assert.ok(r.send >= 1);
  });

  it('iframe (top diferente de window): nada é registrado nem enviado', () => {
    const r = rodar({});
    assert.deepEqual(r, { on: 0, send: 0, timers: 0 });
  });
});
