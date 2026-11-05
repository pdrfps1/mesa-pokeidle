'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { bundleGamePreload, loadPageSource } = require('./hunt-hook');
const { bundleTwitchPreload } = require('./twitch/bundle');

const SRC = path.join(__dirname, '..');
const PRELOAD = path.join(SRC, 'preload');
const TOPO = /^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

// Nomes de topo que aparecem mais de uma vez no bundle: num preload, isso quebra tudo ou sobrescreve em silêncio.
function nomesRepetidos(fonte) {
  const vistos = new Set();
  const repetidos = [];
  for (const m of fonte.matchAll(TOPO)) {
    if (vistos.has(m[1])) repetidos.push(m[1]);
    vistos.add(m[1]);
  }
  return repetidos;
}

describe('bundles dos preloads', () => {
  let tmp = '';
  let bundles = null;

  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-bundles-'));
    bundles = {
      jogo: fs.readFileSync(bundleGamePreload(tmp, PRELOAD), 'utf8'),
      pagina: loadPageSource(PRELOAD),
      twitch: fs.readFileSync(bundleTwitchPreload(tmp, SRC), 'utf8'),
    };
  });

  after(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('o bundle do jogo compila', () => {
    assert.doesNotThrow(() => new vm.Script(bundles.jogo, { filename: 'game-preload.js' }));
  });

  it('o bundle da página do jogo compila', () => {
    assert.doesNotThrow(() => new vm.Script(bundles.pagina, { filename: 'hunt-page.js' }));
  });

  it('o bundle da Twitch compila', () => {
    assert.doesNotThrow(() => new vm.Script(bundles.twitch, { filename: 'twitch-preload.js' }));
  });

  it('nenhum nome de topo se repete no bundle do jogo', () => {
    assert.deepEqual(nomesRepetidos(bundles.jogo), []);
  });

  it('nenhum nome de topo se repete no bundle da página do jogo', () => {
    assert.deepEqual(nomesRepetidos(bundles.pagina), []);
  });

  it('nenhum nome de topo se repete no bundle da Twitch', () => {
    assert.deepEqual(nomesRepetidos(bundles.twitch), []);
  });

  it('o bundle da Twitch traz o DOM e o preload, nessa ordem', () => {
    assert.ok(bundles.twitch.indexOf('MESA_TWITCH_DOM') < bundles.twitch.indexOf("require('electron')"));
  });
});
