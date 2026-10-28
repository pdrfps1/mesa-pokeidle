'use strict';

const fs = require('fs');
const path = require('path');

const CLIENT_ID_RE = /^[A-Za-z0-9]{0,80}$/;

function twitchFile(userData) {
  return path.join(userData, 'mesa-twitch.json');
}

function defaultDoc() {
  return {
    clientId: '',
    excluded: [],
    manual: [],
    token: null,
  };
}

function normalizeLoginList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!/^[A-Za-z0-9_]{1,25}$/.test(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function normalizeToken(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'object') return null;
  const login = typeof raw.login === 'string' ? raw.login.trim().toLowerCase() : '';
  const accessToken = typeof raw.accessToken === 'string' ? raw.accessToken : '';
  if (!login || !accessToken) return null;
  const token = { login, accessToken };
  if (typeof raw.refreshToken === 'string' && raw.refreshToken) token.refreshToken = raw.refreshToken;
  if (typeof raw.expiresAt === 'number' && Number.isFinite(raw.expiresAt)) token.expiresAt = raw.expiresAt;
  return token;
}

function normalizeDoc(raw) {
  const base = defaultDoc();
  if (!raw || typeof raw !== 'object') return base;
  if (typeof raw.clientId === 'string' && CLIENT_ID_RE.test(raw.clientId)) base.clientId = raw.clientId;
  base.excluded = normalizeLoginList(raw.excluded);
  base.manual = normalizeLoginList(raw.manual);
  base.token = normalizeToken(raw.token);
  return base;
}

function readStore(userData) {
  const file = twitchFile(userData);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return normalizeDoc(parsed);
  } catch {
    return defaultDoc();
  }
}

function writeStoreAtomic(userData, doc) {
  const file = twitchFile(userData);
  fs.mkdirSync(userData, { recursive: true });
  const body = `${JSON.stringify(normalizeDoc(doc), null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body, 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

function setClientId(userData, clientId) {
  const value = typeof clientId === 'string' && CLIENT_ID_RE.test(clientId) ? clientId : '';
  const doc = readStore(userData);
  doc.clientId = value;
  writeStoreAtomic(userData, doc);
  return doc;
}

function savePrefs(userData, prefs) {
  const doc = readStore(userData);
  doc.excluded = normalizeLoginList(prefs.excluded);
  doc.manual = normalizeLoginList(prefs.manual);
  writeStoreAtomic(userData, doc);
  return doc;
}

function saveToken(userData, token) {
  const doc = readStore(userData);
  doc.token = normalizeToken(token);
  writeStoreAtomic(userData, doc);
  return doc;
}

function clearToken(userData) {
  const doc = readStore(userData);
  doc.token = null;
  writeStoreAtomic(userData, doc);
  return doc;
}

module.exports = {
  readStore,
  writeStoreAtomic,
  setClientId,
  savePrefs,
  saveToken,
  clearToken,
  twitchFile,
};
