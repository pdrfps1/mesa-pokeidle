'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  loginProfileDir,
  clearLoginProfile,
  applyCookies,
  createImportWatcher,
  openProfileBrowser,
} = require('./profile-login');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-profile-'));
}

function esperarAte(cond, ms = 3000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const ver = () => {
      if (cond()) return resolve();
      if (Date.now() - inicio > ms) return reject(new Error('tempo esgotado'));
      setTimeout(ver, 5);
    };
    ver();
  });
}

describe('perfil de login', () => {
  it('monta a pasta por partição de Twitch, separada da do jogo', () => {
    const root = path.join(os.tmpdir(), 'mesa-root');
    assert.equal(loginProfileDir(root, 'persist:mesa-twitch-3'), path.join(root, 'login', 'mesa-twitch-3'));
    assert.notEqual(loginProfileDir(root, 'persist:mesa-twitch-3'), loginProfileDir(root, 'persist:mesa-3'));
  });

  it('clearLoginProfile apaga a pasta; pasta ausente não lança', () => {
    const root = tmpDir();
    const dir = loginProfileDir(root, 'persist:mesa-twitch-1');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Cookies'), 'x');
    clearLoginProfile(root, 'persist:mesa-twitch-1');
    assert.equal(fs.existsSync(dir), false);
    assert.doesNotThrow(() => clearLoginProfile(root, 'persist:mesa-twitch-1'));
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('applyCookies', () => {
  function sessaoFalsa(falhar = []) {
    const chamadas = [];
    return {
      chamadas,
      cookies: {
        set(detalhes) {
          chamadas.push(detalhes);
          if (falhar.includes(detalhes.name)) return Promise.reject(new Error('recusado'));
          return Promise.resolve();
        },
      },
    };
  }

  const base = { domain: '.twitch.tv', path: '/', secure: true, httpOnly: false };

  it('grava pela URL do cookie e mapeia sameSite', async () => {
    const ses = sessaoFalsa();
    await applyCookies(ses, [
      { ...base, name: 'a', value: '1', sameSite: 'Lax' },
      { ...base, name: 'b', value: '2', sameSite: 'None' },
      { ...base, name: 'c', value: '3', sameSite: 'Algo' },
    ]);
    assert.equal(ses.chamadas[0].url, 'https://twitch.tv/');
    assert.equal(ses.chamadas[0].sameSite, 'lax');
    assert.equal(ses.chamadas[1].sameSite, 'no_restriction');
    assert.equal(ses.chamadas[2].sameSite, 'unspecified');
  });

  it('expirationDate só entra com expires maior que zero', async () => {
    const ses = sessaoFalsa();
    await applyCookies(ses, [
      { ...base, name: 'com', value: '1', sameSite: 'Lax', expires: 1800000000 },
      { ...base, name: 'sem', value: '2', sameSite: 'Lax', expires: -1 },
    ]);
    assert.equal(ses.chamadas[0].expirationDate, 1800000000);
    assert.equal('expirationDate' in ses.chamadas[1], false);
  });

  it('um cookie que o Electron recusa não para os outros', async () => {
    const ses = sessaoFalsa(['ruim']);
    await applyCookies(ses, [
      { ...base, name: 'ruim', value: '1', sameSite: 'Lax' },
      { ...base, name: 'ok', value: '2', sameSite: 'Lax' },
    ]);
    assert.equal(ses.chamadas.length, 2);
  });

  it('continuar falso no meio para o laço e devolve false', async () => {
    const ses = sessaoFalsa();
    let voltas = 0;
    const completo = await applyCookies(ses, [
      { ...base, name: 'a', value: '1', sameSite: 'Lax' },
      { ...base, name: 'b', value: '2', sameSite: 'Lax' },
      { ...base, name: 'c', value: '3', sameSite: 'Lax' },
    ], () => {
      voltas += 1;
      return voltas <= 1;
    });
    assert.equal(completo, false);
    assert.deepEqual(ses.chamadas.map((c) => c.name), ['a']);
  });

  it('sem continuar, grava tudo e devolve true', async () => {
    const ses = sessaoFalsa();
    const completo = await applyCookies(ses, [
      { ...base, name: 'a', value: '1', sameSite: 'Lax' },
      { ...base, name: 'b', value: '2', sameSite: 'Lax' },
    ]);
    assert.equal(completo, true);
    assert.equal(ses.chamadas.length, 2);
  });
});

describe('createImportWatcher', () => {
  const tempos = { intervaloMs: 5, fechouMs: 1, abertoMs: 1, pendenteMs: 1 };

  // Sequência de respostas do "navegador aberto?"; depois da última, repete a última.
  function sequencia(valores) {
    const fila = valores.slice();
    let ultimo = valores[valores.length - 1];
    return () => {
      if (fila.length) ultimo = fila.shift();
      return ultimo;
    };
  }

  it('nunca viu o navegador abrir: não importa', async () => {
    const w = createImportWatcher({ ...tempos, isRunning: () => false });
    let importou = 0;
    w.start('k', 'pasta', () => { importou += 1; return { ok: true }; }, () => {});
    await new Promise((r) => setTimeout(r, 40));
    w.stop('k');
    assert.equal(importou, 0);
  });

  it('viu o navegador e ele fechou: importa e notifica ok', async () => {
    const w = createImportWatcher({ ...tempos, isRunning: sequencia([true, false, false]) });
    const avisos = [];
    w.start('k', 'pasta', async () => ({ ok: true, login: 'fulano' }), (r) => avisos.push(r));
    await esperarAte(() => avisos.length === 1);
    assert.deepEqual(avisos[0], { ok: true, login: 'fulano' });
    w.stopAll();
  });

  it('pendente cinco vezes: notifica pending na sexta tentativa', async () => {
    const w = createImportWatcher({ ...tempos, isRunning: sequencia([true, false]) });
    const avisos = [];
    let tentativas = 0;
    w.start('k', 'pasta', async () => { tentativas += 1; return { ok: false, reason: 'pending' }; }, (r) => avisos.push(r));
    await esperarAte(() => avisos.length === 1);
    assert.equal(tentativas, 6);
    assert.deepEqual(avisos[0], { ok: false, reason: 'pending' });
  });

  it('browser-open espera e tenta de novo', async () => {
    const w = createImportWatcher({ ...tempos, isRunning: sequencia([true, false, false, false]) });
    const avisos = [];
    const respostas = [{ ok: false, reason: 'browser-open' }, { ok: true }];
    let chamadas = 0;
    w.start('k', 'pasta', async () => respostas[chamadas++], (r) => avisos.push(r));
    await esperarAte(() => avisos.length === 1);
    assert.equal(chamadas, 2);
    assert.deepEqual(avisos[0], { ok: true });
  });

  it('navegador reaberto durante as tentativas: volta a vigiar', async () => {
    const w = createImportWatcher({
      ...tempos,
      isRunning: sequencia([true, false, false, true, true, false, false]),
    });
    const avisos = [];
    const respostas = [{ ok: false, reason: 'pending' }, { ok: true }];
    let chamadas = 0;
    w.start('k', 'pasta', async () => respostas[chamadas++], (r) => avisos.push(r));
    await esperarAte(() => avisos.length === 1);
    assert.equal(chamadas, 2);
    assert.deepEqual(avisos[0], { ok: true });
  });

  it('stop cancela antes de qualquer importação', async () => {
    const w = createImportWatcher({ ...tempos, isRunning: sequencia([true, false]) });
    let importou = 0;
    w.start('k', 'pasta', () => { importou += 1; return { ok: true }; }, () => {});
    w.stop('k');
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(importou, 0);
  });
});

describe('createImportWatcher: stop no meio do laço (A5)', () => {
  it('stop depois da primeira tentativa: não tenta de novo nem notifica', async () => {
    const w = createImportWatcher({
      intervaloMs: 5, fechouMs: 1, abertoMs: 1, pendenteMs: 200,
      isRunning: sequencia([true, false]),
    });
    const avisos = [];
    let tentativas = 0;
    w.start('k', 'pasta', async () => { tentativas += 1; return { ok: false, reason: 'pending' }; }, (r) => avisos.push(r));
    await esperarAte(() => tentativas === 1);
    w.stop('k');
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(tentativas, 1);
    assert.equal(avisos.length, 0);
  });
});

// Sequência local, igual à dos testes acima (o helper não é compartilhado).
function sequencia(valores) {
  const fila = valores.slice();
  let ultimo = valores[valores.length - 1];
  return () => {
    if (fila.length) ultimo = fila.shift();
    return ultimo;
  };
}

describe('openProfileBrowser: segunda abertura durante a primeira (A-6, S1)', () => {
  it('a chamada de dentro devolve ja e não repete o spawn; a de fora abre uma vez', () => {
    const dir = tmpDir();
    let dentro = null;
    const fora = openProfileBrowser({
      browserExe: 'x',
      profileDir: dir,
      url: 'https://www.twitch.tv/login',
      spawn: () => {
        dentro = openProfileBrowser({
          browserExe: 'x',
          profileDir: dir,
          url: 'https://www.twitch.tv/login',
          spawn: () => { throw new Error('não devia abrir de novo'); },
        });
        return { unref() {} };
      },
    });
    assert.deepEqual(dentro, { ok: true, ja: true });
    assert.deepEqual(fora, { ok: true });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
