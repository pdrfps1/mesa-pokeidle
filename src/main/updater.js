const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');

const RELEASES_LATEST = 'https://api.github.com/repos/pdrfps1/mesa-pokeidle/releases/latest';
const CDN_HOSTS = new Set([
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com',
]);

function isAllowedUpdateUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host === 'api.github.com') {
    return url.pathname === '/repos/pdrfps1/mesa-pokeidle/releases/latest';
  }
  if (host === 'github.com') {
    return url.pathname.startsWith('/pdrfps1/mesa-pokeidle/releases/');
  }
  return CDN_HOSTS.has(host);
}

function isReleaseAssetUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (url.hostname.toLowerCase() !== 'github.com') return false;
  return /^\/pdrfps1\/mesa-pokeidle\/releases\/download\/[^/]+\/Mesa\.exe$/i.test(url.pathname);
}

function nextHop(current, location) {
  const next = new URL(location, current).href;
  if (!isAllowedUpdateUrl(next)) throw new Error('url');
  return next;
}

function userAgent(appVersion) {
  return `MesaPokeidle/${appVersion || '0.0.0'}`;
}

function parseSemver(value) {
  const match = String(value || '').match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function requestJson(url, headers) {
  return new Promise((resolve, reject) => {
    if (!isAllowedUpdateUrl(url)) {
      reject(new Error('url'));
      return;
    }
    const follow = (target, redirects) => {
      if (redirects > 8) {
        reject(new Error('redirects'));
        return;
      }
      const req = https.get(target, { headers }, (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          let next;
          try { next = nextHop(target, res.headers.location); } catch (error) {
            reject(error);
            return;
          }
          follow(next, redirects + 1);
          return;
        }
        if (code < 200 || code >= 300) {
          res.resume();
          reject(new Error(`http-${code}`));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (error) {
            reject(error);
          }
        });
      });
      req.on('error', reject);
    };
    follow(url, 0);
  });
}

function downloadToFile(url, dest, headers) {
  return new Promise((resolve, reject) => {
    if (!isReleaseAssetUrl(url)) {
      reject(new Error('url'));
      return;
    }
    const tmp = `${dest}.${process.pid}.part`;
    const follow = (target, redirects) => {
      if (redirects > 12) {
        reject(new Error('redirects'));
        return;
      }
      const req = https.get(target, { headers }, (res) => {
        const code = res.statusCode || 0;
        if (code >= 300 && code < 400 && res.headers.location) {
          res.resume();
          let next;
          try { next = nextHop(target, res.headers.location); } catch (error) {
            reject(error);
            return;
          }
          follow(next, redirects + 1);
          return;
        }
        if (code < 200 || code >= 300) {
          res.resume();
          reject(new Error(`http-${code}`));
          return;
        }
        const file = fs.createWriteStream(tmp);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            try {
              fs.renameSync(tmp, dest);
              resolve();
            } catch (error) {
              try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
              reject(error);
            }
          });
        });
        file.on('error', (error) => {
          try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
          reject(error);
        });
      });
      req.on('error', reject);
    };
    follow(url, 0);
  });
}

function findMesaAsset(assets) {
  if (!Array.isArray(assets)) return null;
  return assets.find((item) => item && typeof item.name === 'string' && item.name.toLowerCase() === 'mesa.exe') || null;
}

function psEscape(value) {
  return String(value).replace(/'/g, "''");
}

function schedulePortableReplace({ userData, parentPid, newExe, targetExe }) {
  const dir = path.join(userData, 'updates');
  fs.mkdirSync(dir, { recursive: true });
  const scriptPath = path.join(dir, 'mesa-apply-update.ps1');
  const body = [
    '$ErrorActionPreference = "Stop"',
    `$parent = ${Number(parentPid)}`,
    `$src = '${psEscape(newExe)}'`,
    `$dst = '${psEscape(targetExe)}'`,
    'Wait-Process -Id $parent -ErrorAction SilentlyContinue',
    'Start-Sleep -Milliseconds 800',
    'try {',
    '  Copy-Item -LiteralPath $src -Destination $dst -Force',
    '  Start-Process -LiteralPath $dst',
    '} catch {',
    '  if (Test-Path -LiteralPath $dst) { Start-Process -LiteralPath $dst }',
    '}',
    `Remove-Item -LiteralPath '${psEscape(scriptPath)}' -Force -ErrorAction SilentlyContinue`,
    '',
  ].join('\r\n');
  fs.writeFileSync(scriptPath, body, 'utf8');
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
    { detached: true, stdio: 'ignore', windowsHide: true },
  );
  child.unref();
}

function registerUpdater(deps) {
  const { ipcMain, app, isUi } = deps;

  ipcMain.handle('updater:check', async (event) => {
    if (!isUi(event)) return { ok: false, error: 'forbidden' };
    const current = app.getVersion();
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': userAgent(current),
    };
    let release;
    try {
      release = await requestJson(RELEASES_LATEST, headers);
    } catch {
      return {
        ok: false,
        status: 'network',
        current,
        message: 'Não foi possível consultar as atualizações. Verifique a internet e tente de novo.',
      };
    }
    const latestRaw = release.tag_name || release.name || '';
    const latestLabel = (String(latestRaw).match(/\d+\.\d+\.\d+/) || [String(latestRaw)])[0];
    if (compareSemver(latestRaw, current) <= 0) {
      return {
        ok: true,
        status: 'current',
        current,
        latest: latestLabel,
        message: 'Você já está na versão mais recente.',
      };
    }
    const releaseUrl = typeof release.html_url === 'string' ? release.html_url : '';
    const asset = findMesaAsset(release.assets);
    if (!asset || typeof asset.browser_download_url !== 'string') {
      return {
        ok: false,
        status: 'no-asset',
        current,
        latest: latestLabel,
        releaseUrl,
        message: 'Há uma versão nova, mas o Mesa.exe não foi encontrado na release.',
      };
    }
    if (!app.isPackaged()) {
      return {
        ok: true,
        status: 'dev',
        current,
        latest: latestLabel,
        releaseUrl,
        message: `Há uma versão mais nova (${latestLabel}). A atualização automática vale para o Mesa.exe empacotado.`,
      };
    }
    const userData = app.getPath('userData');
    const updatesDir = path.join(userData, 'updates');
    fs.mkdirSync(updatesDir, { recursive: true });
    const downloaded = path.join(updatesDir, 'Mesa.exe');
    const downloadHeaders = {
      Accept: 'application/octet-stream',
      'User-Agent': userAgent(current),
    };
    try {
      await downloadToFile(asset.browser_download_url, downloaded, downloadHeaders);
    } catch {
      return {
        ok: false,
        status: 'download',
        current,
        latest: latestLabel,
        releaseUrl,
        message: 'Não foi possível baixar a atualização. Tente de novo mais tarde.',
      };
    }
    if (Number.isFinite(asset.size) && asset.size > 0) {
      try {
        const stat = fs.statSync(downloaded);
        if (stat.size !== asset.size) {
          fs.rmSync(downloaded, { force: true });
          return {
            ok: false,
            status: 'download',
            current,
            latest: latestLabel,
            releaseUrl,
            message: 'O download da atualização ficou incompleto. Tente de novo.',
          };
        }
      } catch { /* segue com o arquivo baixado */ }
    }
    const targetExe = process.execPath;
    if (!targetExe || path.basename(targetExe).toLowerCase() !== 'mesa.exe') {
      return {
        ok: false,
        status: 'not-portable',
        current,
        latest: latestLabel,
        releaseUrl,
        message: 'Este executável não pode ser atualizado automaticamente.',
      };
    }
    try {
      schedulePortableReplace({
        userData,
        parentPid: process.pid,
        newExe: downloaded,
        targetExe,
      });
    } catch {
      return {
        ok: false,
        status: 'apply',
        current,
        latest: latestLabel,
        releaseUrl,
        message: 'Não foi possível preparar a atualização. Tente de novo.',
      };
    }
    setImmediate(() => app.quit());
    return {
      ok: true,
      status: 'applying',
      current,
      latest: latestLabel,
      releaseUrl,
      message: 'Atualização baixada. O Mesa vai reiniciar em instantes…',
    };
  });
}

module.exports = {
  registerUpdater,
  compareSemver,
  parseSemver,
  findMesaAsset,
  isAllowedUpdateUrl,
  isReleaseAssetUrl,
};
