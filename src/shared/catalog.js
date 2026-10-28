var MESA_CATALOG = {
  gameUrl: 'https://pokeidle.io/app',
  bays: 4,
  partitions: ['persist:mesa-1', 'persist:mesa-2', 'persist:mesa-3', 'persist:mesa-4'],
  autos: [
    { id: 'auto-ball-captura', label: 'Lançar até capturar', vip: true },
    { id: 'auto-ball-sem-parar', label: 'Lançar sem parar', vip: true },
    { id: 'auto-revive', label: 'Usar revive ao desmaiar' },
    { id: 'auto-potion', label: 'Usar poções' },
    { id: 'auto-voltar-hunt', label: 'Voltar à hunt ao morrer/reset' },
  ],
  nav: ['Mapa', 'Pokédex', 'Depot', 'Boss', 'Market'],
  frame: { width: 1300, height: 720 },
  scale: { manualMin: 0.5, manualMax: 1.5, autoMin: 0.25, autoMax: 1.5 },
  layouts: [
    { id: 'grade', label: 'Grade' },
    { id: 'fila', label: 'Fila' },
    { id: 'coluna', label: 'Coluna' },
  ],
};

function mesaScale(value) {
  if (value == null || value === '' || value === false) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const bounds = MESA_CATALOG.scale;
  const factor = amount > bounds.manualMax ? amount / 100 : amount;
  if (factor < bounds.manualMin || factor > bounds.manualMax) return null;
  return Math.round(factor * 100) / 100;
}

function mesaFitZoom(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 40 || h < 40) return null;
  const frame = MESA_CATALOG.frame;
  const fit = Math.min(w / frame.width, h / frame.height);
  const bounds = MESA_CATALOG.scale;
  return Math.round(Math.min(bounds.autoMax, Math.max(bounds.autoMin, fit)) * 100) / 100;
}

function googleLoginHost(host) {
  if (host === 'google.com' || host.endsWith('.google.com')) return true;
  if (host === 'googleapis.com' || host.endsWith('.googleapis.com')) return true;
  if (host === 'gstatic.com' || host.endsWith('.gstatic.com')) return true;
  if (host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com')) return true;
  if (host === 'accounts.youtube.com') return true;
  return false;
}

function mesaLiveKind(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return ''; }
  if (url.protocol !== 'https:') return '';
  const host = url.hostname.toLowerCase();
  if (host === 'pokeidle.io' || host.endsWith('.pokeidle.io')) return 'game';
  if (host === 'challenges.cloudflare.com' || host.endsWith('.cloudflare.com')) return 'game';
  if (googleLoginHost(host)) return 'game';
  if (host === 'discord.com' || host.endsWith('.discord.com')) return 'game';
  if (host === 'discordapp.com' || host.endsWith('.discordapp.com')) return 'game';
  return '';
}

function mesaPotionAt(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  const pct = Math.round(amount / 10) * 10;
  if (pct < 10 || pct > 100) return null;
  return pct;
}

function mesaCeiling(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.min(1000000000, Math.round(amount));
}

MESA_CATALOG.normalize = function normalize(input) {
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const layouts = MESA_CATALOG.layouts.map((item) => item.id);
  const bays = [];
  for (let i = 0; i < MESA_CATALOG.bays; i += 1) {
    const raw = (data.bays || [])[i] || {};
    const desired = {};
    for (const auto of MESA_CATALOG.autos) {
      if (typeof raw.desired?.[auto.id] === 'boolean') desired[auto.id] = raw.desired[auto.id];
    }
    const fallback = `Baía ${i + 1}`;
    const name = String(raw.name || fallback).trim().slice(0, 32) || fallback;
    bays.push({
      name,
      renamed: raw.renamed === true && name !== fallback,
      muted: raw.muted === true,
      eco: raw.eco === true,
      sniper: raw.sniper === true,
      ceiling: mesaCeiling(raw.ceiling),
      goods: String(raw.goods || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      potionAt: mesaPotionAt(raw.potionAt),
      scale: mesaScale(raw.scale),
      autoHunt: raw.autoHunt === true,
      open: raw.open !== false,
      placed: raw.placed !== false,
      desired,
    });
  }
  const selected = Number.isInteger(data.selected) ? data.selected : 0;
  return {
    night: data.night === true,
    otimizado: data.otimizado === true,
    trackers: data.trackers === true,
    layout: layouts.includes(data.layout) ? data.layout : 'grade',
    selected: Math.min(MESA_CATALOG.bays - 1, Math.max(0, selected)),
    bays,
  };
};

MESA_CATALOG.clampPotion = mesaPotionAt;
function mesaIsGoogleLoginUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  return googleLoginHost(url.hostname.toLowerCase());
}

MESA_CATALOG.liveKind = mesaLiveKind;
MESA_CATALOG.isGoogleLoginUrl = mesaIsGoogleLoginUrl;
MESA_CATALOG.fitZoom = mesaFitZoom;
MESA_CATALOG.clampScale = mesaScale;

if (typeof module !== 'undefined' && module.exports) module.exports = MESA_CATALOG;
