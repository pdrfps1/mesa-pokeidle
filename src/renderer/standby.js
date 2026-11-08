function mapOf(index) {
  const hunt = live[index] && live[index].hunt;
  if (!hunt || !live[index].loggedIn) return '';
  if (hunt.noCentro) return 'Pokémon Center';
  return hunt.huntName || '';
}

function autosOf(index) {
  const names = MESA_CATALOG.autos.filter((auto) => autoOn(index, auto.id)).map((auto) => auto.label);
  if (cfg.bays[index] && cfg.bays[index].autoHunt === true) names.push('Mapa automático');
  return names.join(' · ');
}

function standbyPlace(index) {
  if (cfg.bays[index].placed === false) return 'Fora da grade. O jogo desta conta está parado.';
  if (cfg.bays[index].open === false) return 'Baía fechada. O login continua guardado.';
  return '';
}

function historySeries(index) {
  if (!xpHistoryDoc || !Array.isArray(xpHistoryDoc.bays)) return [];
  const series = xpHistoryDoc.bays[index];
  if (!Array.isArray(series)) return [];
  const now = Date.now();
  if (typeof MesaXpHistory !== 'undefined') MesaXpHistory.pruneSeries(series, now);
  return series.slice();
}

function formatHourLabel(t) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(t));
}

function paintStandbyHistoryChart(wrap, points) {
  const svg = wrap.querySelector('.standby-chart-svg');
  const empty = wrap.querySelector('.standby-chart-empty');
  if (!svg) return;
  svg.replaceChildren();

  const width = 260;
  const height = 140;
  const pad = { top: 10, right: 6, bottom: 22, left: 6 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const baseline = pad.top + innerH;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.hidden = false;

  const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  baseLine.setAttribute('x1', String(pad.left));
  baseLine.setAttribute('x2', String(width - pad.right));
  baseLine.setAttribute('y1', String(baseline));
  baseLine.setAttribute('y2', String(baseline));
  baseLine.setAttribute('stroke', 'currentColor');
  baseLine.setAttribute('stroke-opacity', '0.55');
  baseLine.setAttribute('stroke-width', '1.5');
  svg.append(baseLine);

  if (!points || points.length < 2) {
    if (empty) empty.hidden = false;
    svg.setAttribute('aria-label', 'Sem histórico de XP');
    return;
  }

  if (empty) empty.hidden = true;
  svg.setAttribute('aria-label', 'Histórico de XP por hora nas últimas 24 horas');
  const values = points.map((point) => point.xpH);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const spanV = maxV - minV || 1;
  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const spanT = tMax - tMin || 1;

  const xAt = (t) => pad.left + ((t - tMin) / spanT) * innerW;
  const yAt = (v) => pad.top + innerH - ((v - minV) / spanV) * innerH;

  const linePoints = points.map((point) => `${xAt(point.t).toFixed(2)},${yAt(point.xpH).toFixed(2)}`);
  const areaPoints = [
    `${xAt(points[0].t).toFixed(2)},${baseline.toFixed(2)}`,
    ...linePoints,
    `${xAt(points[points.length - 1].t).toFixed(2)},${baseline.toFixed(2)}`,
  ].join(' ');

  const area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  area.setAttribute('points', areaPoints);
  area.setAttribute('fill', 'currentColor');
  area.setAttribute('fill-opacity', '0.12');
  area.setAttribute('stroke', 'none');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', linePoints.join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '1.75');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');

  svg.append(area, line);

  const tickCount = Math.min(4, points.length);
  for (let i = 0; i < tickCount; i += 1) {
    const idx = tickCount === 1 ? 0 : Math.round((i / (tickCount - 1)) * (points.length - 1));
    const point = points[idx];
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', xAt(point.t).toFixed(2));
    label.setAttribute('y', String(height - 6));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'standby-chart-axis');
    label.textContent = formatHourLabel(point.t);
    svg.append(label);
  }
}

// ---- Widgets: ordem, largura, recolhido e oculto vêm de cfg.standby (standby-layout.js). ----

const STANDBY_EASE = 'cubic-bezier(0.32,0.72,0,1)';
const STANDBY_FLIP_MS = 240;
const STANDBY_GRIP_SVG = '<svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true" focusable="false"><circle cx="2.5" cy="2.5" r="1.4" fill="currentColor"/><circle cx="7.5" cy="2.5" r="1.4" fill="currentColor"/><circle cx="2.5" cy="8" r="1.4" fill="currentColor"/><circle cx="7.5" cy="8" r="1.4" fill="currentColor"/><circle cx="2.5" cy="13.5" r="1.4" fill="currentColor"/><circle cx="7.5" cy="13.5" r="1.4" fill="currentColor"/></svg>';
const STANDBY_MENU_SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="3" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="8" r="1.5" fill="currentColor"/></svg>';

let standbyDrag = null;
let standbyOpenMenu = null;
let standbyMenuKey = null;
let standbyProcsLiveOn = false;

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function standbyState() {
  return MesaStandbyLayout.normalize(cfg.standby);
}

function standbyWidgetNodes() {
  if (!ui.standbyBoard) return [];
  return Array.from(ui.standbyBoard.querySelectorAll(':scope > .standby-widget'));
}

// Título da moldura de uma baía na Twitch: segue o nome da baía.
function twitchBayTitulo(index) {
  return `Twitch · ${titleOf(index)}`;
}

function standbyLabel(id) {
  if (id === 'captures') return 'Capturas';
  if (id === 'procs') return 'Recursos do app';
  if (id === 'twitch') return 'Bônus Twitch';
  if (id === 'pokecalc') return 'Calculadora de status';
  if (id.startsWith('twitch-bay-')) return twitchBayTitulo(Number(id.slice('twitch-bay-'.length)));
  return titleOf(Number(id.slice(4)));
}

function announceStandby(message) {
  if (ui.standbySr) ui.standbySr.textContent = message;
}

function focusIfVisible(node) {
  if (node && node.isConnected && node.offsetParent !== null) node.focus();
}

function procsLive() {
  const widget = standbyState().widgets.procs;
  return !widget.hidden && !widget.collapsed;
}

// Anima os widgets que mudaram de lugar (FLIP). mutate() faz a troca no DOM.
function flipAround(mutate, animate) {
  const nodes = standbyWidgetNodes().filter((node) => !node.hidden && !node.classList.contains('is-dragging'));
  nodes.forEach((node) => {
    if (typeof node.getAnimations === 'function') node.getAnimations().forEach((anim) => anim.cancel());
  });
  const before = new Map(nodes.map((node) => [node, node.getBoundingClientRect()]));
  mutate();
  if (!animate || reducedMotion()) return;
  for (const node of nodes) {
    const start = before.get(node);
    if (!start || node.hidden || node.classList.contains('is-dragging')) continue;
    const end = node.getBoundingClientRect();
    const dx = start.left - end.left;
    const dy = start.top - end.top;
    if (!dx && !dy) continue;
    node.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: STANDBY_FLIP_MS, easing: STANDBY_EASE },
    );
  }
}

// Próxima posição da lista, pulando ocultos. Devolve o estado novo ou null na borda.
function neighbourMove(state, id, dir) {
  const order = state.order;
  const from = order.indexOf(id);
  if (from < 0) return null;
  let to = from + dir;
  while (to >= 0 && to < order.length && state.widgets[order[to]].hidden) to += dir;
  if (to < 0 || to >= order.length) return null;
  return MesaStandbyLayout.moveTo(state, id, to);
}

function visiblePosition(state, id) {
  return state.order.filter((item) => !state.widgets[item].hidden).indexOf(id) + 1;
}

// Grava cfg.standby, salva, reaplica o layout e avisa no status.
function commitStandby(next, message, focusEl) {
  cfg.standby = next;
  save();
  applyStandbyLayout({ animate: true });
  announceStandby(message);
  focusIfVisible(focusEl);
}

function moveStandbyWidget(id, dir, focusEl) {
  if (standbyDrag) return;
  const next = neighbourMove(standbyState(), id, dir);
  if (!next) {
    announceStandby('Não há para onde mover este widget nessa direção.');
    return;
  }
  commitStandby(next, `${standbyLabel(id)} movida para a posição ${visiblePosition(next, id)}`, focusEl);
}

function setStandbyWidget(id, patch, message, focusEl) {
  commitStandby(MesaStandbyLayout.set(standbyState(), id, patch), message, focusEl);
}

function showStandbyWidget(id) {
  setStandbyWidget(id, { hidden: false }, `${standbyLabel(id)} visível.`, ui.standbyWidgetsBtn);
}

function showAllStandbyWidgets() {
  let next = standbyState();
  for (const id of next.order) next = MesaStandbyLayout.set(next, id, { hidden: false });
  commitStandby(next, 'Todos os widgets visíveis.', ui.standbyWidgetsBtn);
}

function restoreStandbyDefaults() {
  commitStandby(MesaStandbyLayout.reset(), 'Ordem e larguras padrão restauradas.', ui.standbyWidgetsBtn);
}

// ---- Menus: um aberto por vez. Esc fecha e devolve o foco ao botão. ----

function closeStandbyMenu(restoreFocus) {
  if (!standbyOpenMenu) return;
  const { button, menu } = standbyOpenMenu;
  standbyOpenMenu = null;
  menu.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  document.removeEventListener('pointerdown', onStandbyOutside, true);
  if (restoreFocus) focusIfVisible(button);
}

function onStandbyOutside(event) {
  if (!standbyOpenMenu) return;
  const { button, menu } = standbyOpenMenu;
  if (menu.contains(event.target) || button.contains(event.target)) return;
  closeStandbyMenu(false);
}

function openStandbyMenu(button, menu) {
  closeStandbyMenu(false);
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  standbyOpenMenu = { button, menu };
  document.addEventListener('pointerdown', onStandbyOutside, true);
  const first = menu.querySelector('[role^="menuitem"]:not([disabled])');
  if (first) first.focus();
}

function standbyMenuItem(text, action, role) {
  const button = el('button', 'standby-menu-item', text);
  button.type = 'button';
  button.setAttribute('role', role || 'menuitem');
  if (action) {
    button.addEventListener('click', () => {
      closeStandbyMenu(false);
      action();
    });
  }
  return button;
}

function standbyMenuSeparator() {
  const sep = el('div', 'standby-menu-sep');
  sep.setAttribute('role', 'separator');
  return sep;
}

function standbyMenuKeys(menu) {
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeStandbyMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      closeStandbyMenu(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(menu.querySelectorAll('[role^="menuitem"]:not([disabled])'));
    if (!items.length) return;
    const dir = event.key === 'ArrowDown' ? 1 : -1;
    const index = items.indexOf(document.activeElement);
    const base = index < 0 ? (dir > 0 ? -1 : items.length) : index;
    items[(base + dir + items.length) % items.length].focus();
  });
}

function bindStandbyMenuButton(button, menu) {
  button.addEventListener('click', () => {
    if (menu.hidden) openStandbyMenu(button, menu);
    else closeStandbyMenu(true);
  });
  standbyMenuKeys(menu);
}

// ---- Arraste: só pela alça. Um placeholder marca o lugar; os outros deslizam (FLIP). ----

function nextVisibleAfter(node, skip) {
  let cursor = node.nextElementSibling;
  while (cursor) {
    if (cursor !== skip && cursor.classList.contains('standby-widget') && !cursor.hidden) return cursor.dataset.widget;
    cursor = cursor.nextElementSibling;
  }
  return null;
}

function paintStandbyDragPose(drag) {
  const scale = reducedMotion() ? '' : ' scale(1.01)';
  drag.root.style.transform = `translate(${drag.dx}px, ${drag.dy}px)${scale}`;
}

function moveStandbyPlaceholder(drag, cx, cy) {
  const { root, placeholder } = drag;
  const siblings = standbyWidgetNodes().filter((node) => node !== root && !node.hidden);
  if (!siblings.length) return;
  let best = null;
  let bestRect = null;
  let bestDist = Infinity;
  for (const node of siblings) {
    const rect = node.getBoundingClientRect();
    const dist = Math.hypot(rect.left + rect.width / 2 - cx, rect.top + rect.height / 2 - cy);
    if (dist < bestDist) {
      best = node;
      bestRect = rect;
      bestDist = dist;
    }
  }
  const midX = bestRect.left + bestRect.width / 2;
  const midY = bestRect.top + bestRect.height / 2;
  const sameRow = Math.abs(cy - midY) < bestRect.height / 2;
  const beforeBest = sameRow ? cx < midX : cy < midY;
  const ref = beforeBest ? best : best.nextSibling;
  if (ref === placeholder || placeholder.nextSibling === ref) return;
  flipAround(() => ui.standbyBoard.insertBefore(placeholder, ref), true);
}

function onStandbyDragMove(event) {
  const drag = standbyDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  drag.dx = event.clientX - drag.startX;
  drag.dy = event.clientY - drag.startY;
  paintStandbyDragPose(drag);
  moveStandbyPlaceholder(drag, drag.left + drag.dx + drag.width / 2, drag.top + drag.dy + drag.height / 2);
}

function onStandbyDragUp(event) {
  if (!standbyDrag || event.pointerId !== standbyDrag.pointerId) return;
  finishStandbyDrag(true);
}

function onStandbyDragCancel(event) {
  if (!standbyDrag || event.pointerId !== standbyDrag.pointerId) return;
  finishStandbyDrag(false);
}

function onStandbyLostCapture(event) {
  if (!standbyDrag || event.pointerId !== standbyDrag.pointerId) return;
  finishStandbyDrag(false);
}

function onStandbyDragKey(event) {
  if (event.key !== 'Escape' || !standbyDrag) return;
  event.preventDefault();
  event.stopPropagation();
  finishStandbyDrag(false);
}

function finishStandbyDrag(commit) {
  const drag = standbyDrag;
  if (!drag) return;
  standbyDrag = null;
  const { grip, root, placeholder, id } = drag;
  grip.removeEventListener('pointermove', onStandbyDragMove);
  grip.removeEventListener('pointerup', onStandbyDragUp);
  grip.removeEventListener('pointercancel', onStandbyDragCancel);
  grip.removeEventListener('lostpointercapture', onStandbyLostCapture);
  document.removeEventListener('keydown', onStandbyDragKey, true);
  if (typeof grip.hasPointerCapture === 'function' && grip.hasPointerCapture(drag.pointerId)) {
    grip.releasePointerCapture(drag.pointerId);
  }

  let next = null;
  if (commit) {
    const state = standbyState();
    const following = nextVisibleAfter(placeholder, root);
    const rest = state.order.filter((item) => item !== id);
    const at = following ? rest.indexOf(following) : rest.length;
    const candidate = MesaStandbyLayout.moveTo(state, id, at);
    if (candidate.order.join('|') !== state.order.join('|')) next = candidate;
  }

  flipAround(() => {
    placeholder.remove();
    root.classList.remove('is-dragging');
    root.style.left = '';
    root.style.top = '';
    root.style.width = '';
    root.style.height = '';
    root.style.transform = '';
    root.style.boxSizing = '';
    if (next) {
      cfg.standby = next;
      applyStandbyLayout({ animate: false });
    }
  }, true);

  if (next) {
    save();
    announceStandby(`${standbyLabel(id)} movida para a posição ${visiblePosition(next, id)}`);
    if (grip.isConnected) grip.focus({ preventScroll: true });
  }
}

function startStandbyDrag(id, grip, event) {
  if (event.button !== 0 || standbyDrag) return;
  event.preventDefault();
  closeStandbyMenu(false);
  const root = ui.standbyWidgets[id].root;
  const rect = root.getBoundingClientRect();

  const placeholder = el('div', 'standby-placeholder');
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.dataset.span = root.dataset.span;
  placeholder.style.height = `${rect.height}px`;
  root.before(placeholder);

  root.classList.add('is-dragging');
  root.style.boxSizing = 'border-box';
  root.style.left = `${rect.left}px`;
  root.style.top = `${rect.top}px`;
  root.style.width = `${rect.width}px`;
  root.style.height = `${rect.height}px`;

  standbyDrag = {
    id,
    grip,
    root,
    placeholder,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    dx: 0,
    dy: 0,
  };
  grip.setPointerCapture(event.pointerId);
  grip.addEventListener('pointermove', onStandbyDragMove);
  grip.addEventListener('pointerup', onStandbyDragUp);
  grip.addEventListener('pointercancel', onStandbyDragCancel);
  grip.addEventListener('lostpointercapture', onStandbyLostCapture);
  document.addEventListener('keydown', onStandbyDragKey, true);
  paintStandbyDragPose(standbyDrag);
}

// ---- Quadro: cabeçalho com alça, título, marcas e menu. O corpo é o conteúdo atual do widget. ----

function buildStandbyWidget(id, titleText, marks, bodyNodes) {
  const titleId = `standby-title-${id}`;
  const root = el('article', 'standby-widget mesa-panel');
  root.dataset.widget = id;
  root.setAttribute('aria-labelledby', titleId);

  const grip = el('button', 'standby-widget-grip');
  grip.type = 'button';
  grip.innerHTML = STANDBY_GRIP_SVG;
  grip.title = 'Arraste para mover. Alt com as setas também move.';
  grip.setAttribute('aria-label', `Mover ${titleText}`);

  const title = el('h2', 'standby-widget-title', titleText);
  title.id = titleId;

  const markWrap = el('div', 'standby-widget-marks');
  markWrap.append(...marks);

  const menuWrap = el('div', 'standby-menu-wrap');
  const menuBtn = el('button', 'standby-widget-menu');
  menuBtn.type = 'button';
  menuBtn.innerHTML = STANDBY_MENU_SVG;
  menuBtn.setAttribute('aria-haspopup', 'menu');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', `Opções de ${titleText}`);
  const menu = el('div', 'standby-menu-panel');
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', `Opções de ${titleText}`);

  const widthGroup = el('div');
  widthGroup.setAttribute('role', 'group');
  widthGroup.setAttribute('aria-label', 'Largura');
  const items = {
    before: standbyMenuItem('Mover antes', () => moveStandbyWidget(id, -1, menuBtn)),
    after: standbyMenuItem('Mover depois', () => moveStandbyWidget(id, 1, menuBtn)),
    widthOne: standbyMenuItem('Uma coluna', () => setStandbyWidget(id, { span: 1 }, `${standbyLabel(id)} agora ocupa uma coluna.`, menuBtn), 'menuitemradio'),
    widthTwo: standbyMenuItem('Duas colunas', () => setStandbyWidget(id, { span: 2 }, `${standbyLabel(id)} agora ocupa duas colunas.`, menuBtn), 'menuitemradio'),
    collapse: standbyMenuItem('Recolher', () => {
      const collapsed = !standbyState().widgets[id].collapsed;
      setStandbyWidget(id, { collapsed }, `${standbyLabel(id)} ${collapsed ? 'recolhida' : 'aberta'}.`, menuBtn);
    }),
    hide: standbyMenuItem('Ocultar', () => {
      setStandbyWidget(id, { hidden: true }, `${standbyLabel(id)} oculta. Use Widgets para mostrar.`, ui.standbyWidgetsBtn);
    }),
  };
  widthGroup.append(items.widthOne, items.widthTwo);
  menu.append(
    items.before,
    items.after,
    standbyMenuSeparator(),
    widthGroup,
    standbyMenuSeparator(),
    items.collapse,
    standbyMenuSeparator(),
    items.hide,
  );
  menuWrap.append(menuBtn, menu);
  bindStandbyMenuButton(menuBtn, menu);

  grip.addEventListener('pointerdown', (event) => startStandbyDrag(id, grip, event));
  grip.addEventListener('keydown', (event) => {
    if (standbyDrag) return;
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    moveStandbyWidget(id, event.key === 'ArrowUp' ? -1 : 1, grip);
  });

  const head = el('header', 'standby-widget-head');
  head.append(grip, title, markWrap, menuWrap);
  const body = el('div', 'standby-widget-body');
  body.append(...bodyNodes);
  root.append(head, body);
  return { root, grip, title, menuBtn, menu, items };
}

function rebuildStandbyWidgetsMenu(state) {
  const hiddenIds = state.order.filter((id) => state.widgets[id].hidden);
  const nodes = hiddenIds.map((id) => standbyMenuItem(`Mostrar ${standbyLabel(id)}`, () => showStandbyWidget(id)));
  if (!hiddenIds.length) {
    const none = standbyMenuItem('Todos os widgets estão visíveis', null);
    none.disabled = true;
    nodes.push(none);
  }
  nodes.push(standbyMenuSeparator(), standbyMenuItem('Restaurar padrão', restoreStandbyDefaults));
  ui.standbyWidgetsMenu.replaceChildren(...nodes);
}

// Aplica ordem, largura, oculto e recolhido de cfg.standby no DOM.
function applyStandbyLayout(options) {
  if (!ui.standbyBoard || !ui.standbyWidgets) return;
  const animate = !!(options && options.animate);
  const state = standbyState();
  cfg.standby = state;

  const domOrder = standbyWidgetNodes().map((node) => node.dataset.widget).join('|');
  if (domOrder !== state.order.join('|')) {
    flipAround(() => {
      for (const id of state.order) ui.standbyBoard.append(ui.standbyWidgets[id].root);
    }, animate);
  }

  let twitchMostrada = false;
  for (const id of state.order) {
    const widget = state.widgets[id];
    const frame = ui.standbyWidgets[id];
    const label = standbyLabel(id);
    // Bloco da Twitch que sai do oculto é repintado: o snapshot pode ter andado enquanto ele estava fora.
    if (id.startsWith('twitch') && frame.root.hidden && !widget.hidden) twitchMostrada = true;
    frame.root.hidden = widget.hidden;
    frame.root.dataset.span = String(widget.span);
    frame.root.classList.toggle('is-collapsed', widget.collapsed);
    frame.grip.setAttribute('aria-label', `Mover ${label}`);
    frame.menuBtn.setAttribute('aria-label', `Opções de ${label}`);
    frame.menu.setAttribute('aria-label', `Opções de ${label}`);
    frame.items.before.disabled = !neighbourMove(state, id, -1);
    frame.items.after.disabled = !neighbourMove(state, id, 1);
    frame.items.widthOne.setAttribute('aria-checked', String(widget.span === 1));
    frame.items.widthTwo.setAttribute('aria-checked', String(widget.span === 2));
    frame.items.collapse.textContent = widget.collapsed ? 'Abrir' : 'Recolher';
  }

  if (twitchMostrada && typeof paintLiveBonus === 'function') paintLiveBonus();

  const allHidden = state.order.every((id) => state.widgets[id].hidden);
  ui.standbyEmpty.hidden = !allHidden;

  const menuKey = state.order
    .filter((id) => state.widgets[id].hidden)
    .map((id) => `${id}:${standbyLabel(id)}`)
    .join('|');
  if (menuKey !== standbyMenuKey) {
    standbyMenuKey = menuKey;
    rebuildStandbyWidgetsMenu(state);
  }

  const procsOn = procsLive();
  if (procsOn && !standbyProcsLiveOn && cfg.view === 'espera') readProcs();
  standbyProcsLiveOn = procsOn;
}

function paintStandby() {
  const onEspera = cfg.view === 'espera';
  if (onEspera && !procsWasOn) readProcs();
  procsWasOn = onEspera;
  if (!ui.standby || cfg.view !== 'espera') return;
  applyStandbyLayout();
  ui.standby.forEach((card, index) => {
    const status = statusOf(index);
    const placed = cfg.bays[index].placed !== false;
    const note = [standbyPlace(index), placed ? (typeof MesaAutoHunt !== 'undefined' && MesaAutoHunt.line ? MesaAutoHunt.line(index) : '') : ''].filter(Boolean).join(' ');
    card.name.textContent = titleOf(index);
    card.status.textContent = placed ? status.word : 'fora';
    card.status.className = 'standby-status';
    if (card.root) card.root.dataset.tone = placed ? status.tone : 'off';
    card.level.textContent = live[index].loggedIn && live[index].level ? live[index].level : '–';
    card.gold.textContent = live[index].loggedIn && live[index].gold ? live[index].gold : '–';
    card.xp.textContent = MesaStatus.fmtXp(placed && live[index].loggedIn ? live[index].rate : null).text;
    card.map.textContent = placed ? (mapOf(index) || '–') : '–';
    card.ram.textContent = !placed || live[index].ram == null ? '–' : `${live[index].ram} MB`;
    card.updated.textContent = placed && live[index].lastGood ? live[index].lastGood : '–';
    card.note.hidden = !note;
    card.note.textContent = note;
    card.vip.hidden = !placed || !live[index].hunt || live[index].hunt.vip !== true;
    card.open.hidden = !placed;
    paintStandbyHistoryChart(card.chartWrap, placed ? historySeries(index) : []);
  });
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    ui.standbyWidgets[`twitch-bay-${index}`].title.textContent = twitchBayTitulo(index);
  }
  paintStandbyCaptures();
}

function watchStandby(index) {
  const button = el('button', 'btn btn-sm btn-soft standby-open', 'Ver jogo');
  button.type = 'button';
  button.addEventListener('click', () => {
    cfg.view = 'mesa';
    if (cfg.bays[index] && cfg.bays[index].placed !== false) select(index);
    else {
      paint();
      tuneBays();
    }
  });
  return button;
}

const CAPTURE_KINDS = [['shiny', 'Shiny'], ['normal', 'Normais']];

// Corpo do widget Capturas: uma seção por tipo, com total, última hora e uma linha por baía.
function buildCapturesBody() {
  const wrap = el('div', 'standby-caps-wrap');
  const grid = el('div', 'standby-caps');
  const refs = {};
  for (const [kind, label] of CAPTURE_KINDS) {
    const section = el('section', 'standby-cap');
    section.dataset.kind = kind;
    section.setAttribute('aria-label', label);
    const head = el('div', 'standby-cap-head');
    if (kind === 'shiny') {
      const icon = el('span', 'standby-cap-icon');
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = mesaIcon('estrela');
      head.append(icon);
    }
    const labelEl = el('span', 'standby-cap-label', label);
    labelEl.id = `standby-cap-label-${kind}`;
    head.append(labelEl);
    const total = el('b', 'standby-cap-total', '0');
    const last = el('p', 'standby-cap-last', 'Nenhuma ainda');
    const list = el('ul', 'standby-cap-bays');
    const bays = [];
    for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
      const item = el('li', null, `Baía ${index + 1} · –`);
      bays.push(item);
      list.append(item);
    }
    section.append(head, total, last, list);
    grid.append(section);
    refs[kind] = { total, last, bays };
  }
  const best = el('p', 'standby-cap-best');
  best.hidden = true;
  const note = el('p', 'standby-cap-note', 'Nenhuma captura registrada nesta sessão.');
  wrap.append(grid, best, note);
  return { root: wrap, note, best, shiny: refs.shiny, normal: refs.normal };
}

// Texto do mais forte: Pokémon, nível, shiny e a conta da baía onde foi capturado.
function melhorCapturaTexto(melhor, nick) {
  const partes = [`Mais forte: ${melhor.nome || 'Pokémon'} · Nv ${melhor.level}`];
  if (melhor.shiny) partes.push('Shiny');
  partes.push(`conta ${nick || 'sem nome'}`);
  return partes.join(' · ');
}

function paintStandbyCaptures() {
  const caps = ui.standbyCaptures;
  if (!caps) return;
  const sums = { shiny: 0, normal: 0 };
  const lasts = { shiny: null, normal: null };
  let best = null;
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const tally = live[index] && live[index].capturas;
    if (!tally) continue;
    const shown = cfg.bays[index].placed !== false && live[index].loggedIn === true;
    for (const kind of ['shiny', 'normal']) {
      const count = typeof tally[kind] === 'number' ? tally[kind] : 0;
      const at = kind === 'shiny' ? tally.lastShinyAt : tally.lastNormalAt;
      // Total e última hora só somam as baías que a linha mostra como contadas.
      if (shown) {
        sums[kind] += count;
        if (typeof at === 'number' && (lasts[kind] == null || at > lasts[kind])) lasts[kind] = at;
      }
      caps[kind].bays[index].textContent = `Baía ${index + 1} · ${shown ? count : '–'}`;
    }
    // O mais forte também sai só das baías que a linha mostra; leva a conta da baía.
    const melhor = tally.melhor;
    if (shown && melhor && (!best || melhor.level > best.melhor.level
      || (melhor.level === best.melhor.level && (melhor.ivSum ?? -1) > (best.melhor.ivSum ?? -1)))) {
      best = { melhor, nick: live[index].nick };
    }
  }
  for (const kind of ['shiny', 'normal']) {
    caps[kind].total.textContent = String(sums[kind]);
    caps[kind].last.textContent = lasts[kind] == null ? 'Nenhuma ainda' : `Última: ${formatHourLabel(lasts[kind])}`;
  }
  caps.best.hidden = !best;
  if (best) caps.best.textContent = melhorCapturaTexto(best.melhor, best.nick);
  caps.note.hidden = sums.shiny + sums.normal > 0;
}

// Corpo de um widget da Twitch: o bloco do live-bonus.js ou, se ele não carregou, um aviso.
function corpoTwitch(no) {
  return no || el('p', 'standby-note', 'Disponível no aplicativo.');
}

function mountStandby(parent) {
  ui.standby = [];
  ui.standbyWidgets = {};

  ui.standbyCaptures = buildCapturesBody();
  ui.standbyWidgets.captures = buildStandbyWidget('captures', 'Capturas', [], [ui.standbyCaptures.root]);

  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const vip = el('span', 'standby-vip', 'VIP');
    vip.hidden = true;
    const status = el('span', 'bay-status', 'sem sessão');
    const body = el('div', 'standby-body');
    const left = el('div', 'standby-left');
    const facts = el('div', 'standby-facts');
    const level = el('b', 'num', '–');
    const map = el('b', null, '–');
    const ram = el('b', 'num', '–');
    const leftFacts = [
      ['Nível', level, 'nivel'],
      ['Mapa', map, null],
      ['Memória', ram, 'ram'],
    ];
    leftFacts.forEach(([label, value, iconName]) => {
      const fact = el('div', 'standby-fact');
      const labelNode = el('span', null, label);
      if (iconName) {
        const mini = el('span', 'fact-icon');
        mini.setAttribute('aria-hidden', 'true');
        mini.innerHTML = mesaIcon(iconName);
        labelNode.prepend(mini);
      }
      fact.append(labelNode, value);
      facts.append(fact);
    });
    const open = watchStandby(index);
    left.append(facts, open);
    const right = el('div', 'standby-right');
    const metrics = el('div', 'standby-metrics');
    const gold = el('b', 'num', '–');
    const xp = el('b', 'num', '–');
    const updated = el('b', 'num', '–');
    for (const [label, value, iconName] of [
      ['Ouro', gold, 'moeda'],
      ['XP/h', xp, 'estrela-xp'],
    ]) {
      const fact = el('div', 'standby-fact standby-fact-metric');
      const labelNode = el('span', null, label);
      if (iconName) {
        const mini = el('span', 'fact-icon');
        mini.setAttribute('aria-hidden', 'true');
        mini.innerHTML = mesaIcon(iconName);
        labelNode.prepend(mini);
      }
      fact.append(labelNode, value);
      metrics.append(fact);
    }
    const updatedWrap = el('div', 'standby-updated');
    updatedWrap.append(el('span', null, 'Atualizado'), updated);
    const chartWrap = el('div', 'standby-chart');
    const chartSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chartSvg.classList.add('standby-chart-svg');
    chartSvg.setAttribute('aria-hidden', 'true');
    chartSvg.hidden = true;
    const chartEmpty = el('p', 'standby-chart-empty', 'Sem histórico ainda');
    chartEmpty.hidden = false;
    chartWrap.append(chartSvg, chartEmpty);
    right.append(metrics, updatedWrap, chartWrap);
    body.append(left, right);
    const note = el('p', 'standby-note', '');
    note.hidden = true;

    const frame = buildStandbyWidget(`bay-${index}`, `Baía ${index + 1}`, [vip, status], [body, note]);
    frame.root.dataset.bay = String(index);
    frame.title.classList.add('standby-name');
    ui.standbyWidgets[`bay-${index}`] = frame;
    ui.standby.push({ root: frame.root, name: frame.title, status, vip, level, gold, xp, map, ram, updated, note, open, chartWrap });
  }

  ui.standbyWidgets.procs = buildStandbyWidget('procs', 'Recursos do app', [], buildProcsBody());

  // Bônus Twitch: o bloco geral e uma baía por widget vêm do live-bonus.js. Sem ele, cada moldura mostra o aviso.
  const twitch = typeof mountLiveBonusStandby === 'function' ? mountLiveBonusStandby() : null;
  ui.standbyWidgets.twitch = buildStandbyWidget('twitch', standbyLabel('twitch'), [], [corpoTwitch(twitch && twitch.geral)]);
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const id = `twitch-bay-${index}`;
    const card = twitch && twitch.bays ? twitch.bays[index] : null;
    let corpo = null;
    if (card) {
      corpo = el('ul', 'live-bonus-bays');
      corpo.append(card);
    }
    ui.standbyWidgets[id] = buildStandbyWidget(id, standbyLabel(id), [], [corpoTwitch(corpo)]);
  }

  // Calculadora de status: nasce oculta. Sem poke-calc.js, a moldura mostra o aviso.
  let calc = null;
  try {
    calc = typeof mountPokeCalc === 'function' ? mountPokeCalc() : null;
  } catch (erro) {
    console.error('Calculadora de status indisponível:', erro);
    calc = null;
  }
  ui.standbyWidgets.pokecalc = buildStandbyWidget('pokecalc', standbyLabel('pokecalc'), [], [calc ? calc.root : el('p', 'standby-note', 'Calculadora indisponível.')]);

  const toolbar = el('div', 'standby-toolbar');
  const toolbarWrap = el('div', 'standby-menu-wrap');
  const widgetsBtn = el('button', 'btn btn-sm btn-soft standby-widgets-btn', 'Widgets');
  widgetsBtn.type = 'button';
  widgetsBtn.setAttribute('aria-haspopup', 'menu');
  widgetsBtn.setAttribute('aria-expanded', 'false');
  const widgetsMenu = el('div', 'standby-menu-panel');
  widgetsMenu.hidden = true;
  widgetsMenu.setAttribute('role', 'menu');
  widgetsMenu.setAttribute('aria-label', 'Widgets da Espera');
  toolbarWrap.append(widgetsBtn, widgetsMenu);
  toolbar.append(toolbarWrap);
  bindStandbyMenuButton(widgetsBtn, widgetsMenu);
  ui.standbyWidgetsBtn = widgetsBtn;
  ui.standbyWidgetsMenu = widgetsMenu;

  ui.standbySr = el('div', 'standby-sr');
  ui.standbySr.setAttribute('role', 'status');
  ui.standbySr.setAttribute('aria-atomic', 'true');

  const board = el('section', 'standby-board');
  board.setAttribute('aria-label', 'Widgets da Espera');
  ui.standbyBoard = board;

  const empty = el('div', 'standby-empty');
  empty.hidden = true;
  const emptyShow = el('button', 'btn btn-sm btn-soft', 'Mostrar todos');
  emptyShow.type = 'button';
  emptyShow.addEventListener('click', showAllStandbyWidgets);
  empty.append(el('p', 'standby-empty-text', 'Todos os widgets estão ocultos.'), emptyShow);
  ui.standbyEmpty = empty;

  board.append(empty);
  for (const id of MesaStandbyLayout.ids) board.append(ui.standbyWidgets[id].root);

  const foot = el('footer', 'standby-foot');
  foot.append(
    el('p', 'standby-lead', 'O jogo fica fora da tela e o farm continua.'),
    el('p', 'standby-foot-note', 'Poção e ball podem reagir um pouco mais devagar.'),
  );
  parent.append(toolbar, ui.standbySr, board, foot);
  applyStandbyLayout();
  if (procsApiReady()) startProcsPolling();
  else setProcsEmpty('A leitura aparece no PokeIdle Automation.');
}

// Painel "Recursos do app": só CPU e memória por processo, o que o Electron informa.
const PROCS_INTERVAL_MS = 2000;
const PROCS_NUMERIC_KEYS = { pid: true, cpu: true, ramMb: true };
let procsState = { key: 'cpu', dir: 'desc' };
let procsUi = null;
let procsSnapshot = null;
let procsTimerOn = false;
let procsBusy = false;
let procsWasOn = false;

function procsApiReady() {
  return !!(window.mesa && typeof window.mesa.processes === 'function');
}

function fmtProcsOne(value) {
  return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function setProcsEmpty(message) {
  if (!procsUi) return;
  procsUi.empty.textContent = message;
  procsUi.empty.hidden = false;
  procsUi.totals.hidden = true;
  procsUi.wrap.hidden = true;
}

function buildProcsRow(row) {
  const tr = el('tr');
  tr.append(
    el('td', 'standby-procs-name', row.label),
    el('td', 'standby-procs-type', row.type || ''),
    el('td', 'num standby-procs-num', String(row.pid)),
    el('td', 'num standby-procs-num', `${fmtProcsOne(row.cpu)} %`),
    el('td', 'num standby-procs-num', MesaProcessTable.formatMb(row.ramMb)),
  );
  return tr;
}

function updateProcsHeads() {
  if (!procsUi) return;
  const ascending = procsState.dir === 'asc';
  procsUi.heads.forEach(({ th, arrow, key }) => {
    const active = procsState.key === key;
    th.setAttribute('aria-sort', active ? (ascending ? 'ascending' : 'descending') : 'none');
    arrow.textContent = active ? (ascending ? '↑' : '↓') : '';
  });
}

function paintProcs() {
  if (!procsUi || !procsSnapshot || !Array.isArray(procsSnapshot.rows)) return;
  const snap = procsSnapshot;
  const sum = MesaProcessTable.totals(snap.rows, snap.systemMemKb);
  procsUi.empty.hidden = true;
  procsUi.totals.hidden = false;
  procsUi.wrap.hidden = false;
  procsUi.cpu.textContent = `${fmtProcsOne(sum.cpu)} %`;
  procsUi.ram.textContent = MesaProcessTable.formatMb(sum.ramMb);
  procsUi.ramOf.textContent = sum.systemGb > 0 ? `de ${fmtProcsOne(sum.systemGb)} GB` : '';
  procsUi.count.textContent = String(sum.count);
  const sorted = MesaProcessTable.sortRows(snap.rows, procsState.key, procsState.dir);
  procsUi.body.replaceChildren(...sorted.map(buildProcsRow));
}

function sortProcsBy(key) {
  if (procsState.key === key) {
    procsState.dir = procsState.dir === 'asc' ? 'desc' : 'asc';
  } else {
    procsState.key = key;
    procsState.dir = PROCS_NUMERIC_KEYS[key] ? 'desc' : 'asc';
  }
  updateProcsHeads();
  paintProcs();
}

// Sem leitura quando o widget está oculto ou recolhido.
async function readProcs() {
  if (!procsApiReady() || procsBusy || !procsLive()) return;
  procsBusy = true;
  try {
    const snap = await window.mesa.processes();
    if (snap) {
      procsSnapshot = snap;
      paintProcs();
    }
  } catch { /* a próxima leitura tenta de novo */ } finally {
    procsBusy = false;
  }
}

function startProcsPolling() {
  if (procsTimerOn) return;
  procsTimerOn = true;
  setInterval(() => {
    if (cfg.view !== 'espera' || document.hidden || !procsLive()) return;
    readProcs();
  }, PROCS_INTERVAL_MS);
}

// Corpo do widget "Recursos do app". O título fica na barra do widget.
function buildProcsBody() {
  const empty = el('p', 'standby-procs-empty', 'Lendo processos…');
  empty.hidden = true;

  const totals = el('dl', 'standby-procs-totals');
  const cpuDd = el('dd', 'standby-procs-value');
  const ramDd = el('dd', 'standby-procs-value');
  const ram = el('b', 'num', '–');
  const ramOf = el('span', 'standby-procs-of');
  ramDd.append(ram, ramOf);
  const cpu = el('b', 'num', '–');
  cpuDd.append(cpu);
  const countDd = el('dd', 'standby-procs-value');
  const count = el('b', 'num', '–');
  countDd.append(count);
  totals.append(
    el('dt', null, 'CPU do app'), cpuDd,
    el('dt', null, 'Memória do app'), ramDd,
    el('dt', null, 'Processos'), countDd,
  );

  const wrap = el('div', 'standby-procs-scroll');
  const table = el('table', 'table table-sm standby-procs-table');
  table.setAttribute('aria-label', 'Processos do app');
  const thead = el('thead');
  const headRow = el('tr');
  const heads = [];
  [
    ['label', 'Processo', false],
    ['type', 'Tipo', false],
    ['pid', 'PID', true],
    ['cpu', 'CPU', true],
    ['ramMb', 'Memória', true],
  ].forEach(([key, label, numeric]) => {
    const classes = [numeric ? 'num' : '', key === 'type' ? 'standby-procs-type' : ''].filter(Boolean).join(' ');
    const th = el('th', classes || null);
    th.scope = 'col';
    const button = el('button', 'standby-procs-sort', label);
    button.type = 'button';
    const arrow = el('span', 'standby-procs-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    button.append(arrow);
    button.addEventListener('click', () => sortProcsBy(key));
    th.append(button);
    headRow.append(th);
    heads.push({ th, arrow, key });
  });
  thead.append(headRow);
  const body = el('tbody');
  table.append(thead, body);
  wrap.append(table);

  const note = el('p', 'standby-procs-note', 'GPU, disco e rede não são medidos por processo. O Electron só informa CPU e memória.');

  procsUi = { empty, totals, wrap, body, cpu, ram, ramOf, count, heads };
  updateProcsHeads();
  return [empty, totals, wrap, note];
}
