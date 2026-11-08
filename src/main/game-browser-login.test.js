'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  loginProfileDir,
  isLoginBrowserRunning,
  IMPORT_HINT,
} = require('../main/game-browser-login');

describe('game-browser-login', () => {
  it('monta pasta de perfil por partição', () => {
    const root = path.join(os.tmpdir(), 'mesa-login-test');
    assert.equal(
      loginProfileDir(root, 'persist:mesa-2'),
      path.join(root, 'login', 'mesa-2'),
    );
  });

  it('detecta navegador ausente pelo lockfile', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-lock-'));
    assert.equal(isLoginBrowserRunning(dir), false);
    fs.writeFileSync(path.join(dir, 'lockfile'), `${process.pid} 123\n`);
    assert.equal(isLoginBrowserRunning(dir), true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('expõe mensagens de importação em português', () => {
    assert.match(IMPORT_HINT.pending, /pokeidle/i);
    assert.match(IMPORT_HINT.failed, /Já entrei/);
  });
});

describe('game-browser-login reexporta o módulo de perfil', () => {
  it('loginProfileDir e isLoginBrowserRunning são as mesmas funções de profile-login', () => {
    const perfil = require('./browser/profile-login');
    const jogo = require('./game-browser-login');
    assert.equal(jogo.loginProfileDir, perfil.loginProfileDir);
    assert.equal(jogo.isLoginBrowserRunning, perfil.isLoginBrowserRunning);
    assert.equal(jogo.clearLoginProfile, perfil.clearLoginProfile);
  });
});

describe('openLoginBrowser do jogo: segunda abertura durante a primeira (A-6, S1)', () => {
  it('a chamada de dentro devolve ok sem onOpened; o onOpened de fora roda uma vez', () => {
    const { openLoginBrowser } = require('./game-browser-login');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-game-open-'));
    const deps = {
      catalog: { partitions: ['persist:mesa-1'] },
      userData: () => root,
      browserExe: 'x',
      spawn: () => {
        dentro = openLoginBrowser(deps, 0, () => chamados.push('dentro'));
        return { unref() {} };
      },
    };
    const chamados = [];
    let dentro = null;
    const fora = openLoginBrowser(deps, 0, () => chamados.push('fora'));
    assert.deepEqual(dentro, { ok: true });
    assert.deepEqual(fora, { ok: true });
    assert.deepEqual(chamados, ['fora']);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
