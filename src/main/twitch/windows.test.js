'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { erroDeCargaIgnoravel, urlDaTwitch, bloqueiaSubframe, createTwitchWindows } = require('./windows');

// Janela falsa: guarda os handlers do webContents para o teste disparar os eventos.
function fakeJanela(loadURL) {
  const wc = {
    id: 1,
    handlers: {},
    on(nome, fn) { this.handlers[nome] = fn; },
    setWindowOpenHandler() {},
    setAudioMuted() {},
    setBackgroundThrottling() {},
    getURL: () => '',
    reload() {},
    send() {},
    isDestroyed: () => false,
  };
  return {
    webContents: wc,
    on(nome, fn) { wc.handlers[`win:${nome}`] = fn; },
    loadURL,
    hide() {},
    show() {},
    focus() {},
    center() {},
    setFocusable() {},
    setSkipTaskbar() {},
    setBounds() {},
    showInactive() {},
    destroy() {},
    isDestroyed: () => false,
  };
}

function montarJanelas(win) {
  const aoErro = [];
  const janelas = createTwitchWindows({
    BrowserWindow: function FakeBrowserWindow() { return win; },
    session: { fromPartition: () => ({ clearStorageData: () => Promise.resolve(), clearCache: () => Promise.resolve(), cookies: {} }) },
    catalog: { twitchPartitions: ['persist:mesa-twitch-1'] },
    preloadPath: 'preload.js',
    prepareSession: () => {},
    shell: {},
    openOutside: () => {},
    querManter: () => false,
    aoEsconder: () => {},
    aoFechar: () => {},
    aoErroPagina: (i) => aoErro.push(i),
  });
  return { janelas, aoErro };
}

const umTick = () => new Promise((r) => setImmediate(r));
const erroDe = (code, errno) => Object.assign(new Error(code), { code, errno });

describe('erroDeCargaIgnoravel (A8)', () => {
  it('ERR_ABORTED (por código ou errno -3) é normal e fica ignorado', () => {
    assert.equal(erroDeCargaIgnoravel({ code: 'ERR_ABORTED' }), true);
    assert.equal(erroDeCargaIgnoravel({ errno: -3 }), true);
  });

  it('outros erros de carga contam como falha da página', () => {
    assert.equal(erroDeCargaIgnoravel({ code: 'ERR_CONNECTION_REFUSED', errno: -102 }), false);
    assert.equal(erroDeCargaIgnoravel(null), false);
  });
});

describe('urlDaTwitch (A2)', () => {
  it('só https em twitch.tv e subdomínios', () => {
    assert.equal(urlDaTwitch('https://www.twitch.tv/x'), true);
    assert.equal(urlDaTwitch('https://evil-twitch.tv/x'), false);
    assert.equal(urlDaTwitch('http://www.twitch.tv/x'), false);
  });
});

describe('erro de carga na janela (A-7, A8)', () => {
  it('loadURL rejeitando ERR_CONNECTION_REFUSED chama aoErroPagina', async () => {
    const win = fakeJanela(() => Promise.reject(erroDe('ERR_CONNECTION_REFUSED', -102)));
    const { janelas, aoErro } = montarJanelas(win);
    janelas.abrir(0, 'https://www.twitch.tv/x', { modo: 'oculta', visivel: false });
    await umTick();
    assert.deepEqual(aoErro, [0]);
  });

  it('loadURL rejeitando ERR_ABORTED (código ou errno -3) não chama', async () => {
    for (const erro of [erroDe('ERR_ABORTED', -3), { errno: -3 }]) {
      const win = fakeJanela(() => Promise.reject(erro));
      const { janelas, aoErro } = montarJanelas(win);
      janelas.abrir(0, 'https://www.twitch.tv/x', { modo: 'oculta', visivel: false });
      await umTick();
      assert.deepEqual(aoErro, []);
    }
  });

  it('navegar também chama aoErroPagina em erro que não é ERR_ABORTED', async () => {
    const win = fakeJanela(() => Promise.resolve());
    const { janelas, aoErro } = montarJanelas(win);
    janelas.abrir(0, 'https://www.twitch.tv/x', { modo: 'oculta', visivel: false });
    win.loadURL = () => Promise.reject(erroDe('ERR_NAME_NOT_RESOLVED', -105));
    janelas.navegar(0, 'https://www.twitch.tv/y');
    await umTick();
    assert.deepEqual(aoErro, [0]);
  });
});

describe('lerLogin: erro de leitura do cookie (null) e sem cookie (\'\')', () => {
  function janelasComCookies(get) {
    return createTwitchWindows({
      BrowserWindow: function FakeBrowserWindow() { return {}; },
      session: { fromPartition: () => ({ cookies: { get } }) },
      catalog: { twitchPartitions: ['persist:mesa-twitch-1'] },
      preloadPath: 'preload.js',
      prepareSession: () => {},
      shell: {},
      openOutside: () => {},
      querManter: () => false,
      aoEsconder: () => {},
      aoFechar: () => {},
      aoErroPagina: () => {},
    });
  }

  it('erro em cookies.get devolve null', async () => {
    const janelas = janelasComCookies(() => Promise.reject(new Error('cookie travado')));
    assert.equal(await janelas.lerLogin(0), null);
  });

  it('sem cookie devolve string vazia', async () => {
    const janelas = janelasComCookies(() => Promise.resolve([]));
    assert.equal(await janelas.lerLogin(0), '');
  });
});

describe('bloqueio de subframe pela janela (O-1)', () => {
  it('frame principal para fora não é bloqueado aqui (fica com will-navigate)', () => {
    assert.equal(bloqueiaSubframe({ url: 'https://evil.com', isMainFrame: true, isSameDocument: false }), false);
  });

  it('subframe para https://evil.com é bloqueado', () => {
    assert.equal(bloqueiaSubframe({ url: 'https://evil.com', isMainFrame: false, isSameDocument: false }), true);
  });

  it('subframe para https://id.twitch.tv não é bloqueado', () => {
    assert.equal(bloqueiaSubframe({ url: 'https://id.twitch.tv/oauth', isMainFrame: false, isSameDocument: false }), false);
  });

  it('about:blank não é bloqueado', () => {
    assert.equal(bloqueiaSubframe({ url: 'about:blank', isMainFrame: false, isSameDocument: false }), false);
  });

  it('pelo handler da janela: só o subframe para fora chama preventDefault', () => {
    const win = fakeJanela(() => Promise.resolve());
    const { janelas } = montarJanelas(win);
    janelas.abrir(0, 'https://www.twitch.tv/x', { modo: 'oculta', visivel: false });
    const handler = win.webContents.handlers['will-frame-navigate'];
    const chamadas = [];
    const evento = (url, isMainFrame) => ({ url, isMainFrame, isSameDocument: false, preventDefault: () => chamadas.push(url) });
    handler(evento('https://www.twitch.tv/x', true));
    handler(evento('https://evil.com', true));
    handler(evento('https://evil.com', false));
    handler(evento('https://id.twitch.tv/oauth', false));
    handler(evento('about:blank', false));
    assert.deepEqual(chamadas, ['https://evil.com']);
  });
});
