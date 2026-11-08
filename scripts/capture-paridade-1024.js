/* Captura Mesa/Espera/Ajustes em 1024×572 via CDP. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 9333;
const OUT = path.join(process.env.TEMP || '.', 'mesa-paridade');
const appRoot = path.join(__dirname, '..');
const electronExe = require('electron');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 1;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        const pair = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) pair.reject(new Error(msg.error.message || 'CDP error'));
        else pair.resolve(msg.result);
      }
    });
    ws.addEventListener('open', () => {
      const send = (method, params = {}) => new Promise((ok, bad) => {
        const mid = id++;
        pending.set(mid, { resolve: ok, reject: bad });
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
      resolve({ ws, send });
    });
    ws.addEventListener('error', reject);
  });
}

async function capture(send, fileName) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.mkdirSync(OUT, { recursive: true });
  const target = path.join(OUT, fileName);
  fs.writeFileSync(target, Buffer.from(data, 'base64'));
  return target;
}

async function clickNav(send, label) {
  const expr = `(function(){
    const btn = [...document.querySelectorAll('.rail-btn')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(label)});
    if (btn) btn.click();
    return !!btn;
  })()`;
  await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  await wait(500);
}

async function main() {
  const child = spawn(electronExe, [appRoot, `--remote-debugging-port=${PORT}`, '--window-size=1024,572'], {
    cwd: appRoot,
    stdio: 'ignore',
    windowsHide: true,
  });

  try {
    let targets = null;
    for (let i = 0; i < 50; i += 1) {
      try {
        targets = await httpJson(`http://127.0.0.1:${PORT}/json/list`);
        if (targets && targets.length) break;
      } catch { /* retry */ }
      await wait(300);
    }
    if (!targets || !targets.length) throw new Error('CDP não respondeu');

    const page = targets.find((t) => t.type === 'page' && /Mesa|file:|index/i.test(`${t.title} ${t.url}`))
      || targets.find((t) => t.type === 'page');
    if (!page || !page.webSocketDebuggerUrl) throw new Error('Página alvo não encontrada');

    const { ws, send } = await connectCdp(page.webSocketDebuggerUrl);
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1024,
      height: 572,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await wait(1200);

    const mesaPath = await capture(send, 'final4-mesa-1024.png');
    await clickNav(send, 'Espera');
    const esperaPath = await capture(send, 'final4-espera-1024.png');
    await clickNav(send, 'Ajustes');
    const ajustesPath = await capture(send, 'final4-ajustes-1024.png');

    ws.close();
    console.log(JSON.stringify({ mesaPath, esperaPath, ajustesPath }, null, 2));
  } finally {
    try { child.kill(); } catch { /* ignore */ }
    await wait(400);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
