'use strict';

// Vai junto com hunt-bridge.js e game.js no preload do jogo: nomes de topo únicos.
const LOGIN_RE = /^[A-Za-z0-9_]{1,25}$/;
const MAX_LIST = 100;
const MAX_STR = 80;
const LIVE_TIPOS = ['xp', 'captura', 'shiny'];
const TWITCH_KEYS = ['vinculado', 'login', 'bonus', 'pct', 'minutos', 'recompensas', 'pacotes', 'oficiais'];

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

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function copyList(raw, mapFn, max) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const entry of raw.slice(0, max || MAX_LIST)) {
    const clean = mapFn(entry);
    if (clean != null) out.push(clean);
  }
  return out;
}

function copyTwitchOfficial(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const login = trimStr(raw.login);
  if (!isValidTwitchLogin(login)) return null;
  const item = { login, nome: trimStr(raw.nome) };
  if (raw.aoVivo === true || raw.aoVivo === false) item.aoVivo = raw.aoVivo;
  if (raw.ativo === true || raw.ativo === false) item.ativo = raw.ativo;
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

function copyRecompensaLive(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!LIVE_TIPOS.includes(raw.tipo)) return null;
  const titulo = trimStr(raw.titulo);
  if (!titulo) return null;
  const custo = raw.custo;
  if (!Number.isInteger(custo) || custo < 1 || custo > 10000000) return null;
  return { tipo: raw.tipo, titulo, custo };
}

function copyPacoteLive(raw) {
  if (!Number.isInteger(raw) || raw < 1 || raw > 100) return null;
  return raw;
}

function copyBonusLive(raw) {
  const out = { xp: 0, captura: 0, shiny: 0 };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of LIVE_TIPOS) {
    if (Number.isInteger(raw[key]) && raw[key] >= 0) out[key] = raw[key];
  }
  return out;
}

function emptyTwitchLive() {
  return {
    recebido: false,
    vinculado: undefined,
    login: '',
    bonus: { xp: 0, captura: 0, shiny: 0 },
    pct: 0,
    minutos: 60,
    recompensas: [],
    pacotes: [],
    oficiais: [],
  };
}

function emptyBayLive() {
  return {
    twitch: emptyTwitchLive(),
    kick: { oficiais: [], pct: undefined, minutos: undefined },
    offsetMs: 0,
  };
}

function sanitizeTwitchPart(src) {
  const tw = {};
  if (src.desligado === true) {
    tw.desligado = true;
    return tw;
  }
  if (has(src, 'vinculado') && (src.vinculado === true || src.vinculado === false)) tw.vinculado = src.vinculado;
  if (has(src, 'login')) {
    const login = trimStr(src.login);
    tw.login = isValidTwitchLogin(login) ? login : '';
  }
  if (has(src, 'bonus')) tw.bonus = copyBonusLive(src.bonus);
  if (has(src, 'pct')) {
    const pct = finiteNum(src.pct);
    if (pct != null && pct >= 0 && pct <= 500) tw.pct = pct;
  }
  if (has(src, 'minutos')) {
    const minutos = src.minutos;
    if (Number.isInteger(minutos) && minutos >= 1 && minutos <= 1440) tw.minutos = minutos;
  }
  if (has(src, 'recompensas')) tw.recompensas = copyList(src.recompensas, copyRecompensaLive, 30) || [];
  if (has(src, 'pacotes')) tw.pacotes = copyList(src.pacotes, copyPacoteLive, 10) || [];
  if (has(src, 'oficiais')) tw.oficiais = copyList(src.oficiais, copyTwitchOfficial) || [];
  return tw;
}

function sanitizeLivePatch(input) {
  if (!input || typeof input !== 'object') return null;
  const patch = {};
  if (input.twitch && typeof input.twitch === 'object') {
    patch.twitch = sanitizeTwitchPart(input.twitch);
  }
  if (input.kick && typeof input.kick === 'object') {
    const k = {};
    const src = input.kick;
    if (has(src, 'oficiais')) {
      const oficiais = copyList(src.oficiais, copyKickOfficial);
      if (oficiais) k.oficiais = oficiais;
    }
    const kpct = finiteNum(src.pct);
    if (kpct != null && kpct >= 0 && kpct <= 500) k.pct = kpct;
    const minutos = finiteNum(src.minutos);
    if (minutos != null && minutos >= 0) k.minutos = minutos;
    if (Object.keys(k).length) patch.kick = k;
  }
  if (Number.isInteger(input.servidorAgora) && input.servidorAgora > 0) patch.servidorAgora = input.servidorAgora;
  if (input.completo === true) patch.completo = true;
  return Object.keys(patch).length ? patch : null;
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

function applyBayPatch(bay, patch, agora) {
  const next = bay && typeof bay === 'object' ? bay : emptyBayLive();
  if (!patch || typeof patch !== 'object') return next;
  if (patch.completo === true) {
    next.twitch = emptyTwitchLive();
    next.kick = emptyBayLive().kick;
  }
  if (patch.twitch && typeof patch.twitch === 'object') {
    if (patch.twitch.desligado === true) {
      next.twitch = emptyTwitchLive();
    } else {
      const tw = next.twitch || emptyTwitchLive();
      for (const key of TWITCH_KEYS) {
        if (has(patch.twitch, key)) tw[key] = patch.twitch[key];
      }
      tw.recebido = true;
      next.twitch = tw;
    }
  }
  if (patch.kick && typeof patch.kick === 'object') {
    const src = patch.kick;
    const k = next.kick || emptyBayLive().kick;
    if (has(src, 'oficiais')) k.oficiais = src.oficiais || [];
    if (has(src, 'pct')) k.pct = src.pct;
    if (has(src, 'minutos')) k.minutos = src.minutos;
    next.kick = k;
  }
  if (Number.isInteger(patch.servidorAgora) && Number.isFinite(agora)) {
    next.offsetMs = patch.servidorAgora - agora;
  }
  return next;
}

function toPublicSnapshot(bays) {
  const list = Array.isArray(bays) ? bays : [];
  const baySnapshots = [];
  for (let i = 0; i < 4; i += 1) {
    const bay = list[i] || emptyBayLive();
    const k = bay.kick || emptyBayLive().kick;
    const snap = { kick: {} };
    if (k.pct !== undefined) snap.kick.pct = k.pct;
    if (k.minutos !== undefined) snap.kick.minutos = k.minutos;
    baySnapshots.push(snap);
  }
  return {
    kickAoVivo: kickAoVivoList(list),
    bays: baySnapshots,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isValidTwitchLogin,
    sanitizeLivePatch,
    applyBayPatch,
    emptyBayLive,
    emptyTwitchLive,
    toPublicSnapshot,
    LIVE_TIPOS,
  };
}
