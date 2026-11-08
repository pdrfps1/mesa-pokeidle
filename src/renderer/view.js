function leaveBtnClass(armed) {
  return armed ? 'btn btn-sm btn-leave btn-leave-armed w-full' : 'btn btn-sm btn-leave w-full';
}

function syncLeaveBtnClass() {
  if (!ui.leave) return;
  ui.leave.className = leaveBtnClass(ui.leave.dataset.arm === '1');
  ui.leave.dataset.icon = 'bola';
}

function disarmLeave() {
  if (!ui.leave) return;
  ui.leave.dataset.arm = '';
  ui.leave.textContent = 'Sair da conta';
  syncLeaveBtnClass();
  if (ui.leaveCancel) ui.leaveCancel.hidden = true;
}

function syncLeave() {
  if (!ui.leave) return;
  const bay = String(cfg.selected);
  if (ui.leave.dataset.bay === bay) return;
  ui.leave.dataset.bay = bay;
  disarmLeave();
  if (typeof showGameLoginHint === 'function') showGameLoginHint('');
}

// Join de botões de disposição (Grade, Fila, Coluna, Livre). Usado em Ajustes e na faixa "Na grade".
function mountLayoutJoin(registry, size) {
  const join = el('div', 'join');
  for (const item of MESA_CATALOG.layouts) {
    const button = el('button', `join-item btn ${size}`, item.label);
    button.type = 'button';
    button.dataset.icon = item.id;
    button.addEventListener('click', () => { cfg.layout = item.id; save(); paint(); });
    registry[item.id] = button;
    join.append(button);
  }
  return join;
}

function settingsCardTitle(text, icons) {
  const title = el('h2', 'settings-card-title');
  title.append(document.createTextNode(text));
  const group = el('span', 'settings-card-icons');
  for (const name of icons) {
    const icon = el('span', 'settings-card-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = mesaIcon(name);
    group.append(icon);
  }
  title.append(group);
  return title;
}

function mountFocusPrefToggle(label, iconName) {
  const node = toggle(label, 'label cursor-pointer gap-2 focus-pref-switch mesa-switch-word');
  const labelNode = node.querySelector('.label-text');
  const icon = el('span', 'focus-pref-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = mesaIcon(iconName);
  labelNode.insertBefore(icon, labelNode.firstChild);
  return node;
}

function mountAutosColumn() {
  const col = el('div', 'op-col op-col-autos');
  ui.colAutos = col;
  col.setAttribute('aria-label', 'Automações');
  const title = el('span', 'op-col-title op-col-title-lg', 'Automações');
  const head = el('div', 'op-col-head');
  const foldBtn = el('button', 'op-col-fold btn btn-sm btn-ghost');
  foldBtn.type = 'button';
  const body = el('div', 'op-col-body');
  body.id = 'op-col-autos-body';
  foldBtn.setAttribute('aria-controls', body.id);
  head.append(title, foldBtn);
  ui.colBodies = ui.colBodies || {};
  ui.colFoldBtns = ui.colFoldBtns || {};
  ui.colBodies.autos = body;
  ui.colFoldBtns.autos = foldBtn;
  const rows = el('div', 'auto-rows');
  ui.autos = {};
  for (const auto of MESA_CATALOG.autos) {
    const row = el('div', 'auto-row');
    const left = el('div', 'auto-row-label');
    const autoIcon = typeof AUTO_ICON !== 'undefined' ? AUTO_ICON[auto.id] : null;
    if (autoIcon) {
      const icon = el('span', 'auto-row-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = mesaIcon(autoIcon);
      left.append(icon);
    }
    left.append(el('span', 'auto-row-label-text', auto.label));
    if (auto.vip) left.append(el('span', 'auto-vip-seal', 'VIP'));
    if (auto.id === 'auto-voltar-hunt') row.title = 'Só volta enquanto houver poção ou revive na bolsa.';
    const button = toggle('', 'label cursor-pointer gap-2 justify-end auto-switch auto-switch-row');
    toggleInput(button).setAttribute('aria-label', auto.vip ? `${auto.label} (VIP)` : auto.label);
    toggleInput(button).addEventListener('change', () => {
      applyAuto(cfg.selected, auto.id, toggleInput(button).checked);
      save();
      paint();
    });
    ui.autos[auto.id] = button;
    row.append(left, button);
    rows.append(row);
  }
  ui.autoHunt = toggle('', 'label cursor-pointer gap-2 justify-end auto-switch auto-switch-row');
  ui.autoHunt.title = 'Troca o mapa desta conta quando outra hunt rende mais XP de treinador.';
  toggleInput(ui.autoHunt).setAttribute('aria-label', 'Mapa automático');
  toggleInput(ui.autoHunt).addEventListener('change', () => {
    if (typeof applyAutoHunt === 'function') applyAutoHunt(cfg.selected, toggleInput(ui.autoHunt).checked);
    save();
    paint();
  });
  const autoHuntRow = el('div', 'auto-row auto-row-hunt');
  const autoHuntLeft = el('div', 'auto-row-label');
  const autoHuntIcon = el('span', 'auto-row-icon');
  autoHuntIcon.setAttribute('aria-hidden', 'true');
  autoHuntIcon.innerHTML = mesaIcon('automatico');
  autoHuntLeft.append(autoHuntIcon, el('span', 'auto-row-label-text', 'Mapa automático'));
  autoHuntRow.append(autoHuntLeft, ui.autoHunt);
  rows.append(autoHuntRow);
  const limiar = el('div', 'limiar limiar-block');
  limiar.append(el('span', null, 'Usar poção abaixo de'));
  ui.potion = el('input', 'range range-xs range-accent limiar-range');
  ui.potion.type = 'range';
  ui.potion.min = '10';
  ui.potion.max = '100';
  ui.potion.step = '10';
  ui.potion.value = '10';
  ui.potion.disabled = true;
  ui.potion.setAttribute('aria-label', 'Usar poção abaixo de');
  ui.potionPct = el('b', 'num', '\u2013');
  ui.potion.addEventListener('input', () => {
    ui.potionPct.textContent = `${ui.potion.value}%`;
    syncRangeFill(ui.potion);
  });
  ui.potion.addEventListener('change', () => {
    applyPotion(cfg.selected, ui.potion.value);
    save();
    paint();
  });
  limiar.append(ui.potion, ui.potionPct);
  ui.autoHuntStatus = el('p', 'auto-hunt-status', 'Mapa automático desligado.');
  ui.autoHuntStatus.setAttribute('aria-live', 'polite');
  body.append(rows, limiar);
  col.append(head, body);
  return col;
}

function setOpTab(key) {
  if (!ui.opGrid || !ui.opTabBtns) return;
  ui.opGrid.dataset.tab = key;
  for (const [name, tab] of Object.entries(ui.opTabBtns)) {
    const on = name === key;
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
    tab.tabIndex = on ? 0 : -1;
  }
  syncOpTabInk();
}

function pickOpTab(key) {
  const again = !!ui.opGrid && ui.opGrid.dataset.tab === key;
  setOpTab(key);
  // Abaixo de 1100px a aba abre a folha; clicar de novo na aba ativa fecha.
  if (typeof opSheetNarrow === 'function' && opSheetNarrow()) {
    opSheetSet(!(again && ui.opNarrowOpen === true));
    return;
  }
  if (cfg.chrome && cfg.chrome.opExpanded === false && typeof shellFoldToggleOp === 'function') shellFoldToggleOp();
}

function syncOpTabInk() {
  if (!ui.opTabInk || !ui.opGrid || !ui.opTabBtns) return;
  const tab = ui.opTabBtns[ui.opGrid.dataset.tab];
  if (!tab || !tab.offsetWidth) return;
  const x = `${tab.offsetLeft}px`;
  const w = String(tab.offsetWidth);
  if (ui.opTabInk.style.getPropertyValue('--ink-x') === x && ui.opTabInk.style.getPropertyValue('--ink-w') === w) return;
  ui.opTabInk.style.setProperty('--ink-x', x);
  ui.opTabInk.style.setProperty('--ink-w', w);
}

function mount() {
  if (mount.done) return;
  const root = document.getElementById('app');
  root.replaceChildren();
  const dock = el('nav', 'dock');
  ui.dock = dock;
  dock.setAttribute('aria-label', 'Navegação principal');
  ui.mesaBtn = el('button');
  ui.mesaBtn.type = 'button';
  ui.mesaBtn.setAttribute('aria-label', 'Automações');
  ui.mesaBtn.title = 'Automações';
  ui.mesaBtn.innerHTML = mesaIcon('dock-auto');
  ui.mesaBtn.append(el('span', 'dock-label', 'Automações'));
  ui.mesaBtn.addEventListener('click', () => { cfg.view = 'mesa'; paint(); tuneBays(); });
  ui.esperaBtn = el('button');
  ui.esperaBtn.type = 'button';
  ui.esperaBtn.setAttribute('aria-label', 'Espera');
  ui.esperaBtn.title = 'Espera';
  ui.esperaBtn.innerHTML = mesaIcon('espera');
  ui.esperaBtn.append(el('span', 'dock-label', 'Espera'));
  ui.esperaBtn.addEventListener('click', () => { cfg.view = 'espera'; paint(); tuneBays(); });
  ui.ajustesBtn = el('button');
  ui.ajustesBtn.type = 'button';
  ui.ajustesBtn.setAttribute('aria-label', 'Configurações');
  ui.ajustesBtn.title = 'Configurações';
  ui.ajustesBtn.innerHTML = mesaIcon('ajustes');
  ui.ajustesBtn.append(el('span', 'dock-label', 'Configurações'));
  ui.ajustesBtn.addEventListener('click', () => { cfg.view = 'ajustes'; paint(); tuneBays(); });
  const tray = el('div', 'dock-tray');
  ui.dockPlate = el('span', 'dock-plate');
  ui.dockPlate.setAttribute('aria-hidden', 'true');
  tray.append(ui.dockPlate, ui.esperaBtn, ui.mesaBtn, ui.ajustesBtn);
  dock.append(tray);

  const canvas = el('main', 'canvas');
  ui.pageTitle = el('h1', 'page-title', 'Automações');
  ui.pageScope = el('p', 'page-scope', 'Neste computador');
  const pageHead = el('header', 'page-head');
  const brandMark = document.createElement('img');
  brandMark.className = 'brand-mark';
  brandMark.src = '../assets/brand/logo-64.png';
  brandMark.width = 28;
  brandMark.height = 28;
  brandMark.alt = AppBrand.productName;
  brandMark.title = AppBrand.productName;
  brandMark.decoding = 'async';
  pageHead.append(brandMark, ui.pageTitle, ui.pageScope);
  ui.finding = el('p', 'finding mesa-finding');
  ui.finding.hidden = true;
  ui.finding.setAttribute('aria-live', 'polite');

  const kpiIcons = { cacando: 'kpi-caca', medindo: 'kpi-med', paradas: 'kpi-parada', sem: 'kpi-sem' };
  ui.kpiRow = el('section', 'kpi-row');
  ui.kpiRow.setAttribute('aria-label', 'Estado das baías');
  const cells = [
    ['Caçando', 'cacando'],
    ['Medindo', 'medindo'],
    ['Paradas', 'paradas'],
    ['Sem sessão', 'sem'],
  ];
  for (const [label, key] of cells) {
    const card = el('article', 'kpi-card card card-border mesa-panel');
    card.dataset.kpi = key;
    const body = el('div', 'kpi-body');
    const value = el('div', 'kpi-value num', '0');
    const icon = el('div', 'kpi-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = mesaKpiIcon(kpiIcons[key]);
    body.append(value, icon);
    card.append(el('div', 'kpi-label', label), body);
    ui[key] = value;
    ui.kpiRow.append(card);
  }
  pageHead.insertBefore(ui.kpiRow, ui.pageScope);
  pageHead.insertBefore(ui.finding, ui.pageScope);

  ui.mute = mountFocusPrefToggle('Mudo', 'mudo');
  ui.eco = mountFocusPrefToggle('Economia', 'economia');
  ui.ultra = mountFocusPrefToggle('Ultra', 'ultra');
  const ultraDesc = 'Esconde o jogo e deixa só os números da sessão';
  ui.ultra.title = ultraDesc;
  ui.ultra.setAttribute('aria-description', ultraDesc);
  function commitFocusMute() {
    cfg.bays[cfg.selected].muted = toggleInput(ui.mute).checked;
    save();
    applyBayAudioMute(cfg.selected);
    pushPrefs();
    paint();
  }
  toggleInput(ui.mute).addEventListener('change', commitFocusMute);
  toggleInput(ui.eco).addEventListener('change', () => {
    cfg.bays[cfg.selected].eco = toggleInput(ui.eco).checked;
    save();
    pushPrefs();
    paint();
  });
  toggleInput(ui.ultra).addEventListener('change', () => {
    cfg.bays[cfg.selected].ultra = toggleInput(ui.ultra).checked;
    save();
    pushPrefs();
    paint();
  });
  const reload = el('button', 'btn btn-sm btn-soft', 'Recarregar');
  reload.type = 'button';
  reload.dataset.icon = 'recarregar';
  reload.addEventListener('click', async () => {
    const webview = webviews[cfg.selected];
    if (!webview) return;
    await save();
    if (!webview.isConnected) {
      openBay(cfg.selected);
      return;
    }
    live[cfg.selected].error = '';
    live[cfg.selected].phase = 'abrindo';
    live[cfg.selected].painted = false;
    paintBay(cfg.selected);
    webview.reload();
  });
  ui.igualar = el('button', 'btn btn-sm btn-soft', 'Igualar as quatro');
  ui.igualar.type = 'button';
  ui.igualar.dataset.icon = 'igualar';
  ui.igualar.addEventListener('click', () => {
    const potion = potionShown(cfg.selected);
    const scale = cfg.bays[cfg.selected].scale;
    for (const auto of MESA_CATALOG.autos) {
      const want = autoOn(cfg.selected, auto.id);
      for (let index = 0; index < MESA_CATALOG.bays; index += 1) applyAuto(index, auto.id, want);
    }
    if (potion != null) {
      for (let index = 0; index < MESA_CATALOG.bays; index += 1) applyPotion(index, potion);
    }
    for (let index = 0; index < MESA_CATALOG.bays; index += 1) cfg.bays[index].scale = scale;
    if (typeof applyAutoHunt === 'function') {
      const autoHunt = cfg.bays[cfg.selected].autoHunt === true;
      for (let index = 0; index < MESA_CATALOG.bays; index += 1) applyAutoHunt(index, autoHunt);
    }
    save();
    paint();
  });
  ui.scale = el('input', 'range range-xs range-accent limiar-range');
  ui.scale.type = 'range';
  ui.scale.min = '50';
  ui.scale.max = '150';
  ui.scale.step = '1';
  ui.scale.value = '100';
  ui.scale.setAttribute('aria-label', 'Escala da baía em foco');
  ui.scalePct = el('b', 'num', 'Automático');
  ui.scaleAuto = el('button', 'btn btn-sm btn-ghost', 'Automático');
  ui.scaleAuto.type = 'button';
  ui.scaleAuto.dataset.icon = 'automatico';
  ui.scaleAuto.title = 'Voltar ao tamanho automático';
  ui.scale.addEventListener('input', () => {
    const factor = MESA_CATALOG.normalize({ bays: [{ scale: Number(ui.scale.value) / 100 }] }).bays[0].scale;
    cfg.bays[cfg.selected].scale = factor;
    ui.scalePct.textContent = factor == null ? 'Automático' : `${Math.round(factor * 100)}%`;
    ui.scaleAuto.classList.remove('btn-active');
    ui.scaleAuto.setAttribute('aria-pressed', 'false');
    syncRangeFill(ui.scale);
    if (typeof applyBayZoom === 'function') applyBayZoom(cfg.selected);
  });
  ui.scale.addEventListener('change', () => save());
  ui.scaleAuto.addEventListener('click', () => {
    cfg.bays[cfg.selected].scale = null;
    save();
    paint();
  });
  const scaleBox = el('div', 'limiar limiar-block');
  scaleBox.append(el('span', null, 'Escala do jogo'), ui.scale, ui.scalePct, ui.scaleAuto);
  ui.leave = el('button', leaveBtnClass(false), 'Sair da conta');
  ui.leave.type = 'button';
  ui.leave.dataset.icon = 'bola';
  ui.leave.title = 'Apaga a sessão desta baía e volta ao login';
  ui.leave.setAttribute('aria-label', 'Sair da conta desta baía');
  ui.leaveCancel = el('button', 'btn btn-sm btn-ghost', 'Cancelar');
  ui.leaveCancel.type = 'button';
  ui.leaveCancel.dataset.icon = 'cancelar';
  ui.leaveCancel.hidden = true;
  let leaveArmedAt = 0;
  ui.leave.addEventListener('click', () => {
    if (ui.leave.dataset.arm !== '1') {
      ui.leave.dataset.arm = '1';
      leaveArmedAt = Date.now();
      ui.leave.textContent = 'Confirmar saída';
      syncLeaveBtnClass();
      ui.leaveCancel.hidden = false;
      return;
    }
    if (Date.now() - leaveArmedAt < 400) return;
    disarmLeave();
    if (typeof forgetBay === 'function') forgetBay(cfg.selected);
  });
  ui.leaveCancel.addEventListener('click', () => disarmLeave());
  ui.googleLogin = el('button', 'btn btn-sm btn-google w-full', 'Entrar com Google');
  ui.googleLogin.type = 'button';
  ui.googleLogin.title = 'Abre o Edge ou o Chrome só desta baía para entrar no jogo';
  ui.googleLogin.setAttribute('aria-label', 'Entrar com Google nesta baía');
  ui.googleImport = el('button', 'btn btn-sm btn-ja-entrou w-full', 'Já entrei');
  ui.googleImport.type = 'button';
  ui.googleImport.title = 'Copia o login do navegador para esta baía';
  ui.googleImport.setAttribute('aria-label', 'Importar login do navegador');
  ui.googleLoginHint = el('p', 'login-browser-hint', '');
  ui.googleLoginHint.hidden = true;
  ui.googleLoginHint.setAttribute('aria-live', 'polite');
  ui.googleLogin.addEventListener('click', () => {
    if (typeof onGameLoginOpen === 'function') onGameLoginOpen(cfg.selected);
  });
  ui.googleImport.addEventListener('click', () => {
    if (typeof onGameLoginImport === 'function') onGameLoginImport(cfg.selected);
  });

  const colAutos = mountAutosColumn();

  const colFocus = el('div', 'op-col op-col-focus');
  ui.colFocus = colFocus;
  colFocus.setAttribute('aria-label', 'Baía em foco');
  ui.focusBayTitle = el('span', 'op-col-title op-col-title-bay', 'Baía 1');
  const focusHead = el('div', 'op-col-head');
  ui.colFoldBtns.focus = el('button', 'op-col-fold btn btn-sm btn-ghost');
  ui.colFoldBtns.focus.type = 'button';
  ui.colBodies.focus = el('div', 'op-col-body');
  ui.colBodies.focus.id = 'op-col-focus-body';
  ui.colFoldBtns.focus.setAttribute('aria-controls', ui.colBodies.focus.id);
  focusHead.append(ui.focusBayTitle, ui.colFoldBtns.focus);
  ui.gameNav = el('div', 'game-nav');
  const navIcon = { Mapa: 'mapa', 'Pokédex': 'pokedex', Depot: 'depot', Boss: 'boss', Market: 'market' };
  for (const label of MESA_CATALOG.nav) {
    const button = el('button', 'join-item btn btn-sm game-nav-btn', label);
    button.type = 'button';
    if (navIcon[label]) button.dataset.icon = navIcon[label];
    button.addEventListener('click', () => {
      const webview = webviews[cfg.selected];
      if (webview && live[cfg.selected].ready) webview.send('click-label', label);
    });
    ui.gameNav.append(button);
  }
  const navBar = el('div', 'game-nav-bar');
  navBar.append(ui.gameNav);
  const prefGrid = el('div', 'focus-prefs');
  for (const node of [ui.mute, ui.eco, ui.ultra]) {
    const cell = el('div', 'focus-pref-cell');
    cell.append(node);
    prefGrid.append(cell);
  }
  colFocus.append(focusHead, ui.colBodies.focus);
  ui.colBodies.focus.append(navBar, prefGrid, mountBaySizeControls());

  const colAccount = el('div', 'op-col op-col-account');
  ui.colAccount = colAccount;
  colAccount.setAttribute('aria-label', 'Conta');
  const accountHead = el('div', 'op-col-head');
  ui.colFoldBtns.account = el('button', 'op-col-fold btn btn-sm btn-ghost');
  ui.colFoldBtns.account.type = 'button';
  ui.colBodies.account = el('div', 'op-col-body');
  ui.colBodies.account.id = 'op-col-account-body';
  ui.colFoldBtns.account.setAttribute('aria-controls', ui.colBodies.account.id);
  accountHead.append(ui.colFoldBtns.account);
  const accountMain = el('div', 'account-actions');
  const accountFootActions = el('div', 'account-foot-actions');
  accountFootActions.append(reload, ui.igualar);
  accountMain.append(
    ui.googleLogin,
    ui.googleImport,
    ui.googleLoginHint,
    ui.leave,
    ui.leaveCancel,
    accountFootActions
  );
  ui.colBodies.autos.append(scaleBox, ui.autoHuntStatus);
  ui.colBodies.account.append(accountMain);
  colAccount.append(accountHead, ui.colBodies.account);

  const colGrid = el('div', 'op-col op-col-grid');
  ui.colGrid = colGrid;
  colGrid.setAttribute('aria-label', 'Grade e disposição');
  if (typeof mountBayPlacedBar === 'function') mountBayPlacedBar(colGrid);

  ui.opGrid = el('div', 'op-grid');
  ui.opGrid.id = 'op-grid';
  ui.opGrid.append(colAutos, colFocus, colAccount, colGrid);
  // Uma seção por vez, escolhida nas quatro abas do topo.
  ui.opTabs = el('div', 'op-tabs');
  ui.opTabs.setAttribute('role', 'tablist');
  ui.opTabs.setAttribute('aria-label', 'Seções da operação');
  ui.opTabBtns = {};
  const opTabDefs = [
    ['autos', 'Automações', 'Automações'],
    ['focus', 'Baía 1', null],
    ['account', 'Conta', 'Conta'],
    ['grid', 'Grade', 'Grade e disposição'],
  ];
  for (const [key, label, aria] of opTabDefs) {
    const tab = el('button', 'op-tab', label);
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'op-grid');
    tab.dataset.tab = key;
    if (aria) tab.setAttribute('aria-label', aria);
    tab.addEventListener('click', () => pickOpTab(key));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const keys = opTabDefs.map((def) => def[0]);
      const step = event.key === 'ArrowRight' ? 1 : -1;
      const next = keys[(keys.indexOf(key) + step + keys.length) % keys.length];
      pickOpTab(next);
      ui.opTabBtns[next].focus();
    });
    ui.opTabBtns[key] = tab;
    ui.opTabs.append(tab);
  }
  ui.opTabFocus = ui.opTabBtns.focus;
  ui.opTabInk = el('span', 'op-tab-ink');
  ui.opTabInk.setAttribute('aria-hidden', 'true');
  ui.opTabs.append(ui.opTabInk);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => syncOpTabInk()).observe(ui.opTabs);
  setOpTab('autos');
  ui.opFoldBtn = el('button', 'op-fold btn btn-sm btn-ghost');
  ui.opFoldBtn.type = 'button';
  ui.opFoldBtn.setAttribute('aria-controls', 'op-grid');
  ui.opHead = el('div', 'op-head');
  ui.opHead.append(ui.opTabs, ui.opFoldBtn);
  ui.opCard = el('div', 'op-card toolbar card card-border mesa-panel');
  // Seção do console num invólucro: folha sobre as baías abaixo de 1100px; display: contents a partir de 1100px.
  ui.opSheet = el('div', 'op-sheet');
  ui.opSheet.append(ui.opGrid);
  ui.opCard.append(ui.opHead, ui.opSheet);
  ui.toolbar = ui.opCard;
  if (typeof mountAway === 'function') mountAway(ui.opSheet);

  ui.mesaView = el('section', 'view workspace');
  ui.baysPane = el('div', 'bays-pane');
  ui.baysBox = el('div', 'bays');
  ui.baysWrap = el('div', 'bays-wrap');
  ui.baysWrap.append(ui.baysBox);
  ui.bays = [];
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const card = el('article', 'bay card card-border mesa-panel');
    const top = el('div', 'bay-top');
    const name = el('span', 'bay-name', `Baía ${index + 1}`);
    const huntHint = el('span', 'bay-hunt', '');
    huntHint.hidden = true;
    const status = el('span', 'badge badge-sm badge-ghost bay-status', 'sem sessão');
    const stats = el('div', 'bay-stats');
    const level = el('b', 'num', '\u2013');
    const xp = el('b', 'num', '\u2013');
    const gold = el('b', 'num', '\u2013');
    const ram = el('b', 'num', '\u2013');
    for (const [label, node] of [['Nv', level], ['XP/h', xp], ['Ouro', gold], ['RAM', ram]]) {
      const stat = el('span', 'bay-stat');
      const statIcons = { Nv: 'nivel', 'XP/h': 'estrela-xp', Ouro: 'moeda', RAM: 'ram' };
      const k = el('span', 'k');
      if (statIcons[label]) {
        const icon = el('span', 'stat-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = mesaIcon(statIcons[label]);
        k.append(icon, document.createTextNode(label));
      } else {
        k.textContent = label;
      }
      stat.append(k, node);
      stats.append(stat);
    }
    const rename = el('button', 'btn btn-sm btn-soft', 'Renomear');
    rename.type = 'button';
    rename.dataset.icon = 'renomear';
    const openBtn = el('button', 'btn btn-sm btn-primary', 'Abrir');
    const closeBtn = el('button', 'btn btn-sm btn-soft', 'Fechar');
    openBtn.dataset.icon = 'abrir';
    closeBtn.dataset.icon = 'fechar';
    rename.title = 'Renomear esta baía';
    openBtn.title = 'Abrir o jogo nesta baía';
    closeBtn.title = 'Fechar o jogo desta baía. O login fica guardado.';
    const awayBtn = typeof bayAwayButton === 'function' ? bayAwayButton(index) : el('button', 'btn btn-sm btn-outline', 'Tirar');
    openBtn.type = 'button';
    closeBtn.type = 'button';
    openBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (typeof openGameBay === 'function') openGameBay(index);
    });
    closeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (typeof closeGameBay === 'function') closeGameBay(index);
    });
    rename.addEventListener('click', (event) => {
      event.stopPropagation();
      live[index].editing = true;
      const input = el('input', 'input input-sm rename');
      input.value = titleOf(index);
      input.setAttribute('aria-label', `Nome da baía ${index + 1}`);
      name.replaceWith(input);
      input.focus();
      input.select();
      const commit = (cancel) => {
        if (!live[index].editing) return;
        live[index].editing = false;
        const next = input.value.trim().slice(0, 32);
        if (!cancel && next) {
          cfg.bays[index].name = next;
          cfg.bays[index].renamed = next !== `Baía ${index + 1}`;
          save();
        }
        if (input.isConnected) input.replaceWith(name);
        paintBay(index);
      };
      input.addEventListener('keydown', (key) => {
        if (key.key === 'Enter') commit(false);
        if (key.key === 'Escape') commit(true);
      });
      input.addEventListener('blur', () => commit(false));
    });
    const titleRow = el('div', 'bay-title-row');
    titleRow.append(name, status);
    const actions = el('div', 'bay-actions');
    actions.append(closeBtn, awayBtn, rename, openBtn);
    const head = el('div', 'bay-head');
    head.append(titleRow, actions);
    top.append(head, huntHint, stats);
    top.tabIndex = 0;
    top.addEventListener('click', () => select(index));
    top.addEventListener('keydown', (event) => {
      if (event.target !== top) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      select(index);
    });
    const stage = el('div', 'bay-stage');
    const empty = el('p', 'bay-empty', 'Aguardando a vez nesta abertura.');
    stage.append(empty);
    card.append(top, stage, mountBayGrip(index));
    ui.bays.push({ root: card, name, huntHint, status, level, xp, gold, ram, stage, empty, rename, openBtn, closeBtn, awayBtn });
    ui.baysBox.append(card);
  }
  const toolbar = ui.opCard;
  ui.baysPane.append(toolbar, ui.baysWrap);
  ui.mesaView.append(ui.baysPane);

  ui.ajustesView = el('section', 'view settings');
  ui.ajustesTitle = el('h1', 'settings-page-title', 'Configurações');
  ui.ajustesGrid = el('div', 'settings-grid');
  ui.night = toggle('Modo noturno', 'label cursor-pointer gap-2 justify-end settings-switch');
  ui.otimizado = toggle('Modo otimizado', 'label cursor-pointer gap-2 justify-end settings-switch');
  ui.trackers = toggle('Rastreadores', 'label cursor-pointer gap-2 justify-end settings-switch');
  ui.layouts = {};
  const layoutJoin = mountLayoutJoin(ui.layouts, 'btn-sm');
  ui.shellMesa = el('button', 'join-item btn btn-sm', 'Escuro');
  ui.shellClaro = el('button', 'join-item btn btn-sm', 'Claro');
  ui.shellMesa.type = 'button';
  ui.shellClaro.type = 'button';
  ui.shellMesa.addEventListener('click', () => { applyShellTheme('mesa'); paint(); });
  ui.shellClaro.addEventListener('click', () => { applyShellTheme('mesa-claro'); paint(); });
  const shellJoin = el('div', 'join');
  shellJoin.append(ui.shellMesa, ui.shellClaro);
  function settingsField(title, copy, control) {
    const field = el('div', 'settings-field');
    const text = el('div', 'settings-field-text');
    text.append(el('strong', null, title));
    if (copy) text.append(el('p', null, copy));
    field.append(text, control);
    return field;
  }
  toggleInput(ui.night).addEventListener('change', () => {
    cfg.night = toggleInput(ui.night).checked;
    save();
    pushPrefs();
    paint();
  });
  toggleInput(ui.otimizado).addEventListener('change', () => {
    cfg.otimizado = toggleInput(ui.otimizado).checked;
    save();
    pushPrefs();
    paint();
  });
  toggleInput(ui.trackers).addEventListener('change', () => {
    cfg.trackers = toggleInput(ui.trackers).checked;
    save();
    paint();
  });

  const cardAppearance = el('article', 'settings-card settings-card-appearance card card-border mesa-panel');
  cardAppearance.append(
    settingsCardTitle('Preferências de Aparência', ['sol', 'nuvem', 'lua']),
    settingsField('Tema', 'Tema escuro ou claro da casca do app. Não muda o modo noturno do jogo.', shellJoin),
    settingsField('Modo noturno', 'O tema escuro que o jogo já oferece.', ui.night),
  );

  const cardLayout = el('article', 'settings-card settings-card-layout card card-border mesa-panel');
  cardLayout.append(
    settingsCardTitle('Visualização e Layout', ['grade']),
    settingsField('Disposição', 'Grade, fila, coluna ou livre. Livre dá a cada baía o próprio tamanho. Tirar tira a baía da grade; em Fora da grade ela volta, com o login guardado.', layoutJoin),
    settingsField('Modo otimizado', 'Menos animação na luta, ajuste do próprio jogo.', ui.otimizado),
  );

  ui.featuresCard = el('article', 'settings-card settings-card-features card card-border mesa-panel');
  ui.featuresCard.append(settingsCardTitle('Funcionalidades', ['engrenagem']));
  ui.featuresCard.append(settingsField('Rastreadores', 'Corta anúncio e analytics da página. Vale na próxima abertura.', ui.trackers));

  const cardComputer = el('article', 'settings-card settings-card-computer card card-border mesa-panel');
  cardComputer.append(settingsCardTitle('Este computador', ['mesa']));
  ui.path = el('p', 'path', 'Disponível no aplicativo.');
  const computerCopy = el('p', null, 'O login fica na sessão de cada baía. A senha fica na página do jogo. São quatro baías, o teto de contas. Os interruptores apertam os controles que o jogo já mostra.');
  cardComputer.append(computerCopy, ui.path);

  ui.ajustesGrid.append(cardAppearance, ui.featuresCard, cardLayout, cardComputer);
  ui.ajustesView.append(ui.ajustesTitle, ui.ajustesGrid);
  if (typeof mountPerf === 'function') mountPerf(ui.ajustesView);
  if (typeof mountLiveBonus === 'function') mountLiveBonus(ui.ajustesView);
  if (typeof mountExtras === 'function') mountExtras(ui.featuresCard);
  if (typeof mountUpdates === 'function') mountUpdates(ui.featuresCard);

  ui.esperaView = el('section', 'view standby');
  if (typeof mountStandby === 'function') mountStandby(ui.esperaView);

  canvas.append(pageHead, ui.mesaView, ui.esperaView, ui.ajustesView);
  if (typeof watchBayFrames === 'function') watchBayFrames();
  root.append(canvas, dock);
  if (typeof mountShellFold === 'function') mountShellFold();
  paint();
  mount.done = true;
}

boot();
