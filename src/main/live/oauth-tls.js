'use strict';

const https = require('https');
const selfsigned = require('selfsigned');
const { REDIRECT_URI } = require('./oauth');

const CALLBACK_PATH = '/callback';
const TIMEOUT_MS = 180000;

function createTlsMaterial() {
  const attrs = [{ name: 'commonName', value: '127.0.0.1' }];
  const pems = selfsigned.generate(attrs, {
    days: 1,
    keySize: 2048,
    extensions: [{
      name: 'subjectAltName',
      altNames: [{ type: 2, value: '127.0.0.1' }, { type: 7, ip: '127.0.0.1' }],
    }],
  });
  return { key: pems.private, cert: pems.cert };
}

let closeActive = null;

function cancelOAuthListener() {
  if (!closeActive) return;
  const close = closeActive;
  closeActive = null;
  close();
}

function waitForOAuthCallback(expectedState) {
  cancelOAuthListener();
  return new Promise((resolveListen, rejectListen) => {
    const { key, cert } = createTlsMaterial();
    let settled = false;
    let listenSettled = false;
    let timer = null;
    let server = null;
    let codeResolve;
    let codeReject;
    const codePromise = new Promise((resolveCode, rejectCode) => {
      codeResolve = resolveCode;
      codeReject = rejectCode;
    });

    function finish(fn, value) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (server) {
        try { server.close(); } catch { /* já fechado */ }
        server = null;
      }
      fn(value);
    }

    function failStart(message) {
      if (!listenSettled) {
        listenSettled = true;
        rejectListen(new Error(message));
      }
      finish((err) => codeReject(err), new Error(message));
    }

    server = https.createServer({ key, cert }, (req, res) => {
      try {
        const url = new URL(req.url || '/', REDIRECT_URI);
        if (url.pathname !== CALLBACK_PATH) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Não encontrado.');
          return;
        }
        const state = url.searchParams.get('state') || '';
        const error = url.searchParams.get('error') || '';
        if (error === 'access_denied') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<p>Autorização cancelada. Pode fechar esta aba.</p>');
          finish(codeReject, new Error('Autorização cancelada.'));
          return;
        }
        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<p>State inválido. Feche a aba e tente de novo na Mesa.</p>');
          return;
        }
        const code = url.searchParams.get('code') || '';
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<p>Código ausente. Feche a aba e tente de novo na Mesa.</p>');
          finish(codeReject, new Error('Código OAuth ausente.'));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<p>Conta autorizada. Pode fechar esta aba e voltar à Mesa.</p>');
        finish(codeResolve, { code });
      } catch (err) {
        finish(codeReject, err instanceof Error ? err : new Error(String(err)));
      }
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        failStart('A porta 47831 já está em uso. Feche o que a usa e tente autorizar de novo.');
        return;
      }
      failStart(err instanceof Error ? err.message : String(err));
    });

    timer = setTimeout(() => {
      finish(codeReject, new Error('Tempo esgotado aguardando autorização (3 minutos).'));
    }, TIMEOUT_MS);

    closeActive = () => {
      finish((err) => codeReject(err), new Error('Autorização interrompida.'));
    };

    server.listen(47831, '127.0.0.1', () => {
      if (listenSettled) return;
      listenSettled = true;
      resolveListen(codePromise);
    });
  });
}

module.exports = {
  waitForOAuthCallback,
  cancelOAuthListener,
  TIMEOUT_MS,
};
