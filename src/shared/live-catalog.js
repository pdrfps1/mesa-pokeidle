'use strict';

const LOGIN_RE = /^[A-Za-z0-9_]{1,25}$/;
const MAX_LIST = 100;
const MAX_STR = 80;

function isValidTwitchLogin(login) {
  return typeof login === 'string' && LOGIN_RE.test(login);
}

function trimStr(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_STR);
}

function finiteNum(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function intViewers(value) {
  const n = finiteNum(value);
  if (n == null || n < 0) return null;
  return Math.floor(n);
}

function copyLiveItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const login = trimStr(raw.login);
  if (!isValidTwitchLogin(login)) return null;
  const item = { login, nome: trimStr(raw.nome) };
  const viewers = intViewers(raw.espectadores);
  if (viewers != null) item.espectadores = viewers;
  return item;
}

function copyTwitchOfficial(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const login = trimStr(raw.login);
  if (!isValidTwitchLogin(login)) return null;
  const item = { login, nome: trimStr(raw.nome) };
  if (raw.bonus === true || raw.bonus === false) item.bonus = raw.bonus;
  if (raw.aoVivo === true || raw.aoVivo === false) item.aoVivo = raw.aoVivo;
  const viewers = intViewers(raw.espectadores);
  if (viewers != null) item.espectadores = viewers;
  return item;
}

function copyKickOfficial(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const slug = trimStr(raw.slug).slice(0, 50);
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(slug)) return null;
  const item = { slug, nome: trimStr(raw.nome) };
  if (raw.aoVivo === true || raw.aoVivo === false) item.aoVivo = raw.aoVivo;
  if (raw.ativo === true || raw.ativo === false) item.ativo = raw.ativo;
  const viewers = intViewers(raw.espectadores);
  if (viewers != null) item.espectadores = viewers;
  return item;
}

function copyList(raw, mapFn) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const entry of raw.slice(0, MAX_LIST)) {
    const clean = mapFn(entry);
    if (clean) out.push(clean);
  }
  return out.length ? out : [];
}

function sanitizeLivePatch(input) {
  if (!input || typeof input !== 'object') return null;
  const patch = {};
  if (input.twitch && typeof input.twitch === 'object') {
    const tw = {};
    const src = input.twitch;
    if (Object.prototype.hasOwnProperty.call(src, 'lives')) {
      const lives = copyList(src.lives, copyLiveItem);
      if (lives) tw.lives = lives;
    }
    if (Object.prototype.hasOwnProperty.call(src, 'oficiais')) {
      const oficiais = copyList(src.oficiais, copyTwitchOfficial);
      if (oficiais) tw.oficiais = oficiais;
    }
    if (src.assistindo === true || src.assistindo === false) tw.assistindo = src.assistindo;
    const pctAtual = finiteNum(src.pctAtual);
    if (pctAtual != null && pctAtual >= 0 && pctAtual <= 500) tw.pctAtual = pctAtual;
    const pct = finiteNum(src.pct);
    if (pct != null && pct >= 0 && pct <= 500) tw.pct = pct;
    if (Object.keys(tw).length) patch.twitch = tw;
  }
  if (input.kick && typeof input.kick === 'object') {
    const k = {};
    const src = input.kick;
    if (Object.prototype.hasOwnProperty.call(src, 'oficiais')) {
      const oficiais = copyList(src.oficiais, copyKickOfficial);
      if (oficiais) k.oficiais = oficiais;
    }
    const kpct = finiteNum(src.pct);
    if (kpct != null && kpct >= 0 && kpct <= 500) k.pct = kpct;
    const minutos = finiteNum(src.minutos);
    if (minutos != null && minutos >= 0) k.minutos = minutos;
    if (Object.keys(k).length) patch.kick = k;
  }
  return Object.keys(patch).length ? patch : null;
}

function twitchDisplayPct(twitch) {
  if (!twitch || typeof twitch !== 'object') return 0;
  if (twitch.assistindo === false) return 0;
  const current = finiteNum(twitch.pctAtual);
  const fallback = finiteNum(twitch.pct);
  if (twitch.assistindo === true) {
    return current != null ? current : (fallback != null ? fallback : 0);
  }
  if (current != null) return current;
  if (fallback != null) return fallback;
  return twitch.pctDisplay != null ? twitch.pctDisplay : 0;
}

function emptyBayLive() {
  return {
    twitch: {
      lives: [],
      oficiais: [],
      assistindo: undefined,
      pctAtual: undefined,
      pct: undefined,
      pctDisplay: 0,
    },
    kick: {
      oficiais: [],
      pct: undefined,
      minutos: undefined,
    },
  };
}

function applyBayPatch(bay, patch) {
  const next = bay && typeof bay === 'object' ? bay : emptyBayLive();
  if (!patch || typeof patch !== 'object') return next;
  if (patch.twitch && typeof patch.twitch === 'object') {
    const src = patch.twitch;
    const tw = next.twitch || emptyBayLive().twitch;
    if (Object.prototype.hasOwnProperty.call(src, 'lives')) tw.lives = src.lives || [];
    if (Object.prototype.hasOwnProperty.call(src, 'oficiais')) tw.oficiais = src.oficiais || [];
    if (Object.prototype.hasOwnProperty.call(src, 'assistindo')) tw.assistindo = src.assistindo;
    if (Object.prototype.hasOwnProperty.call(src, 'pctAtual')) tw.pctAtual = src.pctAtual;
    if (Object.prototype.hasOwnProperty.call(src, 'pct')) tw.pct = src.pct;
    tw.pctDisplay = twitchDisplayPct(tw);
    next.twitch = tw;
  }
  if (patch.kick && typeof patch.kick === 'object') {
    const src = patch.kick;
    const k = next.kick || emptyBayLive().kick;
    if (Object.prototype.hasOwnProperty.call(src, 'oficiais')) k.oficiais = src.oficiais || [];
    if (Object.prototype.hasOwnProperty.call(src, 'pct')) k.pct = src.pct;
    if (Object.prototype.hasOwnProperty.call(src, 'minutos')) k.minutos = src.minutos;
    next.kick = k;
  }
  return next;
}

function mergeTwitchFromBays(bays) {
  const officials = [];
  const lives = [];
  const liveSet = new Set();
  const offSet = new Set();
  for (const bay of bays || []) {
    if (!bay || !bay.twitch) continue;
    for (const item of bay.twitch.oficiais || []) {
      const key = item.login.toLowerCase();
      if (!offSet.has(key)) {
        offSet.add(key);
        officials.push(item);
      }
    }
    for (const item of bay.twitch.lives || []) {
      const key = item.login.toLowerCase();
      if (!liveSet.has(key)) {
        liveSet.add(key);
        lives.push(item);
      }
    }
  }
  return { officials, lives };
}

function qualifiedAutoLogins(officials, lives) {
  const liveLogins = new Set((lives || []).map((l) => l.login.toLowerCase()));
  const wanted = new Set();
  for (const official of officials || []) {
    if (official.bonus !== true) continue;
    if (!isValidTwitchLogin(official.login)) continue;
    const login = official.login.toLowerCase();
    if (liveLogins.has(login) || official.aoVivo !== false) wanted.add(login);
  }
  return wanted;
}

function normalizeLoginList(values) {
  const set = new Set();
  for (const value of values || []) {
    if (isValidTwitchLogin(value)) set.add(value.toLowerCase());
  }
  return set;
}

function wantedJoinLogins(bays, excluded, manual) {
  const { officials, lives } = mergeTwitchFromBays(bays);
  const wanted = qualifiedAutoLogins(officials, lives);
  const excludedSet = normalizeLoginList(excluded);
  for (const login of wanted) {
    if (excludedSet.has(login)) wanted.delete(login);
  }
  for (const login of normalizeLoginList(manual)) {
    if (!excludedSet.has(login)) wanted.add(login);
  }
  return wanted;
}

function setChannelEnabled(prefs, login, enabled, qualified) {
  if (!isValidTwitchLogin(login)) {
    throw new Error('Login da Twitch inválido.');
  }
  const normalized = login.toLowerCase();
  const next = {
    excluded: Array.isArray(prefs.excluded) ? prefs.excluded.slice() : [],
    manual: Array.isArray(prefs.manual) ? prefs.manual.slice() : [],
  };
  if (enabled) {
    next.excluded = next.excluded.filter((v) => v.toLowerCase() !== normalized);
  } else if (!next.excluded.some((v) => v.toLowerCase() === normalized)) {
    next.excluded.push(normalized);
  }
  return next;
}

function addManual(prefs, login) {
  if (!isValidTwitchLogin(login)) throw new Error('Login da Twitch inválido.');
  const normalized = login.toLowerCase();
  const next = {
    excluded: Array.isArray(prefs.excluded) ? prefs.excluded.filter((v) => v.toLowerCase() !== login.toLowerCase()) : [],
    manual: Array.isArray(prefs.manual) ? prefs.manual.slice() : [],
  };
  if (!next.manual.some((v) => v.toLowerCase() === normalized)) next.manual.push(normalized);
  return next;
}

function removeManual(prefs, login) {
  return {
    excluded: Array.isArray(prefs.excluded) ? prefs.excluded.slice() : [],
    manual: Array.isArray(prefs.manual)
      ? prefs.manual.filter((v) => v.toLowerCase() !== String(login || '').toLowerCase())
      : [],
  };
}

function kickAoVivoList(bays) {
  const map = new Map();
  for (const bay of bays || []) {
    if (!bay || !bay.kick || !Array.isArray(bay.kick.oficiais)) continue;
    for (const item of bay.kick.oficiais) {
      if (item.aoVivo !== true) continue;
      if (!map.has(item.slug)) {
        map.set(item.slug, {
          slug: item.slug,
          nome: item.nome || item.slug,
          espectadores: item.espectadores,
        });
      }
    }
  }
  return Array.from(map.values());
}

function toPublicSnapshot(state) {
  const bays = state.bays || [];
  const prefs = state.prefs || { excluded: [], manual: [] };
  const manualSet = normalizeLoginList(prefs.manual);
  const wanted = wantedJoinLogins(bays, prefs.excluded, prefs.manual);
  const { officials } = mergeTwitchFromBays(bays);
  const channelLogins = new Set();
  for (const official of officials) {
    if (official.bonus === true && isValidTwitchLogin(official.login)) {
      channelLogins.add(official.login.toLowerCase());
    }
  }
  for (const login of manualSet) channelLogins.add(login);
  const channels = Array.from(channelLogins).sort().map((login) => {
    const official = officials.find((o) => o.login.toLowerCase() === login);
    return {
      login,
      nome: official ? (official.nome || login) : login,
      checked: wanted.has(login),
      manual: manualSet.has(login),
      bonus: official ? official.bonus : undefined,
    };
  });
  const baySnapshots = [];
  for (let i = 0; i < 4; i += 1) {
    const bay = bays[i] || emptyBayLive();
    const tw = bay.twitch || emptyBayLive().twitch;
    const k = bay.kick || emptyBayLive().kick;
    const snap = {
      twitch: {
        assistindo: tw.assistindo,
        pct: tw.pctDisplay != null ? tw.pctDisplay : twitchDisplayPct(tw),
      },
      kick: {},
    };
    if (k.pct !== undefined) snap.kick.pct = k.pct;
    if (k.minutos !== undefined) snap.kick.minutos = k.minutos;
    baySnapshots.push(snap);
  }
  return {
    status: state.status || 'desconectado',
    login: typeof state.login === 'string' ? state.login : '',
    clientId: typeof state.clientId === 'string' ? state.clientId : '',
    error: typeof state.error === 'string' ? state.error : '',
    authorizeUrl: typeof state.authorizeUrl === 'string' && state.authorizeUrl.startsWith('https://id.twitch.tv/')
      ? state.authorizeUrl
      : '',
    joined: Array.isArray(state.joined)
      ? state.joined.filter((login) => typeof login === 'string').slice(0, 100)
      : [],
    channels,
    bays: baySnapshots,
    kickAoVivo: kickAoVivoList(bays),
  };
}

module.exports = {
  isValidTwitchLogin,
  sanitizeLivePatch,
  applyBayPatch,
  wantedJoinLogins,
  setChannelEnabled,
  addManual,
  removeManual,
  toPublicSnapshot,
  emptyBayLive,
  mergeTwitchFromBays,
  qualifiedAutoLogins,
};
