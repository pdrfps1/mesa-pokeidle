'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  isTwitchCookie,
  filtrarCookiesTwitch,
  loginDosCookies,
  importarSessaoTwitch,
  createTwitchBrowserLogin,
} = require('./browser-login');
const { loginProfileDir } = require('../browser/profile-login');
const catalog = require('../../shared/catalog');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-twitch-login-'));
}

function travarPerfil(root, part) {
  const dir = loginProfileDir(root, part);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'lockfile'), `${process.pid} 1\n`);
  return dir;
}

function sessaoFalsa() {
  const log = [];
  return {
    log,
    fromPartition(part) {
      log.push(['partition', part]);
      return {
        setUserAgent() { log.push(['setUserAgent']); },
        clearStorageData(opcoes) {
          log.push(['clear', opcoes.storages.join(',')]);
          return Promise.resolve();
        },
        cookies: {
          set(detalhes) {
            log.push(['set', detalhes.name]);
            return Promise.resolve();
          },
        },
      };
    },
  };
}

describe('isTwitchCookie', () => {
  it('aceita twitch.tv e subdomínios', () => {
    for (const domain of ['twitch.tv', '.twitch.tv', 'www.twitch.tv', 'passport.twitch.tv']) {
      assert.equal(isTwitchCookie({ domain }), true, domain);
    }
  });

  it('recusa domínios parecidos, outros sites e entrada ruim', () => {
    for (const domain of ['eviltwitch.tv', 'twitch.tv.evil.com', 'google.com', '']) {
      assert.equal(isTwitchCookie({ domain }), false, domain);
    }
    assert.equal(isTwitchCookie({}), false);
    assert.equal(isTwitchCookie(null), false);
  });
});

describe('filtrarCookiesTwitch', () => {
  it('tira o que não é Twitch e nome ou valor que não é texto', () => {
    const entrada = [
      { domain: '.twitch.tv', name: 'a', value: '1' },
      { domain: 'google.com', name: 'b', value: '2' },
      { domain: '.twitch.tv', name: 3, value: '4' },
      { domain: '.twitch.tv', name: 'c', value: 5 },
    ];
    assert.deepEqual(filtrarCookiesTwitch(entrada).map((c) => c.name), ['a']);
  });

  it('não muda a entrada', () => {
    const entrada = [{ domain: '.twitch.tv', name: 'a', value: '1' }];
    const copia = JSON.stringify(entrada);
    filtrarCookiesTwitch(entrada);
    assert.equal(JSON.stringify(entrada), copia);
  });

  it('tem teto de 200', () => {
    const muitos = Array.from({ length: 250 }, (_, k) => ({ domain: '.twitch.tv', name: `n${k}`, value: 'x' }));
    assert.equal(filtrarCookiesTwitch(muitos).length, 200);
  });
});

describe('loginDosCookies', () => {
  it('com auth-token e login válido, devolve o login em minúsculas', () => {
    assert.equal(loginDosCookies([
      { name: 'auth-token', value: 'segredo' },
      { name: 'login', value: 'Fulano' },
    ]), 'fulano');
  });

  it('sem auth-token, não vale', () => {
    assert.equal(loginDosCookies([{ name: 'login', value: 'Fulano' }]), '');
  });

  it('login inválido ou ausente não vale', () => {
    assert.equal(loginDosCookies([{ name: 'auth-token', value: 'x' }, { name: 'login', value: 'a-b' }]), '');
    assert.equal(loginDosCookies([{ name: 'auth-token', value: 'x' }]), '');
  });
});

describe('importarSessaoTwitch', () => {
  const cookiesDaTwitch = [
    { domain: '.twitch.tv', name: 'auth-token', value: 'segredo', path: '/', sameSite: 'Lax', expires: -1 },
    { domain: '.twitch.tv', name: 'login', value: 'Fulano', path: '/', sameSite: 'Lax', expires: -1 },
  ];

  it('sem navegador: no-browser', async () => {
    const r = await importarSessaoTwitch({ browserExe: null, userData: tmpDir(), catalog, session: sessaoFalsa() }, 0);
    assert.deepEqual(r, { ok: false, reason: 'no-browser' });
  });

  it('navegador de login aberto: browser-open', async () => {
    const root = tmpDir();
    travarPerfil(root, catalog.twitchPartitions[0]);
    const r = await importarSessaoTwitch({ browserExe: 'x', userData: root, catalog, session: sessaoFalsa() }, 0);
    assert.deepEqual(r, { ok: false, reason: 'browser-open' });
  });

  it('perfil sem login válido (leitor devolve semSessao): pending', async () => {
    const root = tmpDir();
    const r = await importarSessaoTwitch({
      browserExe: 'x',
      userData: root,
      catalog,
      session: sessaoFalsa(),
      lerPerfil: async () => ({ semSessao: true }),
    }, 0);
    assert.deepEqual(r, { ok: false, reason: 'pending' });
  });

  it('leitura que devolve null: leitura-falhou', async () => {
    const r = await importarSessaoTwitch({
      browserExe: 'x',
      userData: tmpDir(),
      catalog,
      session: sessaoFalsa(),
      lerPerfil: async () => null,
    }, 0);
    assert.deepEqual(r, { ok: false, reason: 'leitura-falhou' });
  });

  it('leitura que rejeita: leitura-falhou', async () => {
    const r = await importarSessaoTwitch({
      browserExe: 'x',
      userData: tmpDir(),
      catalog,
      session: sessaoFalsa(),
      lerPerfil: async () => { throw new Error('cdp caiu'); },
    }, 0);
    assert.deepEqual(r, { ok: false, reason: 'leitura-falhou' });
  });

  it('com sessão: limpa os cookies antes de gravar, não muda o UA, devolve o login e não loga nada', async () => {
    const root = tmpDir();
    const ses = sessaoFalsa();
    const logs = [];
    const espioes = ['log', 'info', 'warn', 'error'].map((metodo) => {
      const original = console[metodo];
      console[metodo] = (...args) => { logs.push(args); };
      return [metodo, original];
    });
    let r;
    try {
      r = await importarSessaoTwitch({
        browserExe: 'x',
        userData: root,
        catalog,
        session: ses,
        lerPerfil: async () => ({ cookies: cookiesDaTwitch, login: 'fulano' }),
      }, 1);
    } finally {
      for (const [metodo, original] of espioes) console[metodo] = original;
    }
    assert.deepEqual(r, { ok: true, login: 'fulano' });
    const nomes = ses.log.map((e) => e[0]);
    assert.equal(nomes.includes('setUserAgent'), false);
    const indiceLimpeza = ses.log.findIndex((e) => e[0] === 'clear');
    const indiceSet = ses.log.findIndex((e) => e[0] === 'set');
    assert.equal(ses.log[indiceLimpeza][1], 'cookies');
    assert.ok(indiceLimpeza < indiceSet);
    assert.deepEqual(ses.log.filter((e) => e[0] === 'partition').map((e) => e[1]), [catalog.twitchPartitions[1]]);
    assert.deepEqual(ses.log.filter((e) => e[0] === 'set').map((e) => e[1]), ['auth-token', 'login']);
    assert.deepEqual(logs, []);
  });
});

describe('createTwitchBrowserLogin', () => {
  it('sair com o navegador de login aberto: perfil-em-uso e a pasta continua lá', () => {
    const root = tmpDir();
    const dir = travarPerfil(root, catalog.twitchPartitions[2]);
    const login = createTwitchBrowserLogin({ catalog, session: sessaoFalsa(), userData: root, aoEstado() {} });
    assert.deepEqual(login.sair(2), { ok: false, reason: 'perfil-em-uso' });
    assert.equal(fs.existsSync(dir), true);
    login.pararTudo();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('sair sem navegador aberto apaga o perfil da baía', () => {
    const root = tmpDir();
    const dir = loginProfileDir(root, catalog.twitchPartitions[0]);
    fs.mkdirSync(dir, { recursive: true });
    const login = createTwitchBrowserLogin({ catalog, session: sessaoFalsa(), userData: root, aoEstado() {} });
    assert.deepEqual(login.sair(0), { ok: true });
    assert.equal(fs.existsSync(dir), false);
    login.pararTudo();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('abrir sem navegador informa no-browser e não abre nada', () => {
    const estados = [];
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoFalsa(),
      userData: tmpDir(),
      findBrowser: () => null,
      aoEstado: (i, dados) => estados.push([i, dados]),
    });
    assert.deepEqual(login.abrir(0), { ok: false, error: 'no-browser' });
    assert.deepEqual(estados, [[0, { estado: 'falhou', motivo: 'no-browser' }]]);
    login.pararTudo();
  });

  it('importar sem navegador informa importando e depois falhou no-browser', async () => {
    const estados = [];
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoFalsa(),
      userData: tmpDir(),
      findBrowser: () => null,
      aoEstado: (i, dados) => estados.push(dados),
    });
    const r = await login.importar(1);
    assert.deepEqual(r, { ok: false, reason: 'no-browser' });
    assert.deepEqual(estados, [
      { estado: 'importando' },
      { estado: 'falhou', motivo: 'no-browser' },
    ]);
    login.pararTudo();
  });
});

const { sairDaBaia } = require('./browser-login');

describe('sair: perfil travado e ordem do finally (A4)', () => {
  it('apagarPerfil com EBUSY vira perfil-em-uso, e a pasta fica', () => {
    const root = tmpDir();
    const dir = loginProfileDir(root, catalog.twitchPartitions[0]);
    fs.mkdirSync(dir, { recursive: true });
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoFalsa(),
      userData: root,
      aoEstado() {},
      apagarPerfil: () => { throw Object.assign(new Error('travado'), { code: 'EBUSY' }); },
    });
    assert.deepEqual(login.sair(0), { ok: false, reason: 'perfil-em-uso' });
    login.pararTudo();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('outro erro de apagar não vira perfil-em-uso: sobe', () => {
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoFalsa(),
      userData: tmpDir(),
      aoEstado() {},
      apagarPerfil: () => { throw Object.assign(new Error('nada'), { code: 'ENOENT' }); },
    });
    assert.throws(() => login.sair(0), /nada/);
    login.pararTudo();
  });

  it('sairDaBaia roda o login.sair mesmo quando controller.sair lança', async () => {
    const chamadas = [];
    const controller = {
      sair: async () => { throw new Error('falha no controller'); },
      navegadorEstado: (i, d) => chamadas.push(['estado', i, d]),
    };
    const login = { cancelar: () => {}, sair: () => { chamadas.push(['login']); return { ok: true }; } };
    await assert.rejects(sairDaBaia(controller, login, 2), /falha no controller/);
    assert.deepEqual(chamadas, [['login']]);
  });

  it('sairDaBaia com perfil-em-uso informa a baía', async () => {
    const chamadas = [];
    const controller = {
      sair: async () => {},
      navegadorEstado: (i, d) => chamadas.push([i, d]),
    };
    const login = { cancelar: () => {}, sair: () => ({ ok: false, reason: 'perfil-em-uso' }) };
    await sairDaBaia(controller, login, 1);
    assert.deepEqual(chamadas, [[1, { estado: 'falhou', motivo: 'perfil-em-uso' }]]);
  });
});

describe('importação cancelada por sair (A5)', () => {
  it('importarSessaoTwitch com vigente falso não grava nada', async () => {
    const ses = sessaoFalsa();
    const r = await importarSessaoTwitch({
      browserExe: 'x',
      userData: tmpDir(),
      catalog,
      session: ses,
      vigente: () => false,
      lerPerfil: async () => ({ cookies: [{ domain: '.twitch.tv', name: 'auth-token', value: 'v' }], login: 'fulano' }),
    }, 0);
    assert.deepEqual(r, { ok: false, reason: 'cancelado' });
    assert.equal(ses.log.some((e) => e[0] === 'set' || e[0] === 'clear'), false);
  });

  it('sair no meio de uma importação: nada é gravado e nenhum estado "ok" sai', async () => {
    let liberar;
    const espera = new Promise((r) => { liberar = r; });
    const ses = sessaoFalsa();
    const estados = [];
    const login = createTwitchBrowserLogin({
      catalog,
      session: ses,
      userData: tmpDir(),
      findBrowser: () => 'x',
      aoEstado: (i, d) => estados.push(d),
      apagarPerfil: () => {},
      lerPerfil: async () => {
        await espera;
        return { cookies: [{ domain: '.twitch.tv', name: 'auth-token', value: 'v' }], login: 'fulano' };
      },
    });
    const pendente = login.importar(0);
    login.sair(0);
    liberar();
    const r = await pendente;
    assert.deepEqual(r, { ok: false, reason: 'cancelado' });
    assert.equal(ses.log.some((e) => e[0] === 'set'), false);
    assert.equal(estados.some((d) => d.estado === 'ok'), false);
    login.pararTudo();
  });
});

const { criarLeitorDeLogin } = require('./login-reader');

describe('leitura de login com geração (A-5)', () => {
  it('leitura que volta depois de invalidar é descartada', async () => {
    let liberar;
    const pendente = new Promise((r) => { liberar = r; });
    const aplicados = [];
    const leitor = criarLeitorDeLogin({ ler: () => pendente, aplicar: (i, l) => aplicados.push([i, l]) });
    const lida = leitor.ler(0);
    leitor.invalidar(0);
    liberar('fulano');
    await lida;
    assert.deepEqual(aplicados, []);
  });

  it('leitura sem invalidar é aplicada normalmente', async () => {
    const aplicados = [];
    const leitor = criarLeitorDeLogin({ ler: async () => 'fulano', aplicar: (i, l) => aplicados.push([i, l]) });
    await leitor.ler(2);
    assert.deepEqual(aplicados, [[2, 'fulano']]);
  });

  it('invalidar uma baía não afeta a outra', async () => {
    const aplicados = [];
    const leitor = criarLeitorDeLogin({ ler: async () => 'x', aplicar: (i) => aplicados.push(i) });
    const lida = leitor.ler(1);
    leitor.invalidar(0);
    await lida;
    assert.deepEqual(aplicados, [1]);
  });
});

const leitorModulo = require('./login-reader');

describe('sair: leitura de login que começa durante a limpeza (correção 3)', () => {
  it('leitura iniciada durante a limpeza não restaura a conta antiga depois do sair', async () => {
    let liberarLimpeza;
    const limpeza = new Promise((r) => { liberarLimpeza = r; });
    let liberarLeitura;
    const leituraPendente = new Promise((r) => { liberarLeitura = r; });
    const aplicados = [];
    const leitor = leitorModulo.criarLeitorDeLogin({
      ler: () => leituraPendente,
      aplicar: (i, login) => aplicados.push([i, login]),
    });
    const saida = leitorModulo.sairComInvalidacao(leitor, 0, () => limpeza);
    const lida = leitor.ler(0);
    liberarLimpeza();
    await saida;
    liberarLeitura('fulano');
    await lida;
    assert.deepEqual(aplicados, []);
  });

  it('o finally roda mesmo se o sair lançar: a leitura do meio não é aplicada, e o erro sobe', async () => {
    let liberarLeitura;
    const leituraPendente = new Promise((r) => { liberarLeitura = r; });
    const aplicados = [];
    const leitor = leitorModulo.criarLeitorDeLogin({
      ler: () => leituraPendente,
      aplicar: (i, login) => aplicados.push([i, login]),
    });
    const saida = leitorModulo.sairComInvalidacao(leitor, 1, async () => {
      leitor.ler(1);
      throw new Error('falha');
    });
    await assert.rejects(saida, /falha/);
    liberarLeitura('fulano');
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(aplicados, []);
  });
});

describe('cópia cancelada por sair (correção 2)', () => {
  const cookiesTwitch = [
    { domain: '.twitch.tv', name: 'auth-token', value: 'segredo', path: '/', sameSite: 'Lax', expires: -1 },
    { domain: '.twitch.tv', name: 'login', value: 'Fulano', path: '/', sameSite: 'Lax', expires: -1 },
    { domain: '.twitch.tv', name: 'extra', value: 'v', path: '/', sameSite: 'Lax', expires: -1 },
  ];

  it('vigente vira falso no meio da cópia: cancelado, não grava os seguintes e limpa de novo', async () => {
    const ses = sessaoFalsa();
    let chamadas = 0;
    const vigente = () => { chamadas += 1; return chamadas <= 5; };
    const r = await importarSessaoTwitch({
      browserExe: 'x',
      userData: tmpDir(),
      catalog,
      session: ses,
      vigente,
      lerPerfil: async () => ({ cookies: cookiesTwitch, login: 'fulano' }),
    }, 0);
    assert.deepEqual(r, { ok: false, reason: 'cancelado' });
    assert.deepEqual(ses.log.filter((e) => e[0] === 'set').map((e) => e[1]), ['auth-token']);
    assert.equal(ses.log.filter((e) => e[0] === 'clear').length, 2);
  });

  it('sairDaBaia chama cancelar antes de controller.sair', async () => {
    const ordem = [];
    const controller = {
      sair: async (i) => { ordem.push(['sair', i]); },
      navegadorEstado() {},
    };
    const login = {
      cancelar: (i) => { ordem.push(['cancelar', i]); },
      sair: () => ({ ok: true }),
    };
    await sairDaBaia(controller, login, 2);
    assert.deepEqual(ordem, [['cancelar', 2], ['sair', 2]]);
  });

  it('cancelar no meio de uma importação: o resultado não chega a aoEstado', async () => {
    let liberar;
    const espera = new Promise((r) => { liberar = r; });
    const ses = sessaoFalsa();
    const estados = [];
    const login = createTwitchBrowserLogin({
      catalog,
      session: ses,
      userData: tmpDir(),
      findBrowser: () => 'x',
      aoEstado: (i, d) => estados.push(d),
      lerPerfil: async () => {
        await espera;
        return { cookies: cookiesTwitch, login: 'fulano' };
      },
    });
    const pendente = login.importar(0);
    login.cancelar(0);
    liberar();
    const r = await pendente;
    assert.deepEqual(r, { ok: false, reason: 'cancelado' });
    assert.equal(ses.log.some((e) => e[0] === 'set'), false);
    assert.deepEqual(estados, [{ estado: 'importando' }]);
    login.pararTudo();
  });
});

describe('fila de escrita de cookies por baía (correção 4)', () => {
  const sessaoA = { cookies: [{ domain: '.twitch.tv', name: 'auth-token', value: 'conta-a' }, { domain: '.twitch.tv', name: 'login', value: 'a' }], login: 'a' };
  const sessaoB = { cookies: [{ domain: '.twitch.tv', name: 'auth-token', value: 'conta-b' }, { domain: '.twitch.tv', name: 'login', value: 'b' }], login: 'b' };

  // Partição em memória. Os primeiros cookies.set esperam os liberadores, para segurar a escrita no meio.
  function sessaoComParticao(particao, segurar) {
    return {
      fromPartition(part) {
        if (!particao.has(part)) particao.set(part, new Map());
        const cookies = particao.get(part);
        return {
          clearStorageData() { cookies.clear(); return Promise.resolve(); },
          cookies: {
            set(d) {
              const espera = segurar.length ? segurar.shift() : Promise.resolve();
              return espera.then(() => { cookies.set(d.name, d.value); });
            },
          },
        };
      },
    };
  }

  const ceder = () => new Promise((r) => setImmediate(r));

  it('A cancelada com set preso não apaga B: B termina ok e a partição tem só os cookies de B', async () => {
    const part = catalog.twitchPartitions[0];
    const particao = new Map();
    let liberarA;
    const segurar = [new Promise((r) => { liberarA = r; })];
    let perfis = 0;
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoComParticao(particao, segurar),
      userData: tmpDir(),
      findBrowser: () => 'x',
      aoEstado() {},
      lerPerfil: async () => { perfis += 1; return perfis === 1 ? sessaoA : sessaoB; },
    });
    const a = login.importar(0);
    await ceder();
    login.cancelar(0);
    const b = login.importar(0);
    liberarA();
    assert.deepEqual(await a, { ok: false, reason: 'cancelado' });
    assert.deepEqual(await b, { ok: true, login: 'b' });
    const cookies = particao.get(part);
    assert.equal(cookies.get('auth-token'), 'conta-b');
    assert.equal(cookies.get('login'), 'b');
    login.pararTudo();
  });

  it('importação que fica velha esperando a fila de escrita não grava cookie e devolve cancelado', async () => {
    const part = catalog.twitchPartitions[0];
    const particao = new Map();
    let liberarA;
    const segurar = [new Promise((r) => { liberarA = r; })];
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoComParticao(particao, segurar),
      userData: tmpDir(),
      findBrowser: () => 'x',
      aoEstado() {},
      lerPerfil: async () => sessaoA,
    });
    const a = login.importar(0);
    await ceder();
    const b = login.importar(0);
    await ceder();
    login.cancelar(0);
    liberarA();
    await a;
    assert.deepEqual(await b, { ok: false, reason: 'cancelado' });
    assert.equal(particao.get(part).size, 0);
    login.pararTudo();
  });

  it('leitura de perfil presa da A, cancelada, não impede a B de terminar ok', async () => {
    const part = catalog.twitchPartitions[0];
    const particao = new Map();
    let liberarLeituraA;
    let perfis = 0;
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoComParticao(particao, []),
      userData: tmpDir(),
      findBrowser: () => 'x',
      aoEstado() {},
      lerPerfil: async () => {
        perfis += 1;
        if (perfis === 1) return new Promise((r) => { liberarLeituraA = r; });
        return sessaoB;
      },
    });
    const a = login.importar(0);
    await ceder();
    login.cancelar(0);
    const b = await login.importar(0);
    assert.deepEqual(b, { ok: true, login: 'b' });
    liberarLeituraA(sessaoA);
    assert.deepEqual(await a, { ok: false, reason: 'cancelado' });
    assert.equal(particao.get(part).get('auth-token'), 'conta-b');
    login.pararTudo();
  });
});

describe('saída pendente com navegador aberto (correção 5)', () => {
  const cookiesNovos = [
    { domain: '.twitch.tv', name: 'auth-token', value: 'conta-nova', path: '/', sameSite: 'Lax', expires: -1 },
    { domain: '.twitch.tv', name: 'login', value: 'b', path: '/', sameSite: 'Lax', expires: -1 },
  ];

  it('sair com navegador aberto, navegador fecha, importar: não devolve ok, não grava e apaga o perfil', async () => {
    const root = tmpDir();
    const dir = travarPerfil(root, catalog.twitchPartitions[0]);
    fs.writeFileSync(path.join(dir, 'Cookies'), 'x');
    const ses = sessaoFalsa();
    const login = createTwitchBrowserLogin({
      catalog,
      session: ses,
      userData: root,
      findBrowser: () => 'x',
      aoEstado() {},
      // Sem perfil em disco não há sessão para ler: é o que o login real faria depois de apagado.
      lerPerfil: async (_exe, perfil) => (fs.existsSync(perfil) ? { cookies: cookiesNovos, login: 'b' } : { semSessao: true }),
    });
    assert.deepEqual(login.sair(0), { ok: false, reason: 'perfil-em-uso' });
    fs.rmSync(path.join(dir, 'lockfile'));
    const r = await login.importar(0);
    assert.deepEqual(r, { ok: false, reason: 'pending' });
    assert.equal(ses.log.some((e) => e[0] === 'set'), false);
    assert.equal(fs.existsSync(dir), false);
    login.pararTudo();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('navegador segue aberto: importar devolve perfil-em-uso e o perfil fica', async () => {
    const root = tmpDir();
    const dir = travarPerfil(root, catalog.twitchPartitions[0]);
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoFalsa(),
      userData: root,
      aoEstado() {},
      lerPerfil: async () => null,
    });
    login.sair(0);
    assert.deepEqual(await login.importar(0), { ok: false, reason: 'perfil-em-uso' });
    assert.equal(fs.existsSync(dir), true);
    login.pararTudo();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('abrir depois de sair pendente com navegador fechado apaga o perfil antes de abrir', () => {
    const root = tmpDir();
    const dir = travarPerfil(root, catalog.twitchPartitions[0]);
    fs.writeFileSync(path.join(dir, 'Cookies'), 'x');
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoFalsa(),
      userData: root,
      findBrowser: () => process.execPath,
      aoEstado() {},
    });
    login.sair(0);
    fs.rmSync(path.join(dir, 'lockfile'));
    assert.deepEqual(login.abrir(0), { ok: true });
    assert.equal(fs.existsSync(path.join(dir, 'Cookies')), false);
    login.pararTudo();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('sair bem-sucedido não deixa pendência: uma importação nova funciona', async () => {
    const root = tmpDir();
    const login = createTwitchBrowserLogin({
      catalog,
      session: sessaoFalsa(),
      userData: root,
      findBrowser: () => 'x',
      aoEstado() {},
      lerPerfil: async () => ({ cookies: cookiesNovos, login: 'b' }),
    });
    assert.deepEqual(login.sair(0), { ok: true });
    assert.deepEqual(await login.importar(0), { ok: true, login: 'b' });
    login.pararTudo();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
