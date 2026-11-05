'use strict';

const {
  sanitizeLivePatch,
  applyBayPatch,
  emptyBayLive,
  toPublicSnapshot,
} = require('../../shared/live-catalog');
const { openOutside } = require('../live-login');

let controlo = null;

function criarControlo(injected) {
  const { ipcMain, session, catalog, isUi, app, shell, getUiWindow, twitch } = injected;
  const bays = [emptyBayLive(), emptyBayLive(), emptyBayLive(), emptyBayLive()];
  let ultimoEnvio = '';

  function publicSnapshot() {
    return { ...toPublicSnapshot(bays), twitch: twitch.snapshot() };
  }

  function pushUi() {
    const win = typeof getUiWindow === 'function' ? getUiWindow() : null;
    if (!win || win.isDestroyed()) return;
    const contents = win.webContents;
    if (!contents || contents.isDestroyed()) return;
    const marca = JSON.stringify([toPublicSnapshot(bays), twitch.marca()]);
    if (marca === ultimoEnvio) return;
    ultimoEnvio = marca;
    contents.send('live:status', publicSnapshot());
  }

  function indiceDaBaia(sender) {
    const senderPath = (() => {
      try { return sender.session.getStoragePath() || ''; } catch { return ''; }
    })();
    return catalog.partitions.findIndex((part) => {
      try {
        const ses = session.fromPartition(part);
        if (ses === sender.session) return true;
        const path = ses.getStoragePath() || '';
        return senderPath !== '' && path === senderPath;
      } catch {
        return false;
      }
    });
  }

  function registrarJogo(index) {
    const bay = bays[index];
    twitch.setJogo(index, {
      ativo: true,
      twitch: bay.twitch.recebido ? bay.twitch : null,
      offsetMs: bay.offsetMs || 0,
    });
  }

  ipcMain.on('live:frame', (event, rawPatch) => {
    const index = indiceDaBaia(event.sender);
    if (index < 0) return;
    const patch = sanitizeLivePatch(rawPatch);
    if (!patch) return;
    bays[index] = applyBayPatch(bays[index], patch, Date.now());
    registrarJogo(index);
    pushUi();
  });

  ipcMain.handle('live:get', () => publicSnapshot());

  ipcMain.handle('live:kick-open', (event, slug) => {
    if (!isUi(event)) return publicSnapshot();
    if (typeof slug === 'string' && /^[A-Za-z0-9_-]{1,50}$/.test(slug)) {
      openOutside(shell, `https://kick.com/${slug}`);
    }
    return publicSnapshot();
  });

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return;
    const index = catalog.partitions.findIndex((part) => {
      try {
        return session.fromPartition(part) === contents.session;
      } catch {
        return false;
      }
    });
    if (index < 0) return;
    // Sem sessão do jogo, a janela da Twitch desta baía deixa de ter motivo para ficar aberta.
    const zerar = () => {
      bays[index] = emptyBayLive();
      twitch.setJogo(index, { ativo: false, twitch: null, offsetMs: 0 });
      pushUi();
    };
    contents.on('destroyed', zerar);
    contents.on('did-navigate', zerar);
  });

  twitch.onChange(pushUi);

  return {
    start() {
      twitch.start();
      pushUi();
    },
    stop() {
      twitch.encerrar();
    },
  };
}

function registerLive(injected) {
  controlo = criarControlo(injected);
}

function start() {
  if (controlo) controlo.start();
}

function stop() {
  if (controlo) controlo.stop();
}

module.exports = {
  registerLive,
  start,
  stop,
};
