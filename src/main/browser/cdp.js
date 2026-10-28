const path = require('node:path');

const RPC_TIMEOUT_MS = 8000;
const WS = globalThis.WebSocket;

function cdpRpc(wsUrl, method, params = {}) {
  if (!WS) return Promise.reject(new Error('WebSocket indisponível'));
  return new Promise((resolve, reject) => {
    const ws = new WS(wsUrl);
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* já fechou */ }
      reject(new Error('timeout'));
    }, RPC_TIMEOUT_MS);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (msg.error) reject(new Error(msg.error.message || 'cdp'));
      else resolve(msg.result);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('sem conexão'));
    };
  });
}

function readDevToolsPort(profileDir, fs) {
  const file = path.join(profileDir, 'DevToolsActivePort');
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8').split('\n')[0].trim();
}

/** Flags de depuração só para leitura headless pós-login (127.0.0.1). */
function remoteDebuggingCliArgs() {
  return ['--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1'];
}

module.exports = { cdpRpc, readDevToolsPort, remoteDebuggingCliArgs };
