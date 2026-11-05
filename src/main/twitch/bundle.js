'use strict';

const fs = require('fs');
const path = require('path');

// Junta o script de DOM da Twitch e o preload da janela num arquivo só, em destDir.
function bundleTwitchPreload(destDir, srcDir) {
  const target = path.join(destDir, 'twitch-preload.js');
  const source = [
    fs.readFileSync(path.join(srcDir, 'shared', 'twitch-dom.js'), 'utf8'),
    '\n',
    fs.readFileSync(path.join(srcDir, 'preload', 'twitch-page.js'), 'utf8'),
  ].join('');
  let current = '';
  try { current = fs.readFileSync(target, 'utf8'); } catch { current = ''; }
  if (current !== source) fs.writeFileSync(target, source);
  return target;
}

module.exports = { bundleTwitchPreload };
