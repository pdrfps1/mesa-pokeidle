const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { findSystemBrowser } = require('./browser/find-browser');
const { cdpRpc, readDevToolsPort, remoteDebuggingCliArgs } = require('./browser/cdp');
const {
  POKEIDLE_ORIGIN,
  POKEIDLE_APP_URL,
  hostOf,
  isPokeidleHost,
  isPokeidleCookie,
  isLoggedInStorage,
  sameSiteForElectron,
  cookieSetUrl,
} = require('../shared/pokeidle-session');

const espera = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const opening = new Set();
const importWatchers = new Map();

const IMPORT_HINT = {
  pending: 'O login no navegador ainda não terminou. Entre no jogo em pokeidle.io, feche o navegador e tente «Já entrei».',
  'no-browser': 'Instale o Microsoft Edge ou o Google Chrome para importar o login.',
  'profile-busy': 'O perfil de login ainda está em uso. Feche todas as janelas do Edge ou Chrome desta baía e tente de novo.',
  failed: 'Não foi possível importar o login. Feche o navegador, entre no jogo e clique em «Já entrei».',
};

function loginProfileDir(userData, partition) {
  const id = String(partition || '').replace(/^persist:/, '');
  return path.join(userData, 'login', id || 'mesa');
}

function clearLoginProfile(userData, partition) {
  fs.rmSync(loginProfileDir(userData, partition), { recursive: true, force: true });
}

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

function isLoginBrowserRunning(profileDir) {
  const lockfile = path.join(profileDir, 'lockfile');
  if (!fs.existsSync(lockfile)) return false;
  try {
    const pid = parseInt(String(fs.readFileSync(lockfile, 'utf8')).trim().split(/\s+/)[0], 10);
    if (!Number.isFinite(pid) || pid <= 0) return true;
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') {
      fs.rmSync(lockfile, { force: true });
      return false;
    }
    return true;
  }
}

async function navigateHeadlessTab(wsUrl, url) {
  await cdpRpc(wsUrl, 'Page.enable').catch(() => {});
  await cdpRpc(wsUrl, 'Page.navigate', { url });
  for (let i = 0; i < 40; i += 1) {
    await espera(250);
    const ready = await cdpRpc(wsUrl, 'Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    }).catch(() => null);
    if (ready && ready.result.value === 'complete') break;
  }
}

async function listDevToolsPages(base) {
  const list = await (await fetch(`${base}/json/list`)).json();
  return Array.isArray(list) ? list : [];
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

async function closeHeadlessBrowser(browserWsUrl) {
  if (!browserWsUrl) return;
  await cdpRpc(browserWsUrl, 'Browser.close').catch(() => {});
}

async function readSessionViaHeadless(browserExe, profileDir) {
  const arqPorta = path.join(profileDir, 'DevToolsActivePort');
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    fs.rmSync(arqPorta, { force: true });
    const child = spawn(
      browserExe,
      [
        '--headless=new',
        `--user-data-dir=${profileDir}`,
        ...remoteDebuggingCliArgs(),
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank',
      ],
      { stdio: 'ignore' },
    );
    try {
      for (let i = 0; i < 24 && !fs.existsSync(arqPorta); i += 1) await espera(250);
      const port = readDevToolsPort(profileDir, fs);
      if (!port) continue;
      const base = `http://127.0.0.1:${port}`;
      const version = await (await fetch(`${base}/json/version`)).json();
      const browserWsUrl = version.webSocketDebuggerUrl;
      const userAgent = version['User-Agent'] || '';

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

      await closeHeadlessBrowser(browserWsUrl);
      if (sessao && isLoggedInStorage(sessao.storage)) {
        return { ...sessao, userAgent };
      }
      return null;
    } catch {
      // perfil ainda em uso ou navegador lento para subir
    } finally {
      child.kill();
    }
    await espera(2000);
  }
  return null;
}

async function applySession(deps, bayIndex, { storage, cookies, userAgent }) {
  const { session, catalog, webContents, chromeUserAgent } = deps;
  const part = catalog.partitions[bayIndex];
  const ses = session.fromPartition(part);
  if (userAgent) ses.setUserAgent(userAgent);
  else ses.setUserAgent(chromeUserAgent());
  for (const cookie of cookies) {
    await ses.cookies.set({
      url: cookieSetUrl(cookie),
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: sameSiteForElectron(cookie.sameSite),
      ...(cookie.expires > 0 ? { expirationDate: cookie.expires } : {}),
    }).catch(() => {});
  }
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
  const sessao = await readSessionViaHeadless(browserExe, profileDir).catch(() => null);
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
  const handle = importWatchers.get(bay);
  if (handle) clearInterval(handle);
  importWatchers.delete(bay);
}

function startImportWatch(fullDeps, bay) {
  stopImportWatch(bay);
  const profileDir = loginProfileDir(fullDeps.userData(), fullDeps.catalog.partitions[bay]);
  let sawBrowser = false;
  const handle = setInterval(async () => {
    const running = isLoginBrowserRunning(profileDir);
    if (running) {
      sawBrowser = true;
      return;
    }
    if (!sawBrowser) return;
    stopImportWatch(bay);
    await espera(1000);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (isLoginBrowserRunning(profileDir)) {
        startImportWatch(fullDeps, bay);
        return;
      }
      const result = await importLoginSession(fullDeps, bay);
      if (result.ok) {
        sendLoginResult(fullDeps, bay, result);
        return;
      }
      if (result.reason === 'browser-open') {
        await espera(1500);
        continue;
      }
      if (result.reason === 'pending' && attempt < 5) {
        await espera(2000);
        continue;
      }
      sendLoginResult(fullDeps, bay, result);
      return;
    }
    sendLoginResult(fullDeps, bay, { ok: false, reason: 'failed' });
  }, 1000);
  importWatchers.set(bay, handle);
}

function openLoginBrowser(deps, index, onOpened) {
  const { catalog, userData, browserExe: browserExeArg } = deps;
  const browserExe = browserExeArg || findSystemBrowser();
  const bay = Number(index);
  if (!Number.isInteger(bay) || bay < 0 || bay >= catalog.partitions.length) {
    return { ok: false, error: 'bay' };
  }
  if (!browserExe) return { ok: false, error: 'no-browser' };
  if (opening.has(bay)) return { ok: true };
  opening.add(bay);
  const profileDir = loginProfileDir(userData(), catalog.partitions[bay]);
  fs.mkdirSync(profileDir, { recursive: true });
  fs.rmSync(path.join(profileDir, 'DevToolsActivePort'), { force: true });
  try {
    spawn(
      browserExe,
      [
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--new-window',
        POKEIDLE_APP_URL,
      ],
      { detached: true, stdio: 'ignore' },
    ).unref();
    if (typeof onOpened === 'function') onOpened(bay);
    return { ok: true };
  } catch {
    return { ok: false, error: 'spawn' };
  } finally {
    opening.delete(bay);
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
