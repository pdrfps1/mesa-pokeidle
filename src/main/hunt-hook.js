const fs = require('fs');
const path = require('path');

function bundleGamePreload(destDir, preloadDir) {
  const target = path.join(destDir, 'game-preload.js');
  const source = [
    fs.readFileSync(path.join(preloadDir, 'hunt-bridge.js'), 'utf8'),
    '\n',
    fs.readFileSync(path.join(preloadDir, 'game.js'), 'utf8'),
  ].join('');
  let current = '';
  try { current = fs.readFileSync(target, 'utf8'); } catch { current = ''; }
  if (current !== source) fs.writeFileSync(target, source);
  return target;
}

function loadPageSource(preloadDir) {
  const reader = fs.readFileSync(path.join(preloadDir, 'hunt-page-state.js'), 'utf8');
  const socket = fs.readFileSync(path.join(preloadDir, 'hunt-page.js'), 'utf8');
  return `(function () {\nif (window.__mesaHuntPage) return;\nwindow.__mesaHuntPage = true;\n${reader}\n${socket}\n})();\n`;
}

function installHuntPageHook(contents, source) {
  if (!contents || contents.isDestroyed() || !source) return;
  let arming = false;
  let ready = false;
  let broken = false;
  let pass = false;
  let queued = '';

  function detachQuiet() {
    ready = false;
    try {
      if (contents.isDestroyed() || !contents.debugger.isAttached()) return;
      contents.debugger.detach();
    } catch { /* já solto */ }
  }

  function arm() {
    if (broken || contents.isDestroyed()) return Promise.resolve(false);
    try {
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
      return contents.debugger.sendCommand('Page.enable')
        .then(() => contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
          source,
          runImmediately: true,
        }))
        .then(() => {
          ready = true;
          return true;
        })
        .catch(() => false);
    } catch {
      broken = true;
      return Promise.resolve(false);
    }
  }

  function release() {
    if (arming || broken || contents.isDestroyed()) return;
    arming = true;
    arm().then((ok) => {
      arming = false;
      const next = queued;
      queued = '';
      if (contents.isDestroyed()) return;
      if (!ok) {
        detachQuiet();
        if (!next) return;
        pass = true;
        contents.loadURL(next).catch(() => { pass = false; });
        return;
      }
      if (!next) return;
      contents.loadURL(next).catch(() => detachQuiet());
    }).catch(() => {
      arming = false;
      detachQuiet();
    });
  }

  contents.on('will-navigate', (event, url) => {
    const target = typeof url === 'string' ? url : '';
    if (!/^https:\/\//.test(target) || broken || ready) return;
    if (pass) {
      pass = false;
      return;
    }
    event.preventDefault();
    queued = target;
    release();
  });

  contents.on('did-finish-load', () => {
    if (arming || queued || contents.isDestroyed()) return;
    let url = '';
    try { url = contents.getURL(); } catch { return; }
    if (!/^https:\/\//.test(url)) return;
    detachQuiet();
  });

  release();
}

module.exports = { bundleGamePreload, loadPageSource, installHuntPageHook };
