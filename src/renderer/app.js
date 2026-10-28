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
}));
var webviews = [];
var ui = {};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function toggle(label, className) {
  const node = el('button', className || 'switch');
  node.type = 'button';
  node.setAttribute('role', 'switch');
  node.setAttribute('aria-checked', 'false');
  const track = el('span', 'switch-track');
  track.setAttribute('aria-hidden', 'true');
  track.append(el('span', 'switch-thumb'));
  node.append(track, el('span', 'switch-label', label));
  return node;
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
      'cfg-som': cfg.bays[index].muted ? '0' : '1',
    });
  });
}

function tuneBays() {
  if (window.mesa && window.mesa.tune) window.mesa.tune(cfg.selected, cfg.view !== 'ajustes' && cfg.view !== 'espera');
}

function setChecked(node, on) {
  node.setAttribute('aria-checked', on ? 'true' : 'false');
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
  ui.cacando.textContent = String(counts.cacando);
  ui.medindo.textContent = String(counts.medindo);
  ui.paradas.textContent = String(counts.paradas);
  ui.sem.textContent = String(counts.sem);
  ui.paradas.classList.toggle('is-alert', counts.paradas > 0);
  const sentence = MesaStatus.finding(counts, rates);
  ui.finding.replaceChildren();
  if (counts.paradas > 0) {
    const noun = counts.paradas === 1 ? '1 baía parada' : `${counts.paradas} baías paradas`;
    ui.finding.append(el('em', null, noun), document.createTextNode(sentence.slice(noun.length)));
  } else {
    ui.finding.textContent = sentence;
  }
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
  bay.root.classList.toggle('is-selected', cfg.selected === index);
  if (!live[index].editing) bay.name.textContent = titleOf(index);
  if (bay.huntHint) {
    const hint = typeof MesaAutoHunt !== 'undefined' && MesaAutoHunt.line ? MesaAutoHunt.line(index) : '';
    bay.huntHint.hidden = !hint;
    bay.huntHint.textContent = hint;
  }
  bay.status.textContent = status.word;
  bay.status.dataset.tone = status.tone;
  bay.status.classList.toggle('is-alert', status.alert);
  const xp = MesaStatus.fmtXp(live[index].loggedIn ? live[index].rate : null);
  bay.xp.textContent = xp.text;
  bay.level.textContent = live[index].loggedIn && live[index].level ? live[index].level : '\u2013';
  bay.gold.textContent = live[index].loggedIn && live[index].gold ? live[index].gold : '\u2013';
  bay.ram.textContent = live[index].ram == null ? '\u2013' : `${live[index].ram} MB`;
  bay.rename.hidden = cfg.selected !== index;
  const hint = bay.huntHint && !bay.huntHint.hidden ? bay.huntHint.textContent : '';
  bay.root.setAttribute('aria-label', `Baía ${index + 1}, ${titleOf(index)}, ${status.word}${hint ? `, ${hint}` : ''}`);
  const closed = cfg.bays[index].open === false;
  if (bay.openBtn) bay.openBtn.hidden = !closed;
  if (bay.closeBtn) bay.closeBtn.hidden = closed;
  if (closed) {
    bay.stage.classList.add('is-empty');
    bay.empty.hidden = false;
    bay.empty.textContent = 'Baía fechada. O login continua guardado nesta baía.';
    if (webviews[index]) webviews[index].style.visibility = 'hidden';
    if (typeof paintStandby === 'function') paintStandby();
    return;
  }
  const waiting = live[index].phase !== 'jogo';
  bay.stage.classList.toggle('is-empty', waiting);
  bay.empty.hidden = !waiting;
  if (webviews[index]) webviews[index].style.visibility = waiting ? 'hidden' : 'visible';
  if (live[index].error) bay.empty.textContent = `${live[index].error} Último estado às ${live[index].lastGood || stamp()}.`;
  else if (!window.mesa) bay.empty.textContent = 'O jogo entra neste quadro quando a mesa roda no aplicativo.';
  else if (live[index].phase === 'fila') bay.empty.textContent = 'Aguardando a vez nesta abertura.';
  else bay.empty.textContent = 'Abrindo o jogo. Entre com a conta local.';
  if (typeof paintStandby === 'function') paintStandby();
}

function paint() {
  const view = cfg.view === 'ajustes' || cfg.view === 'espera' ? cfg.view : 'mesa';
  ui.mesaBtn.classList.toggle('is-active', view === 'mesa');
  if (ui.esperaBtn) ui.esperaBtn.classList.toggle('is-active', view === 'espera');
  ui.ajustesBtn.classList.toggle('is-active', view === 'ajustes');
  [ui.mesaBtn, ui.esperaBtn, ui.ajustesBtn].forEach((button) => {
    if (!button) return;
    button.removeAttribute('aria-current');
  });
  const current = view === 'espera' ? ui.esperaBtn : (view === 'ajustes' ? ui.ajustesBtn : ui.mesaBtn);
  if (current) current.setAttribute('aria-current', 'page');
  ui.mesaView.hidden = view !== 'mesa';
  if (ui.esperaView) ui.esperaView.hidden = view !== 'espera';
  ui.ajustesView.hidden = view !== 'ajustes';
  ui.baysBox.dataset.layout = cfg.layout;
  for (const auto of MESA_CATALOG.autos) setChecked(ui.autos[auto.id], autoOn(cfg.selected, auto.id));
  setChecked(ui.mute, cfg.bays[cfg.selected].muted);
  setChecked(ui.eco, cfg.bays[cfg.selected].eco);
  setChecked(ui.night, cfg.night);
  setChecked(ui.otimizado, cfg.otimizado);
  setChecked(ui.trackers, cfg.trackers);
  ui.igualar.disabled = !live[cfg.selected].loggedIn;
  if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.paint();
  for (const item of MESA_CATALOG.layouts) {
    const on = cfg.layout === item.id;
    ui.layouts[item.id].classList.toggle('is-on', on);
    ui.layouts[item.id].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (ui.autosScope) ui.autosScope.textContent = titleOf(cfg.selected);
  paintPotion();
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) paintBay(index);
  paintSummary();
  if (typeof paintExtras === 'function') paintExtras();
  if (typeof paintZoom === 'function') paintZoom();
  if (typeof paintSlots === 'function') paintSlots();
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
  if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.clear(index);
}

function openBay(index) {
  if (cfg.bays[index].open === false || cfg.bays[index].placed === false) return;
  const webview = webviews[index];
  if (!webview || webview.isConnected) return;
  live[index].phase = 'abrindo';
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
      paintBay(index);
    });
    webview.addEventListener('render-process-gone', () => {
      if (webviews[index] !== webview) return;
      live[index].error = 'Esta baía caiu.';
      live[index].phase = 'erro';
      live[index].ready = false;
      paintBay(index);
    });
    webview.addEventListener('ipc-message', (event) => {
      if (webviews[index] !== webview) return;
      if (event.channel === 'state') onState(index, event.args[0]);
      if (event.channel === 'hunt' && typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.ingest(index, event.args[0]);
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
  window.addEventListener('beforeunload', flushCfgNow);
  if (!window.mesa) {
    mount();
    if (typeof MesaAutoHunt !== 'undefined') MesaAutoHunt.start();
    return;
  }
  window.mesa.loadCfg().then((saved) => {
    if (saved) Object.assign(cfg, MESA_CATALOG.normalize(saved));
    cfgReady = true;
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
