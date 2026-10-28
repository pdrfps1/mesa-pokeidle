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
