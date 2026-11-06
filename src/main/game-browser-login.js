const { findSystemBrowser } = require('./browser/find-browser');
const {
  loginProfileDir,
  clearLoginProfile,
  isLoginBrowserRunning,
  listDevToolsPages,
  navigateHeadlessTab,
  openProfileBrowser,
  readViaHeadless,
  applyCookies,
  createImportWatcher,
} = require('./browser/profile-login');
const { cdpRpc } = require('./browser/cdp');
const {
  POKEIDLE_ORIGIN,
  POKEIDLE_APP_URL,
  hostOf,
  isPokeidleHost,
  isPokeidleCookie,
  isLoggedInStorage,
} = require('../shared/pokeidle-session');

const espera = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const importWatcher = createImportWatcher();

const IMPORT_HINT = {
  pending: 'O login no navegador ainda não terminou. Entre no jogo em pokeidle.io, feche o navegador e tente «Já entrei».',
  'no-browser': 'Instale o Microsoft Edge ou o Google Chrome para importar o login.',
  'profile-busy': 'O perfil de login ainda está em uso. Feche todas as janelas do Edge ou Chrome desta baía e tente de novo.',
  failed: 'Não foi possível importar o login. Feche o navegador, entre no jogo e clique em «Já entrei».',
};

function webContentsForBay(webContents, session, catalog, bayIndex) {
  const part = catalog.partitions[bayIndex];
  if (!part) return null;
  const ses = session.fromPartition(part);
  for (const contents of webContents.getAllWebContents()) {
    if (contents.isDestroyed() || contents.getType() !== 'webview') continue;
    if (contents.session === ses) return contents;
  }
  return null;
}

async function readSessionFromTarget(wsUrl) {
  const storageResult = await cdpRpc(wsUrl, 'Runtime.evaluate', {
    expression: 'JSON.stringify(localStorage)',
    returnByValue: true,
  });
  let storage = {};
  try { storage = JSON.parse(storageResult.result.value || '{}'); } catch { storage = {}; }
  if (!isLoggedInStorage(storage)) return null;
  const { cookies } = await cdpRpc(wsUrl, 'Network.getCookies', { urls: [POKEIDLE_ORIGIN] });
  return { storage, cookies: (cookies || []).filter(isPokeidleCookie) };
}

async function readSessionFromPages(base) {
  const tabs = await listDevToolsPages(base);
  for (const tab of tabs) {
    if (!tab || tab.type !== 'page' || !tab.webSocketDebuggerUrl) continue;
    if (!isPokeidleHost(hostOf(tab.url))) continue;
    const sessao = await readSessionFromTarget(tab.webSocketDebuggerUrl).catch(() => null);
    if (sessao) return sessao;
  }
  return null;
}

// Leitor do jogo: lê o localStorage e os cookies do jogo, e navega a aba headless até o jogo se faltar sessão.
async function leitorDoJogo({ base, userAgent }) {
  let sessao = await readSessionFromPages(base);
  if (!sessao) {
    const tabs = await listDevToolsPages(base);
    const pageTab = tabs.find((t) => t && t.type === 'page' && t.webSocketDebuggerUrl);
    if (pageTab) {
      await navigateHeadlessTab(pageTab.webSocketDebuggerUrl, POKEIDLE_APP_URL);
      for (let poll = 0; poll < 48 && !sessao; poll += 1) {
        await espera(500);
        sessao = await readSessionFromPages(base);
      }
    }
  }
  if (sessao && isLoggedInStorage(sessao.storage)) {
    return { ...sessao, userAgent };
  }
  return null;
}

async function applySession(deps, bayIndex, { storage, cookies, userAgent }) {
  const { session, catalog, webContents, chromeUserAgent } = deps;
  const part = catalog.partitions[bayIndex];
  const ses = session.fromPartition(part);
  if (userAgent) ses.setUserAgent(userAgent);
  else ses.setUserAgent(chromeUserAgent());
  await applyCookies(ses, cookies);
  const wc = webContentsForBay(webContents, session, catalog, bayIndex);
  if (!wc) return true;
  const currentHost = hostOf(wc.getURL());
  if (!isPokeidleHost(currentHost)) {
    await wc.loadURL(POKEIDLE_APP_URL);
    await new Promise((resolve) => wc.once('did-finish-load', resolve));
  } else if (wc.isLoading()) {
    await new Promise((resolve) => wc.once('did-finish-load', resolve));
  }
  const payload = JSON.stringify(storage);
  await wc.executeJavaScript(`(() => {
    const data = ${payload};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') localStorage.setItem(key, value);
    }
  })()`);
  wc.reload();
  return true;
}

async function importLoginSession(fullDeps, bay) {
  const { browserExe, userData, catalog, session, webContents, chromeUserAgent } = fullDeps;
  if (!browserExe) return { ok: false, reason: 'no-browser' };
  const profileDir = loginProfileDir(userData(), catalog.partitions[bay]);
  if (isLoginBrowserRunning(profileDir)) {
    return { ok: false, reason: 'browser-open' };
  }
  const sessao = await readViaHeadless(browserExe, profileDir, leitorDoJogo).catch(() => null);
  if (!sessao || !isLoggedInStorage(sessao.storage)) {
    return { ok: false, reason: 'pending' };
  }
  await applySession(
    { session, catalog, webContents, chromeUserAgent },
    bay,
    sessao,
  );
  return { ok: true };
}

function sendLoginResult(deps, bay, result) {
  const notify = deps.notifyLoginResult;
  if (typeof notify !== 'function') return;
  const message = result.ok ? '' : (IMPORT_HINT[result.reason] || IMPORT_HINT.failed);
  notify(bay, { ...result, message });
}

function stopImportWatch(bay) {
  importWatcher.stop(bay);
}

function startImportWatch(fullDeps, bay) {
  const profileDir = loginProfileDir(fullDeps.userData(), fullDeps.catalog.partitions[bay]);
  importWatcher.start(
    bay,
    profileDir,
    () => importLoginSession(fullDeps, bay),
    (result) => sendLoginResult(fullDeps, bay, result),
  );
}

function openLoginBrowser(deps, index, onOpened) {
  const { catalog, userData, browserExe: browserExeArg } = deps;
  const browserExe = browserExeArg || findSystemBrowser();
  const bay = Number(index);
  if (!Number.isInteger(bay) || bay < 0 || bay >= catalog.partitions.length) {
    return { ok: false, error: 'bay' };
  }
  if (!browserExe) return { ok: false, error: 'no-browser' };
  const profileDir = loginProfileDir(userData(), catalog.partitions[bay]);
  const aberto = openProfileBrowser({ browserExe, profileDir, url: POKEIDLE_APP_URL, spawn: deps.spawn });
  if (!aberto.ok) return aberto;
  // Já estava abrindo: como antes, devolve ok sem chamar onOpened.
  if (aberto.ja) return { ok: true };
  try {
    if (typeof onOpened === 'function') onOpened(bay);
    return { ok: true };
  } catch {
    return { ok: false, error: 'spawn' };
  }
}

function registerGameBrowserLogin(deps) {
  const {
    ipcMain,
    session,
    catalog,
    webContents,
    isUi,
    userData,
    chromeUserAgent,
    notifyLoginResult,
  } = deps;
  const browserExe = findSystemBrowser();
  const fullDeps = {
    catalog,
    userData,
    browserExe,
    session,
    webContents,
    chromeUserAgent,
    notifyLoginResult,
  };
  const loginDeps = { catalog, userData, browserExe };

  const fromUi = (event) => typeof isUi === 'function' && isUi(event);

  ipcMain.handle('game-login:open', async (event, index) => {
    if (!fromUi(event)) return { ok: false, error: 'denied' };
    const result = openLoginBrowser(loginDeps, index, (bay) => startImportWatch(fullDeps, bay));
    return result;
  });

  ipcMain.handle('game-login:import', async (event, index) => {
    if (!fromUi(event)) return { ok: false, reason: 'denied' };
    const bay = Number(index);
    if (!Number.isInteger(bay) || bay < 0 || bay >= catalog.partitions.length) return { ok: false, reason: 'bay' };
    const result = await importLoginSession(fullDeps, bay);
    if (result.ok) sendLoginResult(fullDeps, bay, result);
    return result;
  });
}

module.exports = {
  registerGameBrowserLogin,
  openLoginBrowser,
  clearLoginProfile,
  loginProfileDir,
  isLoginBrowserRunning,
  startImportWatch,
  stopImportWatch,
  importLoginSession,
  IMPORT_HINT,
};
