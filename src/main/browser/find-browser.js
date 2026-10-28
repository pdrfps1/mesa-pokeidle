const fs = require('fs');
const path = require('path');

function findSystemBrowser(env = process.env) {
  const candidates = [
    [env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'],
    [env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'],
    [env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'],
    [env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'],
    [env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'],
  ];
  for (const [base, rel] of candidates) {
    if (!base) continue;
    const full = path.join(base, rel);
    if (fs.existsSync(full)) return full;
  }
  return '';
}

module.exports = { findSystemBrowser };
