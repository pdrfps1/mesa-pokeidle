function disarmLeave() {
  if (!ui.leave) return;
  ui.leave.dataset.arm = '';
  ui.leave.textContent = 'Sair da conta';
  ui.leave.classList.remove('is-armed');
  if (ui.leaveCancel) ui.leaveCancel.hidden = true;
}

function syncLeave() {
  if (!ui.leave) return;
  const bay = String(cfg.selected);
  if (ui.leave.dataset.bay === bay) return;
  ui.leave.dataset.bay = bay;
  disarmLeave();
}

function mountAutos() {
  const panel = el('div', 'controls autos');
  panel.setAttribute('aria-label', 'Automações desta baía');
  ui.autosScope = el('span', 'control-label', 'Baía 1');
  const grid = el('div', 'auto-grid');
  panel.append(ui.autosScope);
  ui.autos = {};
  const autoIcon = {
    'auto-ball-captura': 'capturar',
    'auto-ball-sem-parar': 'repetir',
    'auto-revive': 'revive',
    'auto-potion': 'pocao',
    'auto-voltar-hunt': 'voltar',
  };
  for (const auto of MESA_CATALOG.autos) {
    const button = toggle(auto.label, 'switch auto-switch');
    if (autoIcon[auto.id]) button.dataset.icon = autoIcon[auto.id];
    if (auto.vip) button.append(el('span', 'vip', 'VIP'));
    if (auto.id === 'auto-voltar-hunt') button.title = 'Só volta enquanto houver poção ou revive na bolsa.';
    button.addEventListener('click', () => {
      applyAuto(cfg.selected, auto.id, !autoOn(cfg.selected, auto.id));
      save();
      paint();
    });
    ui.autos[auto.id] = button;
    grid.append(button);
  }
  ui.autoHunt = toggle('Mapa automático', 'switch auto-switch');
  ui.autoHunt.dataset.icon = 'mapa';
  ui.autoHunt.title = 'Troca o mapa desta conta quando outra hunt rende mais XP de treinador.';
  ui.autoHunt.addEventListener('click', () => {
    if (typeof applyAutoHunt === 'function') applyAutoHunt(cfg.selected, cfg.bays[cfg.selected].autoHunt !== true);
    save();
    paint();
  });
  grid.append(ui.autoHunt);
  const limiar = el('div', 'limiar');
  limiar.append(el('span', null, 'usar abaixo de'));
  ui.potion = el('input', 'limiar-range');
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
  });
  ui.potion.addEventListener('change', () => {
    applyPotion(cfg.selected, ui.potion.value);
    save();
    paint();
  });
  limiar.append(ui.potion, ui.potionPct);
  ui.autoHuntStatus = el('p', 'auto-hunt-status', 'Mapa automático desligado.');
  ui.autoHuntStatus.setAttribute('aria-live', 'polite');
  panel.append(grid, limiar, ui.autoHuntStatus);
  return panel;
}

function mount() {
  if (mount.done) return;
  mount.done = true;
  const root = document.getElementById('app');
  root.replaceChildren();
  const rail = el('nav', 'rail');
  rail.setAttribute('aria-label', 'Mesa');
  const mark = el('div', 'rail-mark');
  mark.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.2 2.2h4.6v4.6h-4.6zM9.2 2.2h4.6v4.6h-4.6zM2.2 9.2h4.6v4.6h-4.6zM9.2 9.2h4.6v4.6h-4.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  ui.mesaBtn = el('button', 'rail-btn');
  ui.mesaBtn.type = 'button';
  ui.mesaBtn.setAttribute('aria-label', 'Mesa');
  ui.mesaBtn.title = 'Mesa';
  ui.mesaBtn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.2 2.2h4.6v4.6h-4.6zM9.2 2.2h4.6v4.6h-4.6zM2.2 9.2h4.6v4.6h-4.6zM9.2 9.2h4.6v4.6h-4.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  ui.mesaBtn.append(el('span', null, 'Mesa'));
  ui.ajustesBtn = el('button', 'rail-btn');
  ui.ajustesBtn.type = 'button';
  ui.ajustesBtn.setAttribute('aria-label', 'Ajustes');
  ui.ajustesBtn.title = 'Ajustes';
  ui.ajustesBtn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 4h12.4M1.8 8h12.4M1.8 12h12.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="5" cy="4" r="1.6" fill="#171719" stroke="currentColor" stroke-width="1.5"/><circle cx="11" cy="8" r="1.6" fill="#171719" stroke="currentColor" stroke-width="1.5"/><circle cx="7" cy="12" r="1.6" fill="#171719" stroke="currentColor" stroke-width="1.5"/></svg>';
  ui.ajustesBtn.append(el('span', null, 'Ajustes'));
  ui.mesaBtn.addEventListener('click', () => { cfg.view = 'mesa'; paint(); tuneBays(); });
  ui.esperaBtn = el('button', 'rail-btn');
  ui.esperaBtn.type = 'button';
  ui.esperaBtn.setAttribute('aria-label', 'Espera');
  ui.esperaBtn.title = 'Espera';
  ui.esperaBtn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2h1.7v9.6H5zM9.3 3.2H11v9.6H9.3z" fill="currentColor"/></svg>';
  ui.esperaBtn.append(el('span', null, 'Espera'));
  ui.esperaBtn.addEventListener('click', () => { cfg.view = 'espera'; paint(); tuneBays(); });
  ui.ajustesBtn.addEventListener('click', () => { cfg.view = 'ajustes'; paint(); tuneBays(); });
  rail.append(mark, ui.mesaBtn, ui.esperaBtn, el('div', 'rail-spacer'), ui.ajustesBtn);

  const canvas = el('main', 'canvas');
  const heading = el('div');
  heading.append(el('h1', null, 'Mesa'), el('p', 'scope', 'Neste computador'));
  ui.finding = el('p', 'finding');
  ui.finding.setAttribute('aria-live', 'polite');

  const kpis = el('section', 'kpis');
  kpis.setAttribute('aria-label', 'Estado das baías');
  const cells = [
    ['Caçando', 'cacando'],
    ['Medindo', 'medindo'],
    ['Paradas', 'paradas'],
    ['Sem sessão', 'sem'],
  ];
  for (const [label, key] of cells) {
    const cell = el('div');
    cell.append(el('span', 'k', label), el('b', 'num', '0'));
    ui[key] = cell.querySelector('b');
    kpis.append(cell);
  }

  const controls = el('div', 'controls');
  const gameNav = el('div', 'control-group');
  gameNav.append(el('span', 'control-label', 'No jogo'));
  ui.mute = toggle('Mudo');
  ui.eco = toggle('Economia');
  ui.mute.dataset.icon = 'mudo';
  ui.eco.dataset.icon = 'economia';
  ui.mute.addEventListener('click', () => {
    cfg.bays[cfg.selected].muted = !cfg.bays[cfg.selected].muted;
    save();
    pushPrefs();
    paint();
  });
  ui.eco.addEventListener('click', () => {
    cfg.bays[cfg.selected].eco = !cfg.bays[cfg.selected].eco;
    save();
    pushPrefs();
    paint();
  });
  const reload = el('button', 'text-btn', 'Recarregar');
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
    paintBay(cfg.selected);
    webview.reload();
  });
  ui.igualar = el('button', 'text-btn', 'Igualar as quatro');
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
  ui.scale = el('input', 'limiar-range');
  ui.scale.type = 'range';
  ui.scale.min = '50';
  ui.scale.max = '150';
  ui.scale.step = '1';
  ui.scale.value = '100';
  ui.scale.setAttribute('aria-label', 'Escala da baía em foco');
  ui.scalePct = el('b', 'num', 'Automático');
  ui.scaleAuto = el('button', 'text-btn', 'Automático');
  ui.scaleAuto.type = 'button';
  ui.scaleAuto.dataset.icon = 'automatico';
  ui.scaleAuto.title = 'Voltar ao tamanho automático';
  ui.scale.addEventListener('input', () => {
    const factor = MESA_CATALOG.normalize({ bays: [{ scale: Number(ui.scale.value) / 100 }] }).bays[0].scale;
    cfg.bays[cfg.selected].scale = factor;
    ui.scalePct.textContent = factor == null ? 'Automático' : `${Math.round(factor * 100)}%`;
    ui.scaleAuto.classList.remove('is-on');
    ui.scaleAuto.setAttribute('aria-pressed', 'false');
    if (typeof applyBayZoom === 'function') applyBayZoom(cfg.selected);
  });
  ui.scale.addEventListener('change', () => save());
  ui.scaleAuto.addEventListener('click', () => {
    cfg.bays[cfg.selected].scale = null;
    save();
    paint();
  });
  const scaleBox = el('div', 'limiar');
  scaleBox.dataset.icon = 'escala';
  scaleBox.append(el('span', null, 'Escala'), ui.scale, ui.scalePct, ui.scaleAuto);
  ui.leave = el('button', 'text-btn is-danger', 'Sair da conta');
  ui.leave.type = 'button';
  ui.leave.dataset.icon = 'sair';
  ui.leave.title = 'Apaga a sessão desta baía e volta ao login';
  ui.leave.setAttribute('aria-label', 'Sair da conta desta baía');
  ui.leaveCancel = el('button', 'text-btn', 'Cancelar');
  ui.leaveCancel.type = 'button';
  ui.leaveCancel.dataset.icon = 'cancelar';
  ui.leaveCancel.hidden = true;
  let leaveArmedAt = 0;
  ui.leave.addEventListener('click', () => {
    if (ui.leave.dataset.arm !== '1') {
      ui.leave.dataset.arm = '1';
      leaveArmedAt = Date.now();
      ui.leave.textContent = 'Confirmar saída';
      ui.leave.classList.add('is-armed');
      ui.leaveCancel.hidden = false;
      return;
    }
    if (Date.now() - leaveArmedAt < 400) return;
    disarmLeave();
    if (typeof forgetBay === 'function') forgetBay(cfg.selected);
  });
  ui.leaveCancel.addEventListener('click', () => disarmLeave());
  const bayTools = el('div', 'control-group');
  bayTools.append(el('span', 'control-label', 'Nesta baía'), ui.mute, ui.eco, scaleBox, reload, ui.igualar);
  const sessionTools = el('div', 'control-group');
  sessionTools.append(ui.leave, ui.leaveCancel);
  const navIcon = { Mapa: 'mapa', 'Pokédex': 'pokedex', Depot: 'depot', Boss: 'boss', Market: 'market' };
  for (const label of MESA_CATALOG.nav) {
    const button = el('button', 'text-btn', label);
    button.type = 'button';
    if (navIcon[label]) button.dataset.icon = navIcon[label];
    button.addEventListener('click', () => {
      const webview = webviews[cfg.selected];
      if (webview && live[cfg.selected].ready) webview.send('click-label', label);
    });
    gameNav.append(button);
  }
  controls.append(gameNav, bayTools, sessionTools);

  ui.mesaView = el('section', 'view workspace');
  ui.baysPane = el('div', 'bays-pane');
  ui.baysBox = el('div', 'bays');
  ui.bays = [];
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const card = el('article', 'bay');
    const top = el('div', 'bay-top');
    const name = el('span', 'bay-name', `Baía ${index + 1}`);
    const huntHint = el('span', 'bay-hunt', '');
    huntHint.hidden = true;
    const status = el('span', 'bay-status', 'sem sessão');
    const stats = el('div', 'bay-stats');
    const level = el('b', 'num', '\u2013');
    const xp = el('b', 'num', '\u2013');
    const gold = el('b', 'num', '\u2013');
    const ram = el('b', 'num', '\u2013');
    for (const [label, node] of [['Nv', level], ['XP/h', xp], ['Ouro', gold], ['RAM', ram]]) {
      const stat = el('span', 'stat');
      stat.append(el('span', 'k', label), node);
      stats.append(stat);
    }
    const rename = el('button', 'text-btn', 'Renomear');
    rename.type = 'button';
    rename.dataset.icon = 'renomear';
    const openBtn = el('button', 'text-btn', 'Abrir');
    const closeBtn = el('button', 'text-btn', 'Fechar');
    openBtn.classList.add('is-primary');
    openBtn.dataset.icon = 'abrir';
    closeBtn.dataset.icon = 'fechar';
    const awayBtn = typeof bayAwayButton === 'function' ? bayAwayButton(index) : el('button', 'text-btn', 'Tirar');
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
      const input = el('input', 'rename');
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
    const bayId = el('div', 'bay-id');
    bayId.append(name, huntHint, status);
    const actions = el('div', 'bay-actions');
    actions.append(openBtn, closeBtn, awayBtn, rename);
    const head = el('div', 'bay-head');
    head.append(bayId, actions);
    top.append(head, stats);
    top.tabIndex = 0;
    top.addEventListener('click', () => select(index));
    top.addEventListener('keydown', (event) => {
      if (event.target !== top) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      select(index);
    });
    const stage = el('div', 'bay-stage is-empty');
    const empty = el('p', 'bay-empty', 'Aguardando a vez nesta abertura.');
    stage.append(empty);
    card.append(top, stage);
    ui.bays.push({ root: card, name, huntHint, status, level, xp, gold, ram, stage, empty, rename, openBtn, closeBtn, awayBtn });
    ui.baysBox.append(card);
  }
  const toolbar = el('div', 'toolbar');
  toolbar.append(mountAutos(), controls);
  ui.toolbar = toolbar;
  if (typeof mountAway === 'function') mountAway(toolbar);
  ui.baysPane.append(toolbar, ui.baysBox);
  ui.mesaView.append(ui.baysPane);

  ui.ajustesView = el('section', 'view settings');
  ui.night = toggle('Ligado');
  ui.otimizado = toggle('Ligado');
  ui.trackers = toggle('Ligado');
  ui.layouts = {};
  const layoutRow = el('div', 'layouts');
  for (const item of MESA_CATALOG.layouts) {
    const button = el('button', 'text-btn', item.label);
    button.type = 'button';
    button.dataset.icon = item.id;
    button.addEventListener('click', () => { cfg.layout = item.id; save(); paint(); });
    ui.layouts[item.id] = button;
    layoutRow.append(button);
  }
  const rows = [
    ['Modo noturno', 'O tema escuro que o jogo já oferece.', ui.night],
    ['Modo otimizado', 'Menos animação na luta, ajuste do próprio jogo.', ui.otimizado],
    ['Disposição', 'Grade, fila ou coluna. Tirar tira a baía da grade; em Fora da grade ela volta, com o login guardado.', layoutRow],
    ['Rastreadores', 'Corta anúncio e analytics da página. Vale na próxima abertura.', ui.trackers],
  ];
  for (const [title, copy, control] of rows) {
    const row = el('div', 'setting');
    const text = el('div');
    text.append(el('strong', null, title), el('p', null, copy));
    if (control === ui.night) ui.night.addEventListener('click', () => { cfg.night = !cfg.night; save(); pushPrefs(); paint(); });
    if (control === ui.otimizado) ui.otimizado.addEventListener('click', () => { cfg.otimizado = !cfg.otimizado; save(); pushPrefs(); paint(); });
    if (control === ui.trackers) ui.trackers.addEventListener('click', () => { cfg.trackers = !cfg.trackers; save(); paint(); });
    row.append(text, control);
    ui.ajustesView.append(row);
  }
  if (typeof mountLiveBonus === 'function') mountLiveBonus(ui.ajustesView);
  if (typeof mountExtras === 'function') mountExtras(ui.ajustesView);
  if (typeof mountPerf === 'function') mountPerf(ui.ajustesView);
  const note = el('div', 'setting');
  const noteText = el('div');
  ui.path = el('p', 'path', 'Disponível no aplicativo.');
  noteText.append(
    el('strong', null, 'Neste computador'),
    el('p', null, 'O login fica na sessão de cada baía. A senha fica na página do jogo. São quatro baías, o teto de contas. Os interruptores apertam os controles que o jogo já mostra.'),
    ui.path,
  );
  note.append(noteText);
  ui.ajustesView.append(note);

  ui.esperaView = el('section', 'view standby');
  if (typeof mountStandby === 'function') mountStandby(ui.esperaView);

  canvas.append(heading, ui.finding, kpis, ui.mesaView, ui.esperaView, ui.ajustesView);
  if (typeof watchBayFrames === 'function') watchBayFrames();
  root.append(rail, canvas);
  paint();
}

boot();
