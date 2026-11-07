const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const https = require('https');
const AppBrand = require('../shared/brand');

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
  return /^\/pdrfps1\/mesa-pokeidle\/releases\/download\/[^/]+\/(PokeIdle-Automation\.exe|PokeIdle-Automation-Setup\.exe|Mesa\.exe)$/i.test(url.pathname);
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

function findReleaseAsset(assets, kind) {
  if (!Array.isArray(assets)) return null;
  const named = (name) => {
    const wanted = String(name).toLowerCase();
    return assets.find((item) => item && typeof item.name === 'string' && item.name.toLowerCase() === wanted) || null;
  };
  if (kind === 'installer') return named(AppBrand.installerAsset);
  if (kind === 'portable') {
    return named(AppBrand.portableAsset) || named(AppBrand.legacyPortableAsset);
  }
  return null;
}

function isPortableTarget(file) {
  const base = path.basename(String(file || '')).toLowerCase();
  return base === AppBrand.portableAsset.toLowerCase() || base === AppBrand.legacyPortableAsset.toLowerCase();
}

function detectInstallMode({ isPackaged, env }) {
  if (!isPackaged) return 'dev';
  if (env && env.PORTABLE_EXECUTABLE_FILE) return 'portable';
  return 'installed';
}

// PowerShell trata estas aspas simples como aspas simples dentro de string entre aspas simples: todas são dobradas.
function psEscape(value) {
  return String(value).replace(/['\u2018\u2019\u201A\u201B]/g, (quote) => quote + quote);
}

// Abre o processo solto. Só resolve quando o processo existe ('spawn'); falha (ENOENT, EACCES, antivírus) rejeita.
function startDetached(command, args, extra = {}, spawnFn = spawn) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnFn(command, args, { ...extra, detached: true, stdio: 'ignore' });
    } catch (error) {
      reject(error);
      return;
    }
    child.on('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

async function schedulePortableReplace({ userData, parentPid, newExe, targetExe }) {
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
  await startDetached(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
    { windowsHide: true },
  );
}

function assetNameFor(kind) {
  return kind === 'installer' ? AppBrand.installerAsset : AppBrand.portableAsset;
}

const SHA256_DIGEST_RE = /^sha256:([0-9a-f]{64})$/;

// Hash SHA-256 do arquivo em hex minúsculo, lido em stream para não carregar o .exe inteiro na memória.
function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// Remove o arquivo baixado e devolve o erro com o code pedido. Se o rm falhar (ex.: EPERM no Windows), segue com o code pedido.
function failAsset(dest, code) {
  try { fs.rmSync(dest, { force: true }); } catch { /* segue com o code pedido */ }
  const error = new Error(code);
  error.code = code;
  return error;
}

// Baixa o asset e confere tamanho e sha256 anunciados pela release. Qualquer falha remove o arquivo e lança com code:
// 'size' (tamanho errado), 'no-digest' (release sem digest), 'digest' (digest malformado, diferente ou não calculável).
// Mudança de contrato: stat que falha agora falha fechado com 'digest'. Antes o arquivo seguia sem conferência;
// sem stat não há como validar o que foi baixado, então não se confia nele.
async function fetchReleaseAsset(asset, dest, headers, download = downloadToFile, hashFile = sha256File) {
  await download(asset.browser_download_url, dest, headers);
  if (Number.isFinite(asset.size) && asset.size > 0) {
    let size;
    try {
      size = fs.statSync(dest).size;
    } catch {
      throw failAsset(dest, 'digest');
    }
    if (size !== asset.size) throw failAsset(dest, 'size');
  }
  if (asset.digest == null) throw failAsset(dest, 'no-digest');
  const match = typeof asset.digest === 'string' ? SHA256_DIGEST_RE.exec(asset.digest) : null;
  if (!match) throw failAsset(dest, 'digest');
  let actual;
  try {
    actual = await hashFile(dest);
  } catch {
    throw failAsset(dest, 'digest');
  }
  if (String(actual) !== match[1]) throw failAsset(dest, 'digest');
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
    const mode = detectInstallMode({ isPackaged: app.isPackaged, env: process.env });
    const kind = mode === 'installed' ? 'installer' : 'portable';
    const asset = findReleaseAsset(release.assets, kind);
    if (!asset || typeof asset.browser_download_url !== 'string') {
      return {
        ok: false,
        status: 'no-asset',
        current,
        latest: latestLabel,
        releaseUrl,
        message: `Há uma versão nova, mas o ${assetNameFor(kind)} não foi encontrado na release.`,
      };
    }
    if (mode === 'dev') {
      return {
        ok: true,
        status: 'dev',
        current,
        latest: latestLabel,
        releaseUrl,
        message: `Há uma versão mais nova (${latestLabel}). A atualização automática vale só para o app empacotado.`,
      };
    }
    const targetExe = mode === 'portable' ? (process.env.PORTABLE_EXECUTABLE_FILE || process.execPath) : '';
    if (mode === 'portable' && !isPortableTarget(targetExe)) {
      return {
        ok: false,
        status: 'not-portable',
        current,
        latest: latestLabel,
        releaseUrl,
        message: 'Este executável não pode ser atualizado automaticamente.',
      };
    }
    const userData = app.getPath('userData');
    const updatesDir = path.join(userData, 'updates');
    fs.mkdirSync(updatesDir, { recursive: true });
    const downloaded = path.join(updatesDir, assetNameFor(kind));
    const downloadHeaders = {
      Accept: 'application/octet-stream',
      'User-Agent': userAgent(current),
    };
    try {
      await fetchReleaseAsset(asset, downloaded, downloadHeaders);
    } catch (error) {
      if (error && (error.code === 'digest' || error.code === 'no-digest')) {
        return {
          ok: false,
          status: 'verify',
          current,
          latest: latestLabel,
          releaseUrl,
          message: 'Não foi possível verificar a atualização. Baixe pela página da release.',
        };
      }
      return {
        ok: false,
        status: 'download',
        current,
        latest: latestLabel,
        releaseUrl,
        message: error && error.code === 'size'
          ? 'O download da atualização ficou incompleto. Tente de novo.'
          : 'Não foi possível baixar a atualização. Tente de novo mais tarde.',
      };
    }
    if (mode === 'installed') {
      try {
        await startDetached(downloaded, ['--updated']);
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
        message: 'O instalador vai abrir para concluir a atualização.',
      };
    }
    try {
      await schedulePortableReplace({
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
      message: `Atualização baixada. O ${AppBrand.productName} vai reiniciar em instantes…`,
    };
  });
}

module.exports = {
  registerUpdater,
  psEscape,
  startDetached,
  fetchReleaseAsset,
  sha256File,
  compareSemver,
  parseSemver,
  findReleaseAsset,
  isPortableTarget,
  detectInstallMode,
  isAllowedUpdateUrl,
  isReleaseAssetUrl,
};
