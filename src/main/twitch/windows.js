'use strict';

// As BrowserWindow da Twitch, uma por baía, cada uma na sua partição persist:mesa-twitch-N.
const P = require('./points');

const LARGURA = 1280;
const ALTURA = 800;
const LIMITE_CRASH = 3;
const JANELA_CRASH_MS = 600000;
const ESPERA_RECARGA_CRASH_MS = 5000;

function hostDaTwitch(host) {
  const h = String(host || '').toLowerCase();
  return h === 'twitch.tv' || h.endsWith('.twitch.tv');
}

function urlDaTwitch(url) {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'https:' && hostDaTwitch(u.hostname);
  } catch { return false; }
}

function urlDeOutroSite(url) {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'https:' && !hostDaTwitch(u.hostname);
  } catch { return false; }
}

// Janela de login da Twitch. Se entrar uma segunda forma (navegador do sistema), ela entra no lugar daqui.
function criarJanelaTwitch(BrowserWindow, { i, part, preloadPath }) {
  return new BrowserWindow({
    show: false,
    width: LARGURA,
    height: ALTURA,
    minWidth: 900,
    minHeight: 600,
    title: `Twitch · Baía ${i + 1}`,
    autoHideMenuBar: true,
    backgroundColor: '#161719',
    skipTaskbar: true,
    webPreferences: {
      partition: part,
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      webSecurity: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: false,
    },
  });
}

// Subframe fora da Twitch é bloqueado. O frame principal fica com will-navigate; about:blank é o frame vazio.
function bloqueiaSubframe(details) {
  if (!details || details.isMainFrame || details.isSameDocument) return false;
  if (details.url === 'about:blank') return false;
  return !urlDaTwitch(details.url);
}

// Carga interrompida por outra navegação (ERR_ABORTED) é normal. Outros erros viram estado da baía.
function erroDeCargaIgnoravel(erro) {
  return !!erro && (erro.code === 'ERR_ABORTED' || erro.errno === -3);
}

function createTwitchWindows(deps) {
  const {
    BrowserWindow, session, catalog, preloadPath, prepareSession, shell,
    openOutside, querManter, aoEsconder, aoFechar, aoErroPagina,
  } = deps;
  const wins = new Map();
  const crashes = new Map();
  let encerrando = false;

  function entradaDe(i) {
    return wins.get(i) || null;
  }

  function existe(i) {
    return wins.has(i);
  }

  function url(i) {
    const e = entradaDe(i);
    if (!e || e.win.isDestroyed() || e.win.webContents.isDestroyed()) return '';
    return e.win.webContents.getURL();
  }

  function tratarErroCarga(i, erro) {
    if (erroDeCargaIgnoravel(erro)) return;
    if (typeof aoErroPagina === 'function') aoErroPagina(i);
  }

  function guardasDaJanela(i, win, entrada) {
    const wc = win.webContents;
    wc.on('will-navigate', (event, destino) => {
      if (urlDaTwitch(destino)) return;
      event.preventDefault();
      if (urlDeOutroSite(destino)) openOutside(shell, destino);
    });
    wc.on('will-redirect', (event, destino) => {
      if (!urlDaTwitch(destino)) event.preventDefault();
    });
    // Subframes (iframes) seguem o mesmo critério. Electron entrega preventDefault neste evento também.
    // about:blank é o frame vazio inicial, não uma saída para outro site: fica permitido.
    // Electron entrega um único objeto de detalhes, com url, isMainFrame e preventDefault.
    wc.on('will-frame-navigate', (details) => {
      if (bloqueiaSubframe(details)) details.preventDefault();
    });
    wc.setWindowOpenHandler(({ url: destino }) => {
      if (urlDeOutroSite(destino)) openOutside(shell, destino);
      return { action: 'deny' };
    });
    wc.on('render-process-gone', () => {
      const agora = Date.now();
      const recentes = (crashes.get(i) || []).filter((t) => agora - t < JANELA_CRASH_MS);
      if (recentes.length >= LIMITE_CRASH) {
        crashes.set(i, recentes);
        return;
      }
      recentes.push(agora);
      crashes.set(i, recentes);
      setTimeout(() => {
        if (wins.get(i) !== entrada || win.isDestroyed() || wc.isDestroyed()) return;
        wc.reload();
      }, ESPERA_RECARGA_CRASH_MS);
    });
    win.on('close', (event) => {
      if (!encerrando && querManter(i)) {
        event.preventDefault();
        esconder(i, entrada.modo);
        aoEsconder(i);
      }
    });
    win.on('closed', () => {
      if (wins.get(i) !== entrada) return;
      wins.delete(i);
      if (!encerrando) aoFechar(i);
    });
  }

  function abrir(i, destino, { modo, visivel }) {
    if (wins.has(i)) return;
    const part = catalog.twitchPartitions[i];
    prepareSession(part);
    const win = criarJanelaTwitch(BrowserWindow, { i, part, preloadPath });
    const entrada = { win, modo };
    wins.set(i, entrada);
    win.webContents.setAudioMuted(true);
    win.webContents.setBackgroundThrottling(false);
    guardasDaJanela(i, win, entrada);
    // A navegação pode ser trocada por outra (redirect) e o Electron rejeita a antiga: isso não é falha.
    win.loadURL(destino).catch((erro) => tratarErroCarga(i, erro));
    if (visivel) mostrar(i);
    else esconder(i, modo);
  }

  function navegar(i, destino) {
    const e = entradaDe(i);
    if (!e || e.win.isDestroyed()) return;
    // Mesmo caso de abrir: navegação substituída não é falha.
    e.win.loadURL(destino).catch((erro) => tratarErroCarga(i, erro));
  }

  function recarregar(i) {
    const e = entradaDe(i);
    if (!e || e.win.isDestroyed()) return;
    e.win.webContents.reload();
  }

  function mostrar(i) {
    const e = entradaDe(i);
    if (!e || e.win.isDestroyed()) return;
    const win = e.win;
    win.setFocusable(true);
    win.setSkipTaskbar(false);
    win.setBounds({ width: LARGURA, height: ALTURA });
    win.center();
    win.show();
    win.focus();
  }

  function esconder(i, modo) {
    const e = entradaDe(i);
    if (!e || e.win.isDestroyed()) return;
    e.modo = modo;
    const win = e.win;
    if (modo === 'fora-da-tela') {
      win.setSkipTaskbar(true);
      win.setFocusable(false);
      win.setBounds({ x: -32000, y: -32000, width: LARGURA, height: ALTURA });
      win.showInactive();
      return;
    }
    win.hide();
    win.setSkipTaskbar(true);
  }

  function fechar(i) {
    const e = entradaDe(i);
    if (!e) return;
    wins.delete(i);
    if (!e.win.isDestroyed()) e.win.destroy();
  }

  function enviar(i, cmd) {
    const e = entradaDe(i);
    if (!e || e.win.isDestroyed() || e.win.webContents.isDestroyed()) return;
    e.win.webContents.send('twitch:comando', cmd);
  }

  function bayOf(contents) {
    if (!contents || contents.isDestroyed()) return -1;
    for (const [i, e] of wins) {
      if (!e.win.isDestroyed() && e.win.webContents.id === contents.id) return i;
    }
    return -1;
  }

  // Lê só o cookie "login" (D1). Valor só em memória: nunca vai para log nem para disco.
  function lerLogin(i) {
    const part = catalog.twitchPartitions[i];
    if (!part) return Promise.resolve('');
    return session.fromPartition(part).cookies.get({ url: 'https://www.twitch.tv', name: 'login' })
      .then((lista) => {
        const valor = Array.isArray(lista) && lista[0] ? lista[0].value : '';
        const login = typeof valor === 'string' ? valor.trim() : '';
        return P.loginValido(login) ? login.toLowerCase() : '';
      })
      // Erro de leitura vira null (não sabemos o login); sem cookie continua ''.
      .catch(() => null);
  }

  function limpar(i) {
    const part = catalog.twitchPartitions[i];
    const ses = session.fromPartition(part);
    return ses.clearStorageData().then(() => ses.clearCache());
  }

  function encerrar() {
    encerrando = true;
    const todas = Array.from(wins.values());
    wins.clear();
    for (const e of todas) {
      if (!e.win.isDestroyed()) e.win.destroy();
    }
  }

  return {
    existe,
    url,
    abrir,
    navegar,
    recarregar,
    mostrar,
    esconder,
    fechar,
    enviar,
    bayOf,
    lerLogin,
    limpar,
    encerrar,
  };
}

module.exports = { createTwitchWindows, urlDaTwitch, erroDeCargaIgnoravel, bloqueiaSubframe };
