var cfg = MESA_CATALOG.normalize({});
var live = Array.from({ length: MESA_CATALOG.bays }, () => ({
  loggedIn: false,
  nick: '',
  level: '',
  gold: '',
  auto: {},
  samples: [],
  gained: 0,
  lastXp: null,
  rate: null,
  ram: null,
  ready: false,
  phase: 'fila',
  error: '',
  lastGood: '',
  editing: false,
  applied: {},
  potionAt: null,
  painted: false,
  capturas: MesaCaptureTally.empty(),
}));
var webviews = [];
var ui = {};
var xpHistoryDoc = null;
var xpHistoryDirty = false;

const AUTO_ICON = {
  'auto-ball-captura': 'capturar',
  'auto-ball-sem-parar': 'repetir',
  'auto-revive': 'revive',
  'auto-potion': 'pocao',
  'auto-voltar-hunt': 'voltar',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function setCount(node, value) {
  if (!node) return;
  const card = node.closest('.kpi-card');
  if (card) card.dataset.zero = value === 0 ? '1' : '0';
  const text = String(value);
  if (node.textContent === text) return;
  node.textContent = text;
}

function toggleSvg(pathD) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '4');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  svg.append(path);
  return svg;
}

function toggle(label, className) {
  const wrap = el('label', `${className || 'label cursor-pointer gap-2 justify-start min-h-9'} mesa-switch-wrap`.trim());
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.className =
    'toggle border-base-300 bg-base-300 text-base-content checked:border-success checked:bg-success checked:text-success-content';
  wrap.append(el('span', 'label-text', label || ''), input, el('span', 'toggle-state', 'Desligado'));
  return wrap;
}

function toggleInput(node) {
  if (!node) return null;
  if (node.tagName === 'INPUT') return node;
  return node.querySelector('.toggle, input[type="checkbox"]');
}

function syncRangeFill(input) {
  if (!input || input.type !== 'range') return;
  const min = Number(input.min);
  const max = Number(input.max);
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : 100;
  const span = hi - lo || 1;
  const val = Number(input.value);
  const pct = Math.max(0, Math.min(100, ((val - lo) / span) * 100));
  input.style.setProperty('--range-p', `${pct}%`);
}

function setChecked(node, on) {
  const input = toggleInput(node);
  const checked = !!on;
  if (input) input.checked = checked;
  const host = (input && input.closest('[role="switch"]')) || node;
  if (host && host.getAttribute('role') === 'switch') {
    if (host.tagName !== 'INPUT') host.setAttribute('aria-checked', checked ? 'true' : 'false');
    const state = (input ? input.parentElement : host).querySelector('.toggle-state');
    if (state) state.textContent = checked ? 'Ligado' : 'Desligado';
  }
}

function applyShellTheme(theme) {
  cfg.shellTheme = theme === 'mesa-claro' ? 'mesa-claro' : 'mesa';
  document.documentElement.setAttribute('data-theme', cfg.shellTheme);
  save();
}

function bayStatusClass(status) {
  if (status.tone === 'live') return 'badge badge-sm badge-soft badge-success bay-status';
  if (status.tone === 'wait' || status.tone === 'bad') return 'badge badge-sm badge-soft badge-neutral bay-status';
  return 'badge badge-sm badge-ghost bay-status';
}

function stamp() {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

let cfgReady = false;
let cfgTicket = 0;

function save() {
  if (!window.mesa || typeof window.mesa.saveCfg !== 'function') return Promise.resolve(false);
  const ticket = ++cfgTicket;
  return window.mesa.saveCfg(MESA_CATALOG.normalize(cfg), ticket);
}

function flushCfgNow() {
  if (!cfgReady || !window.mesa || typeof window.mesa.flushCfg !== 'function') return;
  try {
    const ticket = ++cfgTicket;
    window.mesa.flushCfg(MESA_CATALOG.normalize(cfg), ticket);
  } catch { /* a janela está fechando */ }
}

function flushXpHistoryNow() {
  if (!xpHistoryDirty || !xpHistoryDoc || !window.mesa) return;
  const payload = typeof MesaXpHistory !== 'undefined' ? MesaXpHistory.normalize(xpHistoryDoc) : xpHistoryDoc;
  xpHistoryDirty = false;
  if (typeof window.mesa.flushHistory === 'function') {
    try { window.mesa.flushHistory(payload); } catch { xpHistoryDirty = true; }
    return;
  }
  if (typeof window.mesa.saveHistory === 'function') {
    window.mesa.saveHistory(payload).catch(() => { xpHistoryDirty = true; });
  }
}

function noteXpHistory(index) {
  if (!xpHistoryDoc || typeof MesaXpHistory === 'undefined') return;
  const bay = live[index];
  if (!bay || !bay.loggedIn || !Number.isFinite(bay.rate)) return;
  const result = MesaXpHistory.appendPoint(xpHistoryDoc, index, Date.now(), bay.rate, true);
  if (!result.added) return;
  xpHistoryDoc = result.doc;
  xpHistoryDirty = true;
  flushXpHistoryNow();
  if (typeof paintStandby === 'function') paintStandby();
}

function titleOf(index) {
  const bay = cfg.bays[index];
  if (bay.renamed) return bay.name;
  if (live[index].loggedIn && live[index].nick) return live[index].nick;
  return `Baía ${index + 1}`;
}

function statusOf(index) {
  if (cfg.bays[index].open === false) return { word: 'fechada', alert: false, tone: 'off' };
  const bay = live[index];
  if (bay.error) return { word: 'caiu', alert: true, tone: 'bad' };
  if (!bay.loggedIn) return { word: 'sem sessão', alert: false, tone: 'off' };
  if (bay.rate == null) return { word: 'medindo', alert: false, tone: 'wait' };
  if (bay.rate > 0) return { word: 'caçando', alert: false, tone: 'live' };
  return { word: 'parada', alert: true, tone: 'bad' };
}

function autoOn(index, id) {
  const actual = live[index].auto?.[id];
  if (typeof actual === 'boolean') return actual;
  return cfg.bays[index].desired[id] === true;
}

function otherBall(id) {
  if (id === 'auto-ball-captura') return 'auto-ball-sem-parar';
  if (id === 'auto-ball-sem-parar') return 'auto-ball-captura';
  return '';
}

function applyAuto(index, id, want) {
  const bay = cfg.bays[index];
  const next = want === true;
  bay.desired[id] = next;
  const other = next ? otherBall(id) : '';
  if (other) bay.desired[other] = false;
  const actual = live[index].auto?.[id];
  if (webviews[index] && live[index].ready && (typeof actual !== 'boolean' || actual !== next)) {
    webviews[index].send('click-id', id);
  }
  if (live[index].auto && typeof live[index].auto[id] === 'boolean') live[index].auto[id] = next;
  if (other && live[index].auto && typeof live[index].auto[other] === 'boolean') live[index].auto[other] = false;
}

function applyPotion(index, pct) {
  const clean = MESA_CATALOG.clampPotion(pct);
  if (clean == null) return;
  cfg.bays[index].potionAt = clean;
  if (live[index].potionAt !== clean && webviews[index] && live[index].ready) {
    webviews[index].send('potion-at', clean);
  }
  live[index].potionAt = clean;
}

function potionShown(index) {
  if (Number.isFinite(live[index].potionAt)) return live[index].potionAt;
  if (Number.isFinite(cfg.bays[index].potionAt)) return cfg.bays[index].potionAt;
  return null;
}

function pushPrefs() {
  webviews.forEach((webview, index) => {
    if (!webview || !live[index].ready) return;
    const focused = index === cfg.selected;
    webview.send('prefs', {
      'cfg-night': cfg.night ? '1' : '0',
      'cfg-otimizado': cfg.otimizado ? '1' : '0',
      'cfg-economia': (!focused || cfg.bays[index].eco) ? '1' : '0',
      'cfg-ultra': cfg.bays[index].ultra ? '1' : '0',
      'cfg-som': cfg.bays[index].muted ? '0' : '1',
    });
  });
}

function applyBayAudioMute(index) {
  const list = MesaBayAudio.calls(cfg.bays, index);
  for (const call of list) {
    const webview = webviews[call.index];
    if (!webview || typeof webview.setAudioMuted !== 'function') continue;
    try {
      webview.setAudioMuted(call.muted);
    } catch (_) {
      /* webview guest destruído */
    }
  }
}

function tuneBays() {
  if (window.mesa && window.mesa.tune) window.mesa.tune(cfg.selected, cfg.view !== 'ajustes' && cfg.view !== 'espera');
}

function deskBays() {
  return live.map((bay, index) => (
    cfg.bays[index] && cfg.bays[index].placed === false ? { skip: true, loggedIn: false, rate: null } : bay
  ));
}

function paintSummary() {
  const { counts, rates } = MesaStatus.classify(deskBays());
  const parts = rates.filter((rate) => rate != null).map((rate) => Math.round(rate));
  console.assert(counts.cacando + counts.medindo + counts.paradas + counts.sem === counts.grade);
  console.assert(parts.reduce((total, part) => total + part, 0) === MesaStatus.fmtXp(parts.reduce((total, part) => total + part, 0)).rounded);
  setCount(ui.cacando, counts.cacando);
  setCount(ui.medindo, counts.medindo);
  setCount(ui.paradas, counts.paradas);
  setCount(ui.sem, counts.sem);
  let actionable = 0;
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const bay = cfg.bays[index];
    if (!bay || bay.placed === false || bay.open === false) continue;
    if (!live[index].loggedIn || live[index].rate == null || live[index].rate > 0) continue;
    actionable += 1;
  }
  const showFinding = actionable > 0;
  ui.finding.hidden = !showFinding;
  if (!showFinding) {
    ui.finding.replaceChildren();
    ui.finding.className = 'finding mesa-finding';
    return;
  }
  const sentence = MesaStatus.finding(counts, rates);
  ui.finding.replaceChildren();
  ui.finding.className = 'finding mesa-finding';
  const noun = counts.paradas === 1 ? '1 baía parada' : `${counts.paradas} baías paradas`;
  ui.finding.append(el('em', null, noun), document.createTextNode(sentence.slice(noun.length)));
}

function paintBay(index) {
  const bay = ui.bays[index];
  const onGrid = cfg.bays[index].placed !== false;
  bay.root.hidden = !onGrid;
  if (bay.awayBtn) bay.awayBtn.disabled = cfg.bays.filter((item) => item.placed !== false).length <= 1;
  if (!onGrid) {
    if (typeof paintStandby === 'function') paintStandby();
    return;
  }
  const status = statusOf(index);
  const closed = cfg.bays[index].open === false;
  const gameReady = !!live[index].painted && live[index].phase === 'jogo';
  bay.root.classList.toggle('is-selected', cfg.selected === index);
  bay.root.classList.toggle('is-painted', gameReady && !closed);
  if (!live[index].editing) bay.name.textContent = titleOf(index);
  if (bay.huntHint) {
    const hint = typeof MesaAutoHunt !== 'undefined' && MesaAutoHunt.line ? MesaAutoHunt.line(index) : '';
    bay.huntHint.hidden = !hint;
    bay.huntHint.textContent = hint;
  }
  bay.status.textContent = status.word;
  bay.status.className = bayStatusClass(status);
  bay.status.dataset.tone = status.tone;
  bay.root.dataset.tone = status.tone;
  const xp = MesaStatus.fmtXp(live[index].loggedIn ? live[index].rate : null);
  bay.xp.textContent = xp.text;
  bay.level.textContent = live[index].loggedIn && live[index].level ? live[index].level : '\u2013';
  bay.gold.textContent = live[index].loggedIn && live[index].gold ? live[index].gold : '\u2013';
  bay.ram.textContent = live[index].ram == null ? '\u2013' : `${live[index].ram} MB`;
  bay.rename.hidden = false;
  const hint = bay.huntHint && !bay.huntHint.hidden ? bay.huntHint.textContent : '';
  bay.root.setAttribute('aria-label', `Baía ${index + 1}, ${titleOf(index)}, ${status.word}${hint ? `, ${hint}` : ''}`);
  if (bay.openBtn) bay.openBtn.hidden = !closed;
  if (bay.closeBtn) bay.closeBtn.hidden = closed;
  if (closed) {
    bay.root.classList.remove('is-painted');
    bay.stage.classList.add('is-empty');
    bay.empty.hidden = false;
    bay.empty.textContent = 'Baía fechada. O login continua guardado nesta baía.';
    if (webviews[index]) webviews[index].style.visibility = 'hidden';
    if (typeof paintStandby === 'function') paintStandby();
    return;
  }
  const waiting = live[index].phase !== 'jogo';
  bay.stage.classList.toggle('is-empty', waiting || !gameReady);
  const showStage = gameReady && !closed;
  bay.empty.hidden = showStage || !waiting;
  if (webviews[index]) webviews[index].style.visibility = showStage ? 'visible' : 'hidden';
  if (live[index].error) bay.empty.textContent = `${live[index].error} Último estado às ${live[index].lastGood || stamp()}.`;
  else if (!window.mesa) bay.empty.textContent = 'O jogo entra neste quadro quando a mesa roda no aplicativo.';
  else if (live[index].phase === 'fila') bay.empty.textContent = 'Aguardando a vez nesta abertura.';
  else bay.empty.textContent = 'Abrindo o jogo. Entre com a conta local.';
  if (typeof paintStandby === 'function') paintStandby();
}

function paint() {
  const view = cfg.view === 'ajustes' || cfg.view === 'espera' ? cfg.view : 'mesa';
  ui.mesaBtn.classList.toggle('dock-active', view === 'mesa');
  if (ui.esperaBtn) ui.esperaBtn.classList.toggle('dock-active', view === 'espera');
  ui.ajustesBtn.classList.toggle('dock-active', view === 'ajustes');
  [ui.mesaBtn, ui.esperaBtn, ui.ajustesBtn].forEach((button) => {
    if (!button) return;
    button.removeAttribute('aria-current');
  });
  const current = view === 'espera' ? ui.esperaBtn : (view === 'ajustes' ? ui.ajustesBtn : ui.mesaBtn);
  if (current) current.setAttribute('aria-current', 'page');
  if (ui.dock) {
    const dockIndex = view === 'espera' ? 0 : (view === 'ajustes' ? 2 : 1);
    ui.dock.style.setProperty('--dock-i', String(dockIndex));
    if (!ui.dock.classList.contains('is-ready')) requestAnimationFrame(() => ui.dock.classList.add('is-ready'));
  }
  ui.mesaView.hidden = view !== 'mesa';
  if (ui.esperaView) ui.esperaView.hidden = view !== 'espera';
  ui.ajustesView.hidden = view !== 'ajustes';
  if (ui.pageTitle) {
    ui.pageTitle.textContent = view === 'ajustes' ? 'Configurações' : (view === 'espera' ? 'Espera' : 'Automações');
  }
  if (ui.kpiRow) ui.kpiRow.hidden = view === 'ajustes';
  if (ui.finding && view !== 'mesa') ui.finding.hidden = true;
  if (ui.focusBayTitle) ui.focusBayTitle.textContent = titleOf(cfg.selected);
  if (ui.opTabFocus) {
    ui.opTabFocus.textContent = titleOf(cfg.selected);
    ui.opTabFocus.setAttribute('aria-label', `Baía em foco: ${titleOf(cfg.selected)}`);
  }
  if (typeof syncOpTabInk === 'function') syncOpTabInk();
  ui.baysBox.dataset.layout = cfg.layout;
  paintBayBoxes();
  paintBaySize();
  for (const auto of MESA_CATALOG.autos) setChecked(ui.autos[auto.id], autoOn(cfg.selected, auto.id));
  setChecked(ui.mute, cfg.bays[cfg.selected].muted);
  setChecked(ui.eco, cfg.bays[cfg.selected].eco);
  setChecked(ui.ultra, cfg.bays[cfg.selected].ultra === true);
  setChecked(ui.night, cfg.night);
  setChecked(ui.otimizado, cfg.otimizado);
  setChecked(ui.trackers, cfg.trackers);
  ui.igualar.disabled = !live[cfg.selected].loggedIn;
  if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.paint();
  for (const item of MESA_CATALOG.layouts) {
    const on = cfg.layout === item.id;
    for (const registry of [ui.layouts, ui.layoutsBar]) {
      if (!registry || !registry[item.id]) continue;
      registry[item.id].classList.toggle('btn-active', on);
      registry[item.id].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  const shellDark = cfg.shellTheme !== 'mesa-claro';
  if (ui.shellMesa) {
    ui.shellMesa.classList.toggle('btn-active', shellDark);
    ui.shellMesa.setAttribute('aria-pressed', shellDark ? 'true' : 'false');
  }
  if (ui.shellClaro) {
    ui.shellClaro.classList.toggle('btn-active', !shellDark);
    ui.shellClaro.setAttribute('aria-pressed', !shellDark ? 'true' : 'false');
  }
  document.documentElement.setAttribute('data-theme', cfg.shellTheme);
  paintPotion();
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) paintBay(index);
  paintSummary();
  if (ui.finding && view !== 'mesa') ui.finding.hidden = true;
  if (typeof paintExtras === 'function') paintExtras();
  if (typeof paintLiveBonus === 'function') paintLiveBonus();
  if (typeof paintZoom === 'function') paintZoom();
  if (typeof paintSlots === 'function') paintSlots();
  if (typeof syncShellFold === 'function') syncShellFold();
  if (typeof syncLeave === 'function') syncLeave();
  if (typeof paintStandby === 'function') paintStandby();
}

function paintPotion() {
  if (!ui.potion) return;
  const shown = potionShown(cfg.selected);
  const editing = document.activeElement === ui.potion;
  ui.potion.disabled = shown == null && !editing;
  if (editing) return;
  ui.potion.value = shown == null ? '10' : String(shown);
  ui.potionPct.textContent = shown == null ? '\u2013' : `${shown}%`;
  syncRangeFill(ui.potion);
}

function select(index) {
  if (cfg.bays[index] && cfg.bays[index].placed === false) return;
  cfg.selected = index;
  save();
  paint();
  pushPrefs();
  tuneBays();
}

function reconcile(index) {
  if (!live[index].loggedIn || !live[index].ready) return;
  const now = Date.now();
  for (const auto of MESA_CATALOG.autos) {
    const want = cfg.bays[index].desired[auto.id];
    const actual = live[index].auto?.[auto.id];
    if (typeof want !== 'boolean' || typeof actual !== 'boolean' || want === actual) continue;
    if (want === false && otherBall(auto.id) && cfg.bays[index].desired[otherBall(auto.id)] === true) continue;
    if (now - (live[index].applied[auto.id] || 0) < 5000) continue;
    live[index].applied[auto.id] = now;
    webviews[index].send('click-id', auto.id);
  }
  const wantPotion = cfg.bays[index].potionAt;
  const actualPotion = live[index].potionAt;
  if (wantPotion != null && actualPotion != null && wantPotion !== actualPotion && now - (live[index].applied.potionAt || 0) >= 5000) {
    live[index].applied.potionAt = now;
    webviews[index].send('potion-at', wantPotion);
  }
}

function onState(index, snap) {
  const bay = live[index];
  if (!bay.painted) {
    bay.painted = true;
    if (typeof sizeBayFrame === 'function') sizeBayFrame(index);
    if (typeof applyBayZoom === 'function') applyBayZoom(index, true);
  }
  bay.loggedIn = !!snap.loggedIn;
  bay.nick = snap.nick || '';
  bay.level = snap.level || '';
  bay.gold = snap.gold || '';
  bay.auto = snap.auto || {};
  bay.market = snap.market || null;
  if ('potionAt' in snap) bay.potionAt = MESA_CATALOG.clampPotion(snap.potionAt);
  bay.lastGood = stamp();
  bay.error = '';
  if (bay.loggedIn) {
    const xp = MesaStatus.parseXp(snap.xpText);
    if (xp) MesaStatus.pushSample(bay, xp);
    bay.rate = MesaStatus.perHour(bay);
    noteXpHistory(index);
    reconcile(index);
  } else {
    bay.rate = null;
  }
  paintBay(index);
  paintSummary();
  ui.igualar.disabled = !live[cfg.selected].loggedIn;
  for (const auto of MESA_CATALOG.autos) setChecked(ui.autos[auto.id], autoOn(cfg.selected, auto.id));
}

const openLater = [];

function clearOpenLater(index) {
  if (!openLater[index]) return;
  clearTimeout(openLater[index]);
  openLater[index] = null;
}

function releaseGame(index) {
  clearOpenLater(index);
  const webview = webviews[index];
  webviews[index] = null;
  if (webview) {
    try { webview.stop(); } catch { /* a baía já saiu da tela */ }
    try { webview.remove(); } catch { /* a baía já saiu da tela */ }
  }
  live[index].ready = false;
  live[index].loggedIn = false;
  live[index].rate = null;
  live[index].ram = null;
  live[index].error = '';
  live[index].painted = false;
  if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.clear(index);
}

function openBay(index) {
  if (cfg.bays[index].open === false || cfg.bays[index].placed === false) return;
  const webview = webviews[index];
  if (!webview || webview.isConnected) return;
  live[index].phase = 'abrindo';
  live[index].painted = false;
  live[index].error = '';
  webview.setAttribute('src', MESA_CATALOG.gameUrl);
  ui.bays[index].stage.append(webview);
  paintBay(index);
}

function ensureGame(index, delay) {
  if (cfg.bays[index].open === false || cfg.bays[index].placed === false) return;
  if (!webviews[index]) {
    const webview = document.createElement('webview');
    webview.setAttribute('partition', MESA_CATALOG.partitions[index]);
    webview.addEventListener('dom-ready', () => {
      if (webviews[index] !== webview) return;
      if (live[index].phase === 'erro' || cfg.bays[index].open === false || cfg.bays[index].placed === false) return;
      live[index].ready = true;
      live[index].phase = 'jogo';
      live[index].error = '';
      if (typeof sizeBayFrame === 'function') sizeBayFrame(index);
      if (typeof applyBayZoom === 'function') applyBayZoom(index, true);
      paintBay(index);
      pushPrefs();
      applyBayAudioMute(index);
      tuneBays();
      if (typeof pushSniper === 'function') pushSniper(index);
    });
    webview.addEventListener('did-fail-load', (event) => {
      if (webviews[index] !== webview) return;
      if (!event.isMainFrame || event.errorCode === -3) return;
      const reason = event.errorDescription || `código ${event.errorCode}`;
      live[index].error = `O jogo não abriu nesta baía (${reason}).`;
      live[index].phase = 'erro';
      live[index].ready = false;
      live[index].painted = false;
      paintBay(index);
    });
    webview.addEventListener('render-process-gone', () => {
      if (webviews[index] !== webview) return;
      live[index].error = 'Esta baía caiu.';
      live[index].phase = 'erro';
      live[index].ready = false;
      live[index].painted = false;
      paintBay(index);
    });
    webview.addEventListener('ipc-message', (event) => {
      if (webviews[index] !== webview) return;
      if (event.channel === 'state') onState(index, event.args[0]);
      if (event.channel === 'hunt') {
        const payload = event.args[0];
        if (typeof MesaCaptureTally !== 'undefined' && payload && payload.capturas) {
          live[index].capturas = MesaCaptureTally.apply(live[index].capturas, payload.capturas, live[index].nick, Date.now());
          if (typeof paintStandby === 'function') paintStandby();
        }
        if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.ingest(index, payload);
      }
    });
    webviews[index] = webview;
  }
  clearOpenLater(index);
  const wait = delay ? index * 3000 : 0;
  openLater[index] = setTimeout(() => {
    openLater[index] = null;
    openBay(index);
  }, wait);
}

function openGameBay(index) {
  cfg.bays[index].open = true;
  live[index].phase = 'fila';
  live[index].error = '';
  save();
  ensureGame(index, false);
  paint();
}

function closeGameBay(index) {
  cfg.bays[index].open = false;
  releaseGame(index);
  live[index].phase = 'fechada';
  save();
  paint();
}

function attachGames() {
  if (attachGames.started) return;
  attachGames.started = true;
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    if (cfg.bays[index].open !== false) ensureGame(index, true);
  }
  setInterval(async () => {
    if (!window.mesa || typeof window.mesa.metrics !== 'function') return;
    let usage;
    try { usage = await window.mesa.metrics(); } catch { return; }
    if (!Array.isArray(usage)) return;
    usage.forEach((mb, index) => {
      if (!live[index] || !cfg.bays[index]) return;
      live[index].ram = cfg.bays[index].open === false || cfg.bays[index].placed === false ? null : mb;
    });
    for (let index = 0; index < MESA_CATALOG.bays; index += 1) paintBay(index);
  }, 5000);
}

document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea')) return;
  if (event.key >= '1' && event.key <= '4') select(Number(event.key) - 1);
});

function showGameLoginHint(message) {
  if (!ui.googleLoginHint) return;
  if (!message) {
    ui.googleLoginHint.hidden = true;
    ui.googleLoginHint.textContent = '';
    return;
  }
  ui.googleLoginHint.hidden = false;
  ui.googleLoginHint.textContent = message;
}

async function onGameLoginOpen(index) {
  if (!window.mesa || typeof window.mesa.gameLoginOpen !== 'function') return;
  showGameLoginHint('');
  let result;
  try { result = await window.mesa.gameLoginOpen(index); } catch { result = null; }
  if (result && result.ok) return;
  if (result && result.error === 'no-browser') {
    showGameLoginHint('Instale o Microsoft Edge ou o Google Chrome para entrar com o Google.');
    return;
  }
  showGameLoginHint('Não foi possível abrir o navegador. Tente de novo.');
}

function refreshBayAfterLoginImport(index) {
  showGameLoginHint('');
  const bay = live[index];
  if (!bay) return;
  bay.phase = cfg.bays[index].open === false ? 'fechada' : 'abrindo';
  bay.ready = false;
  paintBay(index);
}

function showGameLoginImportError(result) {
  if (!result) {
    showGameLoginHint('Não foi possível importar o login. Tente de novo.');
    return;
  }
  if (result.reason === 'browser-open') {
    showGameLoginHint('Feche a janela do navegador de login antes de clicar em «Já entrei».');
    return;
  }
  if (result.message) {
    showGameLoginHint(result.message);
    return;
  }
  if (result.reason === 'pending') {
    showGameLoginHint('O login no navegador ainda não terminou. Entre no jogo e tente de novo.');
    return;
  }
  if (result.reason === 'no-browser') {
    showGameLoginHint('Instale o Microsoft Edge ou o Google Chrome para importar o login.');
    return;
  }
  showGameLoginHint('Não foi possível importar o login. Tente de novo.');
}

async function onGameLoginImport(index) {
  if (!window.mesa || typeof window.mesa.gameLoginImport !== 'function') return;
  showGameLoginHint('');
  let result;
  try { result = await window.mesa.gameLoginImport(index); } catch { result = null; }
  if (result && result.ok) {
    refreshBayAfterLoginImport(index);
    return;
  }
  showGameLoginImportError(result);
}

async function forgetBay(index) {
  if (!window.mesa || typeof window.mesa.resetBay !== 'function') return;
  let ok = false;
  try { ok = await window.mesa.resetBay(index); } catch { ok = false; }
  if (!ok) return;
  const bay = live[index];
  bay.painted = false;
  bay.loggedIn = false;
  bay.nick = '';
  bay.level = '';
  bay.gold = '';
  bay.auto = {};
  bay.samples = [];
  bay.gained = 0;
  bay.lastXp = null;
  bay.rate = null;
  bay.market = null;
  bay.potionAt = null;
  bay.ready = false;
  bay.error = '';
  bay.phase = cfg.bays[index].open === false ? 'fechada' : 'abrindo';
  bay.applied = {};
  if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.clear(index);
  const webview = webviews[index];
  if (cfg.bays[index].open === false) {
    paintBay(index);
    paintSummary();
    return;
  }
  if (webview && webview.isConnected && typeof webview.loadURL === 'function') {
    try { await webview.loadURL(MESA_CATALOG.gameUrl); } catch { try { webview.reload(); } catch { /* a baía ainda está abrindo */ } }
  } else {
    openBay(index);
  }
  paintBay(index);
  paintSummary();
}

function boot() {
  if (boot.started) return;
  boot.started = true;
  window.addEventListener('beforeunload', () => {
    flushCfgNow();
    flushXpHistoryNow();
  });
  if (!window.mesa) {
    document.documentElement.setAttribute('data-theme', cfg.shellTheme);
    xpHistoryDoc = typeof MesaXpHistory !== 'undefined' ? MesaXpHistory.empty() : { v: 1, bays: [[], [], [], []] };
    const previewBay = cfg.bays[cfg.selected];
    previewBay.muted = true;
    previewBay.eco = true;
    previewBay.ultra = true;
    previewBay.potionAt = 50;
    previewBay.scale = 0.88;
    mount();
    if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.start();
    return;
  }
  window.mesa.loadCfg().then((saved) => {
    if (saved) Object.assign(cfg, MESA_CATALOG.normalize(saved));
    document.documentElement.setAttribute('data-theme', cfg.shellTheme);
    cfgReady = true;
    const historyReady = (typeof window.mesa.loadHistory === 'function'
      ? window.mesa.loadHistory()
      : Promise.resolve(null))
      .then((raw) => {
        xpHistoryDoc = typeof MesaXpHistory !== 'undefined'
          ? MesaXpHistory.normalize(raw)
          : { v: 1, bays: [[], [], [], []] };
      })
      .catch(() => {
        xpHistoryDoc = typeof MesaXpHistory !== 'undefined' ? MesaXpHistory.empty() : { v: 1, bays: [[], [], [], []] };
      });
    return historyReady;
  }).then(() => {
    mount();
    attachGames();
    if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.start();
    tuneBays();
    window.mesa.paths().then((info) => { if (info && info.config) ui.path.textContent = info.config; });
    if (typeof window.mesa.onGameLoginHint === 'function') {
      window.mesa.onGameLoginHint(({ index, message }) => {
        if (index === cfg.selected) showGameLoginHint(message);
      });
    }
    if (typeof window.mesa.onGameLoginResult === 'function') {
      window.mesa.onGameLoginResult((payload) => {
        if (!payload || payload.index !== cfg.selected) return;
        if (payload.ok) refreshBayAfterLoginImport(payload.index);
        else showGameLoginImportError(payload);
      });
    }
  });
}

