const { spawn } = require('child_process');
const http = require('http');
const electron = require('electron');
const path = require('path');

const appRoot = path.join(__dirname, '..');
const PORT = 9335;

const child = spawn(electron, [appRoot, `--remote-debugging-port=${PORT}`, '--window-size=1024,572'], {
  cwd: appRoot,
  stdio: 'inherit',
});

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

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => {
      let id = 1;
      const send = (method, params = {}) => new Promise((ok, bad) => {
        const mid = id++;
        const onMsg = (ev) => {
          const msg = JSON.parse(String(ev.data));
          if (msg.id !== mid) return;
          ws.removeEventListener('message', onMsg);
          if (msg.error) bad(new Error(msg.error.message));
          else ok(msg.result);
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
      resolve({ send, ws });
    });
    ws.addEventListener('error', reject);
  });
}

(async () => {
  await wait(6000);
  const targets = await httpJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = targets.find((t) => t.type === 'page');
  const { send, ws } = await connect(page.webSocketDebuggerUrl);
  await send('Runtime.enable');
  await send('Log.enable');
  const ev = await send('Runtime.evaluate', {
    expression: '(function(){ mount.done=false; try { mount(); return { ok:true, kids: document.querySelector("#app")?.childElementCount }; } catch(e) { return { ok:false, err: String(e.stack || e) }; } })()',
    returnByValue: true,
  });
  console.log(ev.result.value);
  ws.close();
  child.kill();
})().catch((err) => {
  console.error(err);
  child.kill();
});
