'use strict';

const crypto = require('crypto');
const { spawn } = require('child_process');
const {
  sanitizeLivePatch,
  applyBayPatch,
  wantedJoinLogins,
  setChannelEnabled,
  addManual,
  removeManual,
  toPublicSnapshot,
  emptyBayLive,
  mergeTwitchFromBays,
  qualifiedAutoLogins,
} = require('../../shared/live-catalog');
const store = require('./store');
const oauth = require('./oauth');
const { waitForOAuthCallback } = require('./oauth-tls');
const { openOutside } = require('../live-login');
const {
  connectIrcSocket,
  sendRaw,
  handleIrcLine,
  formatJoin,
  formatPart,
  createIrcSession,
  setChannels,
  nextReconnectDelay,
} = require('./irc-socket');

let deps = null;
let bays = [emptyBayLive(), emptyBayLive(), emptyBayLive(), emptyBayLive()];
let runtime = {
  status: 'desconectado',
  login: '',
  clientId: '',
  error: '',
  authorizeUrl: '',
  token: null,
  prefs: { excluded: [], manual: [] },
};
let ircSession = null;
let ws = null;
let joinTimer = null;
let reconnectTimer = null;
let authorizeBusy = false;
let stopped = true;

function userDataPath() {
  return deps && typeof deps.userData === 'function' ? deps.userData() : '';
}

function loadFromDisk() {
  const doc = store.readStore(userDataPath());
  runtime.clientId = doc.clientId || '';
  runtime.prefs = { excluded: doc.excluded, manual: doc.manual };
  runtime.token = doc.token;
}

function publicSnapshot() {
  return toPublicSnapshot({
    status: runtime.status,
    login: runtime.login,
    clientId: runtime.clientId,
    error: runtime.error,
    authorizeUrl: runtime.authorizeUrl,
    joined: ircSession ? Array.from(ircSession.confirmed) : [],
    bays,
    prefs: runtime.prefs,
  });
}

function pushUi() {
  const win = deps && typeof deps.getUiWindow === 'function' ? deps.getUiWindow() : null;
  if (!win || win.isDestroyed()) return;
  const contents = win.webContents;
  if (!contents || contents.isDestroyed()) return;
  contents.send('live:status', publicSnapshot());
}

function setStatus(status, error) {
  runtime.status = status;
  runtime.error = typeof error === 'string' ? error : '';
  pushUi();
}

function clearSocket() {
  if (joinTimer) {
    clearInterval(joinTimer);
    joinTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(); } catch { /* ignore */ }
    ws = null;
  }
  ircSession = null;
}

function scheduleReconnect() {
  if (stopped || !runtime.token) return;
  if (reconnectTimer) return;
  let delay = 5000;
  if (ircSession) delay = nextReconnectDelay(ircSession);
  clearSocket();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, delay);
}

function applyChannelSync() {
  if (!ircSession || !ws) return;
  const wanted = wantedJoinLogins(bays, runtime.prefs.excluded, runtime.prefs.manual);
  const { joins, parts } = setChannels(ircSession, wanted);
  for (const channel of parts) sendRaw(ws, formatPart(channel));
  for (const channel of joins) {
    if (sendRaw(ws, formatJoin(channel))) ircSession.joined.add(channel);
  }
  pushUi();
}

function onIrcLine(line) {
  if (!ircSession) return;
  const result = handleIrcLine(ircSession, line);
  if (result.authFailed) {
    runtime.error = 'Autenticação no chat da Twitch falhou.';
    setStatus('falha', runtime.error);
    clearSocket();
    return;
  }
  for (const command of result.commands || []) {
    if (command.type === 'pong') {
      const payload = command.payload || 'tmi.twitch.tv';
      sendRaw(ws, `PONG :${payload}`);
    } else if (command.type === 'reconnect') {
      clearSocket();
      scheduleReconnect();
      return;
    } else if (command.type === 'registered') {
      setStatus('no-chat');
      applyChannelSync();
    }
  }
  if (runtime.status === 'no-chat') pushUi();
}

function drainJoinQueue() {
  if (!ircSession || !ws || runtime.status !== 'no-chat') return;
  const wanted = wantedJoinLogins(bays, runtime.prefs.excluded, runtime.prefs.manual);
  const { joins } = setChannels(ircSession, wanted);
  for (const channel of joins) {
    if (sendRaw(ws, formatJoin(channel))) ircSession.joined.add(channel);
  }
  if (joins.length) pushUi();
}

async function ensureFreshToken() {
  const doc = store.readStore(userDataPath());
  let token = doc.token;
  if (!token || !token.accessToken) return null;
  if (!oauth.needsRefresh(token)) return token;
  if (!token.refreshToken || !doc.clientId) return token;
  try {
    const exchange = await oauth.refreshAccessToken(doc.clientId, token.refreshToken);
    const validated = await oauth.validateToken(exchange.access_token);
    const next = oauth.tokenFromExchange(exchange, validated.login);
    if (token.refreshToken && !next.refreshToken) next.refreshToken = token.refreshToken;
    store.saveToken(userDataPath(), next);
    runtime.token = next;
    runtime.login = next.login;
    return next;
  } catch {
    return token;
  }
}

function connectSocket() {
  if (stopped) return;
  clearSocket();
  ensureFreshToken().then((token) => {
    if (stopped || !token) {
      setStatus('desconectado');
      return;
    }
    runtime.token = token;
    runtime.login = token.login;
    setStatus('conectando');
    ircSession = createIrcSession(token.login, token.accessToken);
    ws = connectIrcSocket({
      token,
      login: token.login,
      onLine: onIrcLine,
      onOpen: () => {
        setStatus('no-chat');
        applyChannelSync();
      },
      onClose: () => {
        if (stopped || runtime.status === 'falha') return;
        scheduleReconnect();
      },
    });
    if (!joinTimer) {
      joinTimer = setInterval(drainJoinQueue, 1000);
    }
  }).catch((err) => {
    const message = err instanceof Error && err.message
      ? err.message
      : 'Não foi possível preparar a conexão.';
    setStatus('falha', message);
  });
}

function openInBrowser(url) {
  if (typeof url !== 'string' || !url.startsWith('https://id.twitch.tv/')) {
    return Promise.reject(new Error('Endereço da Twitch inválido.'));
  }
  if (process.platform === 'win32') {
    return new Promise((resolve, reject) => {
      const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
        detached: true,
        windowsHide: true,
        stdio: 'ignore',
      });
      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
  }
  const opened = deps.shell.openExternal(url);
  return opened && typeof opened.then === 'function' ? opened : Promise.resolve();
}

async function beginAuthorize() {
  if (authorizeBusy && runtime.authorizeUrl) {
    try { await openInBrowser(runtime.authorizeUrl); } catch { /* o botão Abrir Twitch continua na tela */ }
    setStatus('conectando', 'A Twitch deve abrir de novo. Se a janela não aparecer, clique em Abrir Twitch.');
    return publicSnapshot();
  }
  if (authorizeBusy) return publicSnapshot();
  authorizeBusy = true;
  loadFromDisk();
  if (!runtime.clientId) {
    authorizeBusy = false;
    setStatus('falha', 'Informe o Client ID antes de autorizar.');
    return publicSnapshot();
  }
  const verifier = oauth.randomVerifier();
  const challenge = oauth.pkceChallengeS256(verifier);
  const state = crypto.randomBytes(16).toString('hex');
  const url = oauth.buildAuthorizeUrl(runtime.clientId, state, challenge);
  runtime.authorizeUrl = url;
  setStatus('conectando', 'Preparando a autorização. A Twitch abre em seguida.');
  let codePromise;
  try {
    codePromise = await waitForOAuthCallback(state);
  } catch (err) {
    authorizeBusy = false;
    runtime.authorizeUrl = '';
    const message = err instanceof Error ? err.message : 'Autorização falhou.';
    setStatus('falha', message);
    return publicSnapshot();
  }
  setStatus('conectando', 'A Twitch deve abrir agora. Se a janela não aparecer, clique em Abrir Twitch.');
  try {
    await openInBrowser(url);
  } catch {
    setStatus('conectando', 'A Mesa não conseguiu abrir o navegador. Clique em Abrir Twitch.');
  }
  try {
    const { code } = await codePromise;
    const exchange = await oauth.exchangeCode(runtime.clientId, code, verifier);
    const validated = await oauth.validateToken(exchange.access_token);
    const token = oauth.tokenFromExchange(exchange, validated.login);
    store.saveToken(userDataPath(), token);
    runtime.token = token;
    runtime.login = token.login;
    runtime.error = '';
    runtime.authorizeUrl = '';
    authorizeBusy = false;
    connectSocket();
    return publicSnapshot();
  } catch (err) {
    authorizeBusy = false;
    runtime.authorizeUrl = '';
    const message = err instanceof Error ? err.message : 'Autorização falhou.';
    setStatus(message.includes('cancelada') ? 'desconectado' : 'falha', message);
    return publicSnapshot();
  }
}

function disconnectLive() {
  store.clearToken(userDataPath());
  runtime.token = null;
  runtime.login = '';
  runtime.error = '';
  runtime.authorizeUrl = '';
  clearSocket();
  setStatus('desconectado');
  return publicSnapshot();
}

function registerLive(injected) {
  deps = injected;
  loadFromDisk();
  const { ipcMain, catalog, isUi } = injected;

  ipcMain.on('live:frame', (event, rawPatch) => {
    const senderPath = (() => {
      try { return event.sender.session.getStoragePath() || ''; } catch { return ''; }
    })();
    const index = catalog.partitions.findIndex((part) => {
      try {
        const ses = injected.session.fromPartition(part);
        if (ses === event.sender.session) return true;
        const path = ses.getStoragePath() || '';
        return senderPath !== '' && path === senderPath;
      } catch {
        return false;
      }
    });
    if (index < 0) return;
    const patch = sanitizeLivePatch(rawPatch);
    if (!patch) return;
    bays[index] = applyBayPatch(bays[index], patch);
    applyChannelSync();
    pushUi();
  });

  ipcMain.handle('live:get', (event) => {
    if (!isUi(event)) return publicSnapshot();
    loadFromDisk();
    return publicSnapshot();
  });

  ipcMain.handle('live:authorize', async (event) => {
    if (!isUi(event)) return publicSnapshot();
    return beginAuthorize();
  });

  ipcMain.handle('live:open-twitch', async (event) => {
    if (!isUi(event)) return publicSnapshot();
    if (!runtime.authorizeUrl) return publicSnapshot();
    try {
      await openInBrowser(runtime.authorizeUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível abrir o navegador.';
      setStatus('conectando', message);
    }
    return publicSnapshot();
  });

  ipcMain.handle('live:disconnect', (event) => {
    if (!isUi(event)) return publicSnapshot();
    return disconnectLive();
  });

  ipcMain.handle('live:client-id', (event, clientId) => {
    if (!isUi(event)) return publicSnapshot();
    const doc = store.setClientId(userDataPath(), typeof clientId === 'string' ? clientId : '');
    runtime.clientId = doc.clientId;
    pushUi();
    return publicSnapshot();
  });

  ipcMain.handle('live:channel', (event, login, enabled) => {
    if (!isUi(event)) return publicSnapshot();
    const { officials, lives } = mergeTwitchFromBays(bays);
    const qualified = qualifiedAutoLogins(officials, lives);
    const prefs = setChannelEnabled(runtime.prefs, login, enabled === true, qualified.has(String(login || '').toLowerCase()));
    runtime.prefs = prefs;
    store.savePrefs(userDataPath(), prefs);
    applyChannelSync();
    pushUi();
    return publicSnapshot();
  });

  ipcMain.handle('live:manual-add', (event, login) => {
    if (!isUi(event)) return publicSnapshot();
    runtime.prefs = addManual(runtime.prefs, login);
    store.savePrefs(userDataPath(), runtime.prefs);
    applyChannelSync();
    pushUi();
    return publicSnapshot();
  });

  ipcMain.handle('live:manual-remove', (event, login) => {
    if (!isUi(event)) return publicSnapshot();
    runtime.prefs = removeManual(runtime.prefs, login);
    store.savePrefs(userDataPath(), runtime.prefs);
    applyChannelSync();
    pushUi();
    return publicSnapshot();
  });

  ipcMain.handle('live:kick-open', (event, slug) => {
    if (!isUi(event)) return publicSnapshot();
    if (typeof slug === 'string' && /^[A-Za-z0-9_-]{1,50}$/.test(slug)) {
      openOutside(injected.shell, `https://kick.com/${slug}`);
    }
    return publicSnapshot();
  });

  injected.app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return;
    const index = catalog.partitions.findIndex((part) => {
      try {
        return injected.session.fromPartition(part) === contents.session;
      } catch {
        return false;
      }
    });
    if (index < 0) return;
    contents.on('destroyed', () => {
      bays[index] = emptyBayLive();
      applyChannelSync();
      pushUi();
    });
  });
}

function start() {
  stopped = false;
  loadFromDisk();
  pushUi();
  if (runtime.token && runtime.token.accessToken) connectSocket();
}

function stop() {
  stopped = true;
  authorizeBusy = false;
  clearSocket();
}

module.exports = {
  registerLive,
  start,
  stop,
};
