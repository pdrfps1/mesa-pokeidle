const { webContents } = require('electron');

function readUrl(details, url) {
  if (details && typeof details.url === 'string') return details.url;
  return typeof url === 'string' ? url : '';
}

function openOutside(shell, url) {
  let parsed;
  try { parsed = new URL(String(url || '')); } catch { return; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return;
  try { shell.openExternal(parsed.href); } catch { /* o sistema recusou o endereço */ }
}

const GOOGLE_LOGIN_WEB_REQUEST = [
  'https://accounts.google.com/*',
  'https://*.google.com/o/oauth2*',
  'https://*.google.com/gsi/*',
  'https://oauth2.googleapis.com/*',
];

function installGuest(contents, deps) {
  const {
    sessionKind,
    hostKind,
    shell,
    isGoogleLoginUrl,
    onBlockedGoogleLogin,
  } = deps;
  const kindOf = () => sessionKind(contents.session);
  const googleLogin = (url) => typeof isGoogleLoginUrl === 'function' && isGoogleLoginUrl(url);
  let blockedAt = 0;
  const blockGoogleLogin = (wc) => {
    const now = Date.now();
    if (now - blockedAt < 2500) return;
    blockedAt = now;
    if (typeof onBlockedGoogleLogin === 'function') onBlockedGoogleLogin(wc || contents);
  };

  if (kindOf() === 'game' && !contents.session.__mesaGoogleLoginBlock) {
    contents.session.__mesaGoogleLoginBlock = true;
    contents.session.webRequest.onBeforeRequest(
      {
        urls: GOOGLE_LOGIN_WEB_REQUEST,
        types: ['mainFrame', 'subFrame'],
      },
      (details, callback) => {
        const wc = webContents.fromId(details.webContentsId);
        if (!wc || wc.isDestroyed() || wc.getType() !== 'webview' || wc.session !== contents.session) {
          callback({});
          return;
        }
        callback({ cancel: true });
        blockGoogleLogin(wc);
      },
    );
  }

  contents.on('will-navigate', (event, url) => {
    const target = readUrl(event, url);
    if (kindOf() === 'game' && googleLogin(target)) {
      event.preventDefault();
      blockGoogleLogin();
      return;
    }
    if (hostKind(target) === kindOf()) return;
    event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    const target = readUrl(event, url);
    if (kindOf() === 'game' && googleLogin(target)) {
      event.preventDefault();
      blockGoogleLogin();
      return;
    }
    if (hostKind(target) !== kindOf()) event.preventDefault();
  });
  contents.setWindowOpenHandler((details) => {
    const url = details.url || '';
    const kind = kindOf();
    if (kind === 'game' && googleLogin(url)) {
      blockGoogleLogin();
      return { action: 'deny' };
    }
    if (!url || url === 'about:blank' || hostKind(url) === kind) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          width: 500,
          height: 740,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
            session: contents.session,
          },
        },
      };
    }
    if (/^https:\/\//.test(url)) openOutside(shell, url);
    return { action: 'deny' };
  });
}

module.exports = { installGuest, openOutside };
