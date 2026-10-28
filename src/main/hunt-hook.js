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
  let hookReady = false;
  let queued = '';
  try { contents.debugger.attach('1.3'); } catch { return; }
  contents.debugger.on('message', () => {});
  const ready = contents.debugger.sendCommand('Page.enable')
    .then(() => contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source,
      runImmediately: true,
    }))
    .then(() => true, () => false);
  contents.on('will-navigate', (event, url) => {
    if (hookReady) return;
    const target = typeof url === 'string' ? url : '';
    if (!/^https:\/\//.test(target)) return;
    event.preventDefault();
    queued = target;
  });
  ready.then((ok) => {
    hookReady = true;
    const next = queued;
    queued = '';
    if (!ok || !next || contents.isDestroyed()) return;
    contents.loadURL(next);
  });
}

module.exports = { bundleGamePreload, loadPageSource, installHuntPageHook };
