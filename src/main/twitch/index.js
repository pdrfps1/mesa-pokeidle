'use strict';

const fs = require('fs');
const path = require('path');
const P = require('./points');
const { createTwitchController, TICK_MS } = require('./controller');
const { createTwitchWindows } = require('./windows');
const { bundleTwitchPreload } = require('./bundle');
const { createTwitchBrowserLogin, sairDaBaia } = require('./browser-login');
const { criarLeitorDeLogin, sairComInvalidacao } = require('./login-reader');
const { openOutside } = require('../live-login');
const { caminhoPadrao, registrarErro } = require('./erros-log');

const VIGIA_LOGIN_RAPIDO_MS = 3000;
const VIGIA_LOGIN_MS = 30000;
const BAYS = 4;

function registerTwitch(deps) {
  const { ipcMain, session, BrowserWindow, shell, catalog, isUi, userData, srcDir, prepareSession, prefs } = deps;

  // Versões antigas guardavam tokens nesse arquivo (D11). Apagar é idempotente.
  try { fs.rmSync(path.join(userData(), 'mesa-twitch.json'), { force: true }); } catch { /* já não existe */ }

  const preloadPath = bundleTwitchPreload(userData(), srcDir);
  const listeners = [];
  let controller = null;

  const janelas = createTwitchWindows({
    BrowserWindow,
    session,
    catalog,
    preloadPath,
    prepareSession,
    shell,
    openOutside,
    querManter: (i) => controller.querJanela(i),
    aoEsconder: (i) => controller.janelaEscondida(i),
    aoFechar: (i) => controller.janelaFechada(i),
    aoErroPagina: (i) => controller.erroPagina(i),
  });

  const caminhoLog = caminhoPadrao(userData());
  controller = createTwitchController({
    janelas,
    prefs,
    agora: () => Date.now(),
    onChange: () => {
      for (const fn of listeners) fn();
    },
    registrarErro: (entrada) => registrarErro(entrada, { caminho: caminhoLog, agora: () => Date.now() }),
  });

  const browserLogin = createTwitchBrowserLogin({
    catalog,
    session,
    userData,
    aoEstado: (i, dados) => controller.navegadorEstado(i, dados),
  });

  const lidoEm = [0, 0, 0, 0];
  let tickTimer = null;
  let loginTimer = null;

  const leitorLogin = criarLeitorDeLogin({
    ler: (i) => janelas.lerLogin(i),
    aplicar: (i, login) => controller.setLoginTwitch(i, login),
  });

  function lerLoginDe(i) {
    lidoEm[i] = Date.now();
    return leitorLogin.ler(i);
  }

  function vigiarLogin() {
    const agora = Date.now();
    for (let i = 0; i < BAYS; i += 1) {
      const rapido = controller.precisaLoginRapido(i) && agora - lidoEm[i] >= VIGIA_LOGIN_RAPIDO_MS;
      if (rapido || agora - lidoEm[i] >= VIGIA_LOGIN_MS) lerLoginDe(i);
    }
  }

  function bayValida(i) {
    return Number.isInteger(i) && i >= 0 && i < BAYS;
  }

  // A página manda fatos a cada 3 s e, quando um comando termina, o resultado.
  ipcMain.on('twitch:pagina', (event, payload) => {
    const k = janelas.streamOf(event.sender);
    if (k < 0) return;
    const fatos = P.limparFatos(payload && payload.fatos);
    if (fatos) controller.pagina(k, fatos);
    const resultado = P.limparResultado(payload && payload.resultado);
    if (resultado) controller.resultado(k, resultado);
  });

  ipcMain.handle('twitch:entrar', (event, i) => {
    if (!isUi(event) || !bayValida(i)) return controller.snapshot();
    controller.entrar(i);
    lerLoginDe(i);
    return controller.snapshot();
  });

  // A vaga s (0 a 3) é a live da baía; sem s válido, vale a vaga 0.
  ipcMain.handle('twitch:mostrar', (event, i, on, s) => {
    if (!isUi(event) || !bayValida(i)) return controller.snapshot();
    const vaga = Number.isInteger(s) && s >= 0 && s <= 3 ? s : 0;
    controller.mostrar(i + BAYS * vaga, on === true);
    return controller.snapshot();
  });

  ipcMain.handle('twitch:navegador', (event, i) => {
    if (!isUi(event) || !bayValida(i)) return controller.snapshot();
    browserLogin.abrir(i);
    return controller.snapshot();
  });

  ipcMain.handle('twitch:ja-entrei', async (event, i) => {
    if (!isUi(event) || !bayValida(i)) return controller.snapshot();
    await browserLogin.importar(i);
    return controller.snapshot();
  });

  ipcMain.handle('twitch:sair', async (event, i) => {
    if (!isUi(event) || !bayValida(i)) return controller.snapshot();
    await sairComInvalidacao(leitorLogin, i, () => sairDaBaia(controller, browserLogin, i));
    return controller.snapshot();
  });

  function start() {
    if (tickTimer) return;
    for (let i = 0; i < BAYS; i += 1) lerLoginDe(i);
    tickTimer = setInterval(() => controller.tick(), TICK_MS);
    loginTimer = setInterval(vigiarLogin, VIGIA_LOGIN_RAPIDO_MS);
  }

  function encerrar() {
    if (tickTimer) clearInterval(tickTimer);
    if (loginTimer) clearInterval(loginTimer);
    tickTimer = null;
    loginTimer = null;
    browserLogin.pararTudo();
    janelas.encerrar();
  }

  return {
    setJogo: (i, dados) => controller.setJogo(i, dados),
    snapshot: () => controller.snapshot(),
    marca: () => controller.marca(),
    onChange(fn) {
      if (typeof fn === 'function') listeners.push(fn);
    },
    start,
    encerrar,
  };
}

module.exports = { registerTwitch };
