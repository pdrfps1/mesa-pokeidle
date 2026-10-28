'use strict';

const {
  splitIrcPayload,
  handleIrcLine,
  formatPass,
  formatNick,
  formatJoin,
  formatPart,
  createIrcSession,
  setChannels,
  nextReconnectDelay,
} = require('./irc');

const WS = globalThis.WebSocket;

function listen(ws, name, handler) {
  if (typeof ws.on === 'function') {
    ws.on(name, handler);
    return;
  }
  ws.addEventListener(name, handler);
}

function messageText(data) {
  const payload = data && typeof data === 'object' && 'data' in data ? data.data : data;
  if (typeof payload === 'string') return payload;
  if (payload == null) return '';
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(payload)) return payload.toString('utf8');
  if (payload instanceof ArrayBuffer) return Buffer.from(payload).toString('utf8');
  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString('utf8');
  }
  return '';
}

function sendRaw(ws, line) {
  if (!ws || ws.readyState !== 1) return false;
  ws.send(`${line}\r\n`);
  return true;
}

function connectIrcSocket({ token, login, onLine, onClose, onOpen }) {
  if (!WS) throw new Error('WebSocket indisponível neste processo.');
  const ws = new WS('wss://irc-ws.chat.twitch.tv:443');
  listen(ws, 'open', () => {
    sendRaw(ws, formatPass(token.accessToken));
    sendRaw(ws, formatNick(login));
    if (typeof onOpen === 'function') onOpen();
  });
  listen(ws, 'message', (data) => {
    const text = messageText(data);
    for (const line of splitIrcPayload(text)) {
      if (typeof onLine === 'function') onLine(line);
    }
  });
  listen(ws, 'close', () => {
    if (typeof onClose === 'function') onClose();
  });
  listen(ws, 'error', () => {
    if (typeof onClose === 'function') onClose();
  });
  return ws;
}

module.exports = {
  connectIrcSocket,
  sendRaw,
  splitIrcPayload,
  handleIrcLine,
  formatPass,
  formatNick,
  formatJoin,
  formatPart,
  createIrcSession,
  setChannels,
  nextReconnectDelay,
};
