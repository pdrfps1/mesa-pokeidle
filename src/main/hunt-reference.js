const https = require('https');

const HOST = 'guiapokeidlehardtocapture.site';
const START_URL = `https://${HOST}/data.js?v=32`;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function parseHuntReferenceScript(script) {
  if (typeof script !== 'string') throw new Error('formato');
  const marker = 'window.PI_DATA =';
  const at = script.indexOf(marker);
  if (at < 0) throw new Error('formato');
  let json = script.slice(at + marker.length).trim();
  if (json.endsWith(';')) json = json.slice(0, -1).trim();
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.especies) || !Array.isArray(parsed.hunts)) {
    throw new Error('incompleto');
  }
  return parsed;
}

function fetchText(url, redirects) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { reject(new Error('host')); return; }
    if (parsed.protocol !== 'https:' || parsed.hostname !== HOST) {
      reject(new Error('host'));
      return;
    }
    const req = https.get(parsed, { headers: { accept: '*/*' }, timeout: 15000 }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        if (redirects >= MAX_REDIRECTS) { reject(new Error('redirect')); return; }
        let next;
        try { next = new URL(res.headers.location, parsed); } catch { reject(new Error('host')); return; }
        fetchText(next.href, redirects + 1).then(resolve, reject);
        return;
      }
      if (status !== 200) { res.resume(); reject(new Error('status')); return; }
      const advertised = Number(res.headers['content-length']);
      if (Number.isFinite(advertised) && advertised > MAX_BYTES) {
        res.resume();
        reject(new Error('size'));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy();
          reject(new Error('size'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

let cached = null;
let pending = null;

function loadHuntReference() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = fetchText(START_URL, 0).then((script) => {
      cached = parseHuntReferenceScript(script);
      return cached;
    }).finally(() => { pending = null; });
  }
  return pending;
}

function registerHuntReference(ipcMain, isUi) {
  ipcMain.handle('hunt:reference', (event) => (
    isUi(event)
      ? loadHuntReference().catch(() => ({ error: 'Não foi possível ler o guia de hunts.' }))
      : null
  ));
}

module.exports = { parseHuntReferenceScript, loadHuntReference, registerHuntReference };
