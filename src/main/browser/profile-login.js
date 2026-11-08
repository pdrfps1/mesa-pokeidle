'use strict';

// Peças de login por perfil de navegador, sem jogo: usadas pelo login do jogo e pelo login da Twitch.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { cdpRpc, readDevToolsPort, remoteDebuggingCliArgs } = require('./cdp');
const { cookieSetUrl, sameSiteForElectron } = require('../../shared/pokeidle-session');

const espera = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const opening = new Set();

function loginProfileDir(userData, partition) {
  const id = String(partition || '').replace(/^persist:/, '');
  return path.join(userData, 'login', id || 'mesa');
}

function clearLoginProfile(userData, partition) {
  fs.rmSync(loginProfileDir(userData, partition), { recursive: true, force: true });
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

async function closeHeadlessBrowser(browserWsUrl) {
  if (!browserWsUrl) return;
  await cdpRpc(browserWsUrl, 'Browser.close').catch(() => {});
}

// Abre o navegador do sistema no perfil dado, sem depuração. Mesmos argumentos e guarda por perfil.
function openProfileBrowser({ browserExe, profileDir, url, spawn: lancar = spawn }) {
  if (!browserExe) return { ok: false, error: 'no-browser' };
  // Já aberto por outra chamada: devolve ja para quem chama não repetir o efeito.
  if (opening.has(profileDir)) return { ok: true, ja: true };
  opening.add(profileDir);
  fs.mkdirSync(profileDir, { recursive: true });
  fs.rmSync(path.join(profileDir, 'DevToolsActivePort'), { force: true });
  try {
    lancar(
      browserExe,
      [
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--new-window',
        url,
      ],
      { detached: true, stdio: 'ignore' },
    ).unref();
    return { ok: true };
  } catch {
    return { ok: false, error: 'spawn' };
  } finally {
    opening.delete(profileDir);
  }
}

// Leitura headless do perfil: 8 tentativas, o leitor recebe { base, browserWsUrl, userAgent }.
// Um erro do leitor passa para a próxima tentativa; um resultado nulo termina com null.
async function readViaHeadless(browserExe, profileDir, reader) {
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
      const resultado = await reader({ base, browserWsUrl, userAgent });
      await closeHeadlessBrowser(browserWsUrl);
      return resultado || null;
    } catch {
      // perfil ainda em uso ou navegador lento para subir: tenta de novo
    } finally {
      child.kill();
    }
    await espera(2000);
  }
  return null;
}

// continuar() diz se a cópia ainda vale; falso no meio para e devolve false.
async function applyCookies(ses, cookies, continuar = () => true) {
  for (const cookie of cookies) {
    if (!continuar()) return false;
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
  return true;
}

// Vigia o navegador de login de uma chave (baía). Depois que ele aparece e fecha, tenta importar.
// Tempos: 1 s de vigia, 1 s após fechar, 1,5 s se o perfil ainda estiver aberto, 2 s entre pendências (até a 5ª).
function createImportWatcher(opcoes = {}) {
  const {
    intervaloMs = 1000,
    fechouMs = 1000,
    abertoMs = 1500,
    pendenteMs = 2000,
    isRunning = isLoginBrowserRunning,
    espera: pausa = espera,
  } = opcoes;
  const watchers = new Map();
  const chaves = new Set();
  // Geração por chave: stop() de fora invalida o laço em andamento. start() e o vigia interno não invalidam.
  const geracoes = new Map();
  const geracaoDe = (key) => geracoes.get(key) || 0;

  // Desliga só o intervalo do vigia. Não mexe na geração.
  function parar(key) {
    const handle = watchers.get(key);
    if (handle) clearInterval(handle);
    watchers.delete(key);
  }

  function start(key, profileDir, runImport, notify) {
    parar(key);
    chaves.add(key);
    const g = geracaoDe(key);
    const vigente = () => geracaoDe(key) === g;
    let sawBrowser = false;
    const handle = setInterval(async () => {
      const running = isRunning(profileDir);
      if (running) {
        sawBrowser = true;
        return;
      }
      if (!sawBrowser) return;
      parar(key);
      await pausa(fechouMs);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (!vigente()) return;
        if (isRunning(profileDir)) {
          start(key, profileDir, runImport, notify);
          return;
        }
        const result = await runImport();
        if (!vigente()) return;
        if (result.ok) {
          notify(result);
          return;
        }
        if (result.reason === 'browser-open') {
          await pausa(abertoMs);
          continue;
        }
        if (result.reason === 'pending' && attempt < 5) {
          await pausa(pendenteMs);
          continue;
        }
        notify(result);
        return;
      }
      if (vigente()) notify({ ok: false, reason: 'failed' });
    }, intervaloMs);
    watchers.set(key, handle);
  }

  // Para o vigia e invalida qualquer laço de importação que ainda esteja no meio.
  function stop(key) {
    parar(key);
    geracoes.set(key, geracaoDe(key) + 1);
  }

  function stopAll() {
    for (const key of Array.from(chaves)) stop(key);
  }

  return { start, stop, stopAll };
}

module.exports = {
  loginProfileDir,
  clearLoginProfile,
  isLoginBrowserRunning,
  listDevToolsPages,
  navigateHeadlessTab,
  closeHeadlessBrowser,
  openProfileBrowser,
  readViaHeadless,
  applyCookies,
  createImportWatcher,
};
