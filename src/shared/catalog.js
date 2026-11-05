var MESA_CATALOG = {
  gameUrl: 'https://pokeidle.io/app',
  bays: 4,
  partitions: ['persist:mesa-1', 'persist:mesa-2', 'persist:mesa-3', 'persist:mesa-4'],
  twitchPartitions: ['persist:mesa-twitch-1', 'persist:mesa-twitch-2', 'persist:mesa-twitch-3', 'persist:mesa-twitch-4'],
  twitchLimiares: [2, 5, 10, 15],
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
    { id: 'livre', label: 'Livre' },
  ],
  // Tamanho próprio de cada baía (disposição Livre). span = colunas de 12; h = px, 0 = automática.
  box: {
    spanMin: 3,
    spanMax: 12,
    spanDefault: 6,
    heightMin: 120,
    heightMax: 800,
    heightStep: 10,
    presets: [
      { span: 3, label: '1/4' },
      { span: 4, label: '1/3' },
      { span: 6, label: '1/2' },
      { span: 8, label: '2/3' },
      { span: 9, label: '3/4' },
      { span: 12, label: 'Tudo' },
    ],
  },
};

// Preferências globais do bônus Twitch: tipos de recompensa e limiar de resgate, em minutos.
function mesaTwitchPrefs(raw) {
  const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const t = d.tipos && typeof d.tipos === 'object' ? d.tipos : {};
  const limiar = Number(d.limiarMin);
  return {
    tipos: { xp: t.xp !== false, captura: t.captura === true, shiny: t.shiny === true },
    limiarMin: MESA_CATALOG.twitchLimiares.includes(limiar) ? limiar : 5,
  };
}

function mesaBoxSpan(value) {
  const box = MESA_CATALOG.box;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < box.spanMin || amount > box.spanMax) return box.spanDefault;
  return amount;
}

function mesaBoxHeight(value) {
  const box = MESA_CATALOG.box;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const snapped = Math.round(amount / box.heightStep) * box.heightStep;
  return Math.min(box.heightMax, Math.max(box.heightMin, snapped));
}

function mesaBayBox(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { span: mesaBoxSpan(data.span), h: mesaBoxHeight(data.h) };
}

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

const MESA_DEFAULT_BAY_WEIGHTS = {
  grade: { cols: [1, 1], rows: [1, 1] },
  fila: { cols: [1, 1, 1, 1] },
  coluna: { rows: [1, 1, 1, 1] },
};

function mesaWeightItem(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function mesaWeightAxis(raw, length) {
  if (!Array.isArray(raw) || raw.length !== length) return null;
  const out = [];
  for (let i = 0; i < length; i += 1) {
    const item = mesaWeightItem(raw[i]);
    if (item == null) return null;
    out.push(item);
  }
  return out;
}

function mesaBayWeights(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const gradeIn = data.grade && typeof data.grade === 'object' ? data.grade : {};
  const filaIn = data.fila && typeof data.fila === 'object' ? data.fila : {};
  const colunaIn = data.coluna && typeof data.coluna === 'object' ? data.coluna : {};
  const grade = {
    cols: mesaWeightAxis(gradeIn.cols, 2) || [...MESA_DEFAULT_BAY_WEIGHTS.grade.cols],
    rows: mesaWeightAxis(gradeIn.rows, 2) || [...MESA_DEFAULT_BAY_WEIGHTS.grade.rows],
  };
  const fila = {
    cols: mesaWeightAxis(filaIn.cols, 4) || [...MESA_DEFAULT_BAY_WEIGHTS.fila.cols],
  };
  const coluna = {
    rows: mesaWeightAxis(colunaIn.rows, 4) || [...MESA_DEFAULT_BAY_WEIGHTS.coluna.rows],
  };
  return { grade, fila, coluna };
}

function mesaChromeExpanded(value) {
  return value !== false;
}

function mesaChrome(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const cols = data.columnsExpanded && typeof data.columnsExpanded === 'object' ? data.columnsExpanded : {};
  return {
    railExpanded: mesaChromeExpanded(data.railExpanded),
    opExpanded: mesaChromeExpanded(data.opExpanded),
    columnsExpanded: {
      autos: mesaChromeExpanded(cols.autos),
      focus: mesaChromeExpanded(cols.focus),
      account: mesaChromeExpanded(cols.account),
    },
  };
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
      ultra: raw.ultra === true,
      sniper: raw.sniper === true,
      ceiling: mesaCeiling(raw.ceiling),
      goods: String(raw.goods || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      potionAt: mesaPotionAt(raw.potionAt),
      scale: mesaScale(raw.scale),
      autoHunt: raw.autoHunt === true,
      twitchAuto: raw.twitchAuto === true,
      open: raw.open !== false,
      placed: raw.placed !== false,
      box: mesaBayBox(raw.box),
      desired,
    });
  }
  const selected = Number.isInteger(data.selected) ? data.selected : 0;
  return {
    shellTheme: data.shellTheme === 'mesa-claro' ? 'mesa-claro' : 'mesa',
    night: data.night === true,
    otimizado: data.otimizado === true,
    trackers: data.trackers === true,
    layout: layouts.includes(data.layout) ? data.layout : 'grade',
    selected: Math.min(MESA_CATALOG.bays - 1, Math.max(0, selected)),
    bays,
    bayWeights: mesaBayWeights(data.bayWeights),
    chrome: mesaChrome(data.chrome),
    twitch: mesaTwitchPrefs(data.twitch),
  };
};

MESA_CATALOG.clampPotion = mesaPotionAt;
MESA_CATALOG.boxSpan = mesaBoxSpan;
MESA_CATALOG.boxHeight = mesaBoxHeight;
MESA_CATALOG.boxOf = mesaBayBox;
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
