const { app, BrowserWindow, ipcMain, session, shell, webContents } = require('electron');

const path = require('path');
const fs = require('fs');
const catalog = require('../shared/catalog');
const { chromeUserAgent } = require('../shared/chrome-ua');
const { registerLiveAccount } = require('./live-account');
const { registerLive, start: startLive, stop: stopLive } = require('./live/service');
const { installGuest } = require('./live-login');
const {
  registerGameBrowserLogin,
  openLoginBrowser,
  startImportWatch,
} = require('./game-browser-login');
const { findSystemBrowser } = require('./browser/find-browser');
const { bundleGamePreload, loadPageSource, installHuntPageHook } = require('./hunt-hook');
const { registerHuntReference } = require('./hunt-reference');
const { createPerfSampler } = require('./perf-sampler');
const { registerUpdater } = require('./updater');

const UI_PRELOAD = path.join(__dirname, '../preload/ui.js');

app.setName('Mesa');
const mesaData = path.join(app.getPath('appData'), 'Mesa');
fs.mkdirSync(mesaData, { recursive: true });
app.setPath('userData', mesaData);
const GAME_PRELOAD = bundleGamePreload(mesaData, path.join(__dirname, '../preload'));
const HUNT_PAGE_SOURCE = loadPageSource(path.join(__dirname, '../preload'));

app.commandLine.appendSwitch('enable-low-end-device-mode');
app.commandLine.appendSwitch('silent-debugger-extension-api');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=1024');
const DISABLE_BLINK_FEATURES = 'DocumentPictureInPictureAPI,WebAuthentication';
app.commandLine.appendSwitch('disable-blink-features', DISABLE_BLINK_FEATURES);
app.commandLine.appendSwitch(
  'disable-features',
  'CalculateNativeWinOcclusion,TranslateUI,MediaRouter,OptimizationHints,AutofillServerCommunication,BackForwardCache,WebBluetooth',
);
app.commandLine.appendSwitch('disable-smooth-scrolling');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch(
  'host-resolver-rules',
  'MAP use1-turn.fpjs.io localhost, MAP use1-turn.fpjs.io. localhost, MAP eu1-turn.fpjs.io localhost, MAP ap1-turn.fpjs.io localhost, MAP *turn.fpjs.io localhost, MAP *turn.fpjs.io. localhost',
);

const gotLock = app.requestSingleInstanceLock();
let uiContentsId = 0;
let uiWindow = null;
let deskOpen = true;
let windowHot = true;
let deskFocus = null;
const googleLoginInterceptAt = new Map();
const GOOGLE_LOGIN_HINT = 'O login do Google não abre dentro da Mesa. Use «Entrar com Google», entre no jogo no navegador e feche-o — o login entra sozinho nesta baía. Se não entrar, use «Já entrei».';
const loginBrowserDeps = () => ({
  catalog,
  userData: () => app.getPath('userData'),
  browserExe: findSystemBrowser(),
});

function notifyGoogleLoginHint(index) {
  if (!uiWindow || uiWindow.isDestroyed()) return;
  const wc = uiWindow.webContents;
  if (!wc || wc.isDestroyed()) return;
  wc.send('game-login:hint', { index, message: GOOGLE_LOGIN_HINT });
}

function onBlockedGoogleLogin(contents) {
  const index = catalog.partitions.findIndex((part) => session.fromPartition(part) === contents.session);
  if (index < 0) return;
  const now = Date.now();
  const last = googleLoginInterceptAt.get(index) || 0;
  if (now - last < 2500) return;
  googleLoginInterceptAt.set(index, now);
  const opened = openLoginBrowser(loginBrowserDeps(), index, (bay) => {
    if (typeof gameLoginWatchBay === 'function') gameLoginWatchBay(bay);
  });
  if (opened && opened.ok) notifyGoogleLoginHint(index);
}

function focusWindow() {
  const wins = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
  const win = wins.find((item) => item.webContents && !item.webContents.isDestroyed() && item.webContents.id === uiContentsId)
    || wins.find((item) => !item.getParentWindow())
    || wins[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
}

if (!gotLock) {
  app.exit(0);
  app.quit();
} else {
  app.on('second-instance', () => focusWindow());
}

const cfgFile = () => path.join(app.getPath('userData'), 'mesa-config.json');
let cfgMemo;
let cfgTicketSeen = 0;

function readCfgFile(file) {
  try { return catalog.normalize(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return null; }
}

const readCfg = () => {
  if (cfgMemo !== undefined) return cfgMemo;
  const file = cfgFile();
  cfgMemo = readCfgFile(file) || readCfgFile(`${file}.bak`);
  return cfgMemo;
};

function isUi(event) {
  const sender = event && event.sender;
  return !!(sender && !sender.isDestroyed() && sender.id === uiContentsId);
}

registerHuntReference(ipcMain, isUi);

const CHROME_UA = chromeUserAgent();
app.userAgentFallback = CHROME_UA;
const ALLOWED_PERMISSIONS = new Set([
  'fullscreen',
  'clipboard-sanitized-write',
  'pointerLock',
  'storage-access',
  'top-level-storage-access',
]);
const TRACKERS = [
  '*://*.googletagmanager.com/*',
  '*://*.google-analytics.com/*',
  '*://analytics.google.com/*',
  '*://*.doubleclick.net/*',
  '*://connect.facebook.net/*',
  '*://*.facebook.com/tr*',
];

const prepared = new Set();

function hostKind(url) {
  return catalog.liveKind(url);
}

function gameBootPage(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return host === 'pokeidle.io' || host.endsWith('.pokeidle.io');
}

function prepareSession(part, blockTrackers) {
  if (!part || prepared.has(part)) return;
  prepared.add(part);
  const block = typeof blockTrackers === 'boolean' ? blockTrackers : !!(readCfg() || {}).trackers;
  harden(session.fromPartition(part), block);
}

function sessionKind(ses) {
  if (catalog.partitions.some((part) => session.fromPartition(part) === ses)) return 'game';
  return '';
}

function harden(ses, blockTrackers, userAgent = CHROME_UA) {
  ses.setUserAgent(userAgent);
  ses.setSpellCheckerEnabled(false);
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(ALLOWED_PERMISSIONS.has(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
  if (blockTrackers) ses.webRequest.onBeforeRequest({ urls: TRACKERS }, (_details, callback) => callback({ cancel: true }));
}

function replaceCfgFile(file, body) {
  const tmp = `${file}.${process.pid}.tmp`;
  const bak = `${file}.bak`;
  fs.writeFileSync(tmp, body);
  try {
    fs.renameSync(tmp, file);
    return;
  } catch (error) {
    const code = error && error.code;
    if (code !== 'EPERM' && code !== 'EEXIST' && code !== 'EACCES' && code !== 'EBUSY') {
      fs.rmSync(tmp, { force: true });
      throw error;
    }
  }
  try { fs.rmSync(bak, { force: true }); } catch { /* sem backup anterior */ }
  try {
    fs.renameSync(file, bak);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') {
      try { fs.copyFileSync(tmp, file); } finally { fs.rmSync(tmp, { force: true }); }
      return;
    }
  }
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.renameSync(bak, file); } catch { /* o backup fica no lugar */ }
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

function writeCfg(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.bays)) return false;
  const clean = catalog.normalize(data);
  const file = cfgFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    replaceCfgFile(file, JSON.stringify(clean, null, 2));
  } catch {
    return false;
  }
  cfgMemo = clean;
  return true;
}

function acceptCfg(data, ticket) {
  const n = Number(ticket);
  if (Number.isInteger(n) && n < cfgTicketSeen) return true;
  const ok = writeCfg(data);
  if (ok && Number.isInteger(n)) cfgTicketSeen = n;
  return ok;
}

ipcMain.handle('cfg:load', (event) => (isUi(event) ? readCfg() : null));
ipcMain.handle('cfg:save', (event, data, ticket) => (isUi(event) ? acceptCfg(data, ticket) : false));
ipcMain.on('cfg:flush', (event, data, ticket) => {
  try { event.returnValue = isUi(event) ? acceptCfg(data, ticket) : false; } catch { event.returnValue = false; }
});
ipcMain.handle('app:paths', (event) => (isUi(event) ? { config: cfgFile() } : null));
ipcMain.handle('app:open-external', (event, url) => {
  if (!isUi(event) || typeof url !== 'string') return false;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  try { shell.openExternal(parsed.href); return true; } catch { return false; }
});

ipcMain.on('bay:prefs', (event) => {
  const cfg = readCfg() || catalog.normalize({});
  const index = catalog.partitions.findIndex((part) => session.fromPartition(part) === event.sender.session);
  const bay = cfg.bays[index] || {};
  const focused = index === cfg.selected;
  event.returnValue = {
    'cfg-otimizado': cfg.otimizado ? '1' : '0',
    'cfg-night': cfg.night ? '1' : '0',
    'cfg-economia': (!focused || bay.eco) ? '1' : '0',
    'cfg-som': bay.muted ? '0' : '1',
  };
});

function deskIsLive() {
  return deskOpen && windowHot && !!(uiWindow && !uiWindow.isDestroyed());
}

function tuneGuests(selected, playing) {
  if (playing === true || playing === false) deskOpen = playing;
  if (Number.isInteger(selected)) deskFocus = selected;
  const focus = Number.isInteger(deskFocus) ? deskFocus : (readCfg() || catalog.normalize({})).selected;
  const liveDesk = deskIsLive();
  for (const contents of webContents.getAllWebContents()) {
    if (contents.isDestroyed() || contents.getType() !== 'webview') continue;
    const index = catalog.partitions.findIndex((part) => session.fromPartition(part) === contents.session);
    if (index < 0) continue;
    const live = liveDesk && index === focus;
    try { contents.setBackgroundThrottling(!live); } catch { /* política indisponível */ }
    try { contents.setImageAnimationPolicy(live ? 'animate' : 'noAnimation'); } catch { /* política indisponível */ }
  }
}

function bindWindowHeat(win) {
  const cool = () => {
    windowHot = false;
    tuneGuests();
  };
  const warm = () => {
    windowHot = true;
    tuneGuests();
  };
  win.on('minimize', cool);
  win.on('hide', cool);
  win.on('restore', warm);
  win.on('show', warm);
}

ipcMain.on('bay:tune', (event, selected, playing) => {
  if (isUi(event)) tuneGuests(Number.isInteger(selected) ? selected : undefined, playing);
});

const perf = createPerfSampler({
  app,
  webContents,
  session,
  catalog,
  scene: () => ({
    window: windowHot ? 'aberta' : 'minimizada',
    view: deskOpen ? 'mesa' : 'ajustes',
  }),
  uiPid: () => {
    try {
      if (!uiWindow || uiWindow.isDestroyed()) return 0;
      return uiWindow.webContents.getOSProcessId();
    } catch { return 0; }
  },
});

ipcMain.handle('metrics:get', (event) => (isUi(event) ? perf.ramByBay() : []));
ipcMain.handle('perf:report', (event) => (isUi(event) ? perf.summarize() : null));
ipcMain.handle('perf:reset', (event) => (isUi(event) ? perf.reset() : null));

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 1080,
    minWidth: 900,
    minHeight: 720,
    backgroundColor: '#171719',
    title: 'Mesa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: UI_PRELOAD,
      webviewTag: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  uiContentsId = win.webContents.id;
  uiWindow = win;
  bindWindowHeat(win);
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

if (gotLock) app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'window') {
    contents.on('will-attach-webview', (event, prefs, params) => {
      const game = gameBootPage(params.src) && catalog.partitions.includes(params.partition);
      if (!game) {
        event.preventDefault();
        return;
      }
      prepareSession(params.partition);
      prefs.preload = GAME_PRELOAD;
      delete prefs.preloadURL;
      delete prefs.enableBlinkFeatures;
      prefs.sandbox = true;
      prefs.contextIsolation = true;
      prefs.nodeIntegration = false;
      prefs.nodeIntegrationInSubFrames = false;
      prefs.webviewTag = false;
      prefs.webSecurity = true;
      prefs.allowRunningInsecureContent = false;
      prefs.experimentalFeatures = false;
      prefs.disableBlinkFeatures = DISABLE_BLINK_FEATURES;
    });
  }

  if (contents.getType() === 'webview') {
    try { contents.setBackgroundThrottling(true); } catch { /* política indisponível */ }
    const index = catalog.partitions.findIndex((part) => session.fromPartition(part) === contents.session);
    if (index >= 0) {
      try { contents.setZoomMode('isolated'); } catch { /* política indisponível */ }
      installHuntPageHook(contents, HUNT_PAGE_SOURCE);
    }
    tuneGuests();
    installGuest(contents, {
      sessionKind,
      hostKind,
      shell,
      isGoogleLoginUrl: catalog.isGoogleLoginUrl,
      onBlockedGoogleLogin,
    });
  }
});

if (gotLock) app.whenReady().then(() => {
  const saved = readCfg();
  const blockTrackers = !!(saved || {}).trackers;
  for (const part of catalog.partitions) prepareSession(part, blockTrackers);
  perf.start();
  createWindow();
  startLive();
});

let quitFlushed = false;
if (gotLock) app.on('before-quit', (event) => {
  if (quitFlushed) return;
  stopLive();
  event.preventDefault();
  quitFlushed = true;
  const parts = catalog.partitions;
  const jobs = [];
  for (const part of parts) {
    const ses = session.fromPartition(part);
    try { ses.flushStorageData(); } catch { /* a sessão pode ainda não existir */ }
    jobs.push(ses.cookies.flushStore().catch(() => {}));
  }
  const timeout = new Promise((resolve) => { setTimeout(resolve, 2000); });
  Promise.race([Promise.all(jobs), timeout]).finally(() => app.quit());
});

if (gotLock) app.on('window-all-closed', () => app.quit());

if (gotLock) registerLiveAccount({
  ipcMain,
  session,
  catalog,
  isUi,
  userData: () => app.getPath('userData'),
});

let gameLoginWatchBay = null;

function notifyGameLoginResult(index, payload) {
  if (!uiWindow || uiWindow.isDestroyed()) return;
  const wc = uiWindow.webContents;
  if (!wc || wc.isDestroyed()) return;
  wc.send('game-login:result', { index, ...payload });
}

if (gotLock) {
  registerGameBrowserLogin({
    ipcMain,
    session,
    catalog,
    webContents,
    isUi,
    userData: () => app.getPath('userData'),
    chromeUserAgent: () => CHROME_UA,
    notifyLoginResult: notifyGameLoginResult,
  });
  gameLoginWatchBay = (bay) => startImportWatch({
    catalog,
    userData: () => app.getPath('userData'),
    browserExe: findSystemBrowser(),
    session,
    webContents,
    chromeUserAgent: () => CHROME_UA,
    notifyLoginResult: notifyGameLoginResult,
  }, bay);
}

if (gotLock) registerLive({
  ipcMain,
  session,
  catalog,
  isUi,
  app,
  shell,
  getUiWindow: () => uiWindow,
  userData: () => app.getPath('userData'),
});

if (gotLock) registerUpdater({ ipcMain, app, isUi });
