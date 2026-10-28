const { ipcRenderer } = require('electron');

if (typeof installHuntBridge === 'function') installHuntBridge(ipcRenderer);

const AUTOS = new Set([
  'auto-ball-captura',
  'auto-ball-sem-parar',
  'auto-revive',
  'auto-potion',
  'auto-voltar-hunt',
]);
const NAV = new Set(['Mapa', 'Pokédex', 'Depot', 'Boss', 'Market']);

const PREF_KEYS = ['cfg-otimizado', 'cfg-night', 'cfg-economia', 'cfg-som'];

function cleanPrefs(raw) {
  const next = {};
  if (!raw || typeof raw !== 'object') return next;
  for (const key of PREF_KEYS) {
    if (raw[key] === '0' || raw[key] === '1') next[key] = raw[key];
  }
  return next;
}

let prefs = {};
try { prefs = cleanPrefs(ipcRenderer.sendSync('bay:prefs')); } catch { prefs = {}; }

function syncEconomy(wantOn) {
  const root = document.documentElement;
  if (!root) return;
  const on = root.classList.contains('modo-economia');
  if (wantOn === on) return;
  const turnOn = document.getElementById('hunt-eco') || document.getElementById('arena-eco');
  const turnOff = document.getElementById('eco-sair');
  if (wantOn && turnOn) {
    try { localStorage.setItem('cfg-economia', '0'); } catch { /* a página pode ainda não ter storage */ }
    try { turnOn.click(); } catch { /* o jogo ainda está subindo */ }
    return;
  }
  if (!wantOn && turnOff) {
    try { turnOff.click(); } catch { /* o jogo ainda está subindo */ }
    return;
  }
  try { localStorage.setItem('cfg-economia', wantOn ? '1' : '0'); } catch { /* a página pode ainda não ter storage */ }
}

function applyPrefs() {
  try {
    for (const [key, value] of Object.entries(prefs)) {
      if (key.startsWith('cfg-') && key !== 'cfg-economia' && localStorage.getItem(key) !== value) {
        localStorage.setItem(key, value);
      }
    }
  } catch { /* a página pode ainda não ter storage */ }
  syncEconomy(prefs['cfg-economia'] === '1');
  const root = document.documentElement;
  if (root && prefs['cfg-night'] === '1' && !root.classList.contains('night-mode')) {
    root.classList.add('night-mode');
  }
  if (root && prefs['cfg-night'] === '0') root.classList.remove('night-mode');
}

applyPrefs();
ipcRenderer.on('prefs', (_event, next) => {
  prefs = { ...prefs, ...cleanPrefs(next) };
  applyPrefs();
});

ipcRenderer.on('click-id', (_event, id) => {
  if (typeof id !== 'string' || !AUTOS.has(id)) return;
  const node = document.getElementById(id);
  if (!node) return;
  const tag = node.tagName;
  if (tag !== 'INPUT' && tag !== 'BUTTON') return;
  node.click();
});

function buttonForLabel(label) {
  const matches = [];
  for (const node of document.querySelectorAll('button')) {
    if (node.querySelector('button')) continue;
    if (node.innerText.trim() !== label) continue;
    matches.push(node);
  }
  const visible = matches.find((node) => node.offsetParent !== null && !node.disabled);
  return visible || matches[0] || null;
}

ipcRenderer.on('click-label', (_event, label) => {
  if (typeof label !== 'string' || !NAV.has(label)) return;
  const button = buttonForLabel(label);
  if (button) button.click();
});

function clampPotion(value) {
  const pct = Math.round(Number(value) / 10) * 10;
  if (!Number.isFinite(pct) || pct < 10 || pct > 100) return null;
  return pct;
}

function readPotion() {
  const slider = document.querySelector('#auto-limiar .auto-limiar-barra');
  if (!slider) return null;
  return clampPotion(slider.value);
}

ipcRenderer.on('potion-at', (_event, pct) => {
  const want = clampPotion(pct);
  const slider = document.querySelector('#auto-limiar .auto-limiar-barra');
  if (want == null || !slider || Number(slider.value) === want) return;
  slider.value = String(want);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
});

let sniper = { on: false, ceiling: 0, goods: [] };
let boughtUntil = 0;
let pendingGood = '';

ipcRenderer.on('sniper', (_event, next) => {
  const goods = Array.isArray(next?.goods) ? next.goods : [];
  const ceiling = Number(next?.ceiling);
  sniper = {
    on: next?.on === true,
    ceiling: Number.isFinite(ceiling) && ceiling > 0 ? Math.min(1000000000, Math.round(ceiling)) : 0,
    goods: goods.map((item) => String(item).trim().toLowerCase().slice(0, 80)).filter(Boolean).slice(0, 12),
  };
});

function rowOf(button) {
  let node = button.parentElement;
  for (let depth = 0; depth < 6 && node && node !== document.body; depth += 1) {
    const label = node.innerText.replace(/\s+/g, ' ').trim();
    if (label.length > 0 && label.length < 400 && node.querySelectorAll('button').length <= 4) return label;
    node = node.parentElement;
  }
  return '';
}

function priceOf(label) {
  const tagged = label.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[,](\d{1,2}))?\s*(gemas?|ouro|coins?)/i);
  const plain = label.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[,](\d{1,2}))?(?!.*\d)/);
  const match = tagged || plain;
  if (!match) return null;
  const amount = Number(match[1].replace(/\./g, '') + (match[2] ? `.${match[2]}` : ''));
  return Number.isFinite(amount) ? amount : null;
}

function visibleBuyButtons() {
  return [...document.querySelectorAll('button')].filter((node) => (
    node.offsetParent !== null && !node.disabled && /^comprar$/i.test(node.innerText.trim())
  ));
}

function confirmBuy(good) {
  const button = [...document.querySelectorAll('button')].find((node) => {
    if (node.offsetParent === null || node.disabled) return false;
    if (!/^(confirmar|sim)$/i.test(node.innerText.trim())) return false;
    const box = node.closest('[role="dialog"], dialog, #confirmar') || node.parentElement;
    return (box?.innerText || '').toLowerCase().includes(good);
  });
  if (button) button.click();
}

function scanSniper() {
  if (pendingGood && Date.now() < boughtUntil) {
    confirmBuy(pendingGood);
    return { seen: 0, bought: '' };
  }
  pendingGood = '';
  if (!sniper.on || !(sniper.ceiling > 0) || !sniper.goods.length) return { seen: 0, bought: '' };
  const offers = visibleBuyButtons().map((button) => ({ button, label: rowOf(button), price: priceOf(rowOf(button)) }));
  const hit = offers.find((offer) => (
    offer.price != null
    && offer.price <= sniper.ceiling
    && sniper.goods.some((good) => offer.label.toLowerCase().includes(good))
  ));
  if (hit && Date.now() >= boughtUntil) {
    const good = sniper.goods.find((item) => hit.label.toLowerCase().includes(item));
    hit.button.click();
    pendingGood = good || '';
    boughtUntil = Date.now() + 8000;
    return { seen: offers.length, bought: hit.label.slice(0, 80) };
  }
  return { seen: offers.length, bought: '' };
}

let market = { seen: 0, bought: '' };

function text(id) {
  return ((document.getElementById(id) || {}).textContent || '').trim();
}

function snapshot() {
  const login = document.getElementById('login');
  const loginVisible = !!(login && login.offsetParent !== null);
  const auto = {};
  for (const id of AUTOS) {
    const node = document.getElementById(id);
    auto[id] = node ? !!node.checked : null;
  }
  return {
    loggedIn: !loginVisible && !!text('tr-xp-txt'),
    xpText: text('tr-xp-txt'),
    nick: text('tr-nick'),
    level: text('tr-level'),
    gold: text('tr-gold'),
    auto,
    market,
    potionAt: readPotion(),
  };
}

setInterval(() => {
  applyPrefs();
  market = scanSniper();
  try { ipcRenderer.sendToHost('state', snapshot()); } catch { /* a baía pode estar fechando */ }
}, 5000);
