'use strict';

const crypto = require('crypto');

const REDIRECT_URI = 'https://127.0.0.1:47831/callback';
const SCOPE = 'chat:read';

function base64UrlNoPadding(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier() {
  return base64UrlNoPadding(crypto.randomBytes(32));
}

function pkceChallengeS256(verifier) {
  const digest = crypto.createHash('sha256').update(verifier).digest();
  return base64UrlNoPadding(digest);
}

function encodeParam(value) {
  return encodeURIComponent(String(value));
}

function buildAuthorizeUrl(clientId, state, codeChallenge, endpoints) {
  const base = endpoints && endpoints.authorizeUrl
    ? endpoints.authorizeUrl
    : 'https://id.twitch.tv/oauth2/authorize';
  return `${base}?response_type=code&client_id=${encodeParam(clientId)}&redirect_uri=${encodeParam(REDIRECT_URI)}&scope=${encodeParam(SCOPE)}&state=${encodeParam(state)}&code_challenge=${encodeParam(codeChallenge)}&code_challenge_method=S256`;
}

async function exchangeCode(clientId, code, verifier, endpoints, fetchFn) {
  const fetchImpl = fetchFn || fetch;
  const tokenUrl = endpoints && endpoints.tokenUrl ? endpoints.tokenUrl : 'https://id.twitch.tv/oauth2/token';
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  const response = await fetchImpl(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Falha ao trocar o código OAuth.');
  }
  return response.json();
}

async function validateToken(accessToken, endpoints, fetchFn) {
  const fetchImpl = fetchFn || fetch;
  const validateUrl = endpoints && endpoints.validateUrl
    ? endpoints.validateUrl
    : 'https://id.twitch.tv/oauth2/validate';
  const response = await fetchImpl(validateUrl, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!response.ok) throw new Error('Token OAuth inválido.');
  const data = await response.json();
  const login = typeof data.login === 'string' ? data.login.toLowerCase() : '';
  if (!login) throw new Error('Resposta de validação incompleta.');
  return { login, data };
}

async function refreshAccessToken(clientId, refreshToken, endpoints, fetchFn) {
  const fetchImpl = fetchFn || fetch;
  const tokenUrl = endpoints && endpoints.tokenUrl ? endpoints.tokenUrl : 'https://id.twitch.tv/oauth2/token';
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const response = await fetchImpl(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) throw new Error('Falha ao renovar o token OAuth.');
  return response.json();
}

function tokenFromExchange(exchange, login) {
  const expiresIn = typeof exchange.expires_in === 'number' ? exchange.expires_in : 0;
  const token = {
    login,
    accessToken: exchange.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  if (typeof exchange.refresh_token === 'string' && exchange.refresh_token) {
    token.refreshToken = exchange.refresh_token;
  }
  return token;
}

function needsRefresh(token) {
  if (!token || !token.refreshToken || !token.expiresAt) return false;
  return token.expiresAt - Date.now() <= 60000;
}

module.exports = {
  REDIRECT_URI,
  randomVerifier,
  pkceChallengeS256,
  buildAuthorizeUrl,
  exchangeCode,
  validateToken,
  refreshAccessToken,
  tokenFromExchange,
  needsRefresh,
};
