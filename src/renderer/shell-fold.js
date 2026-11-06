// Abaixo de 1100px o console é só a barra de abas e a seção abre numa folha sobre as baías.
// O estado dessa folha é da sessão (ui.opNarrowOpen); cfg.chrome.opExpanded vale só para a janela larga.
const OP_NARROW_MQ = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 1099px)')
  : null;

function opSheetNarrow() {
  return !!(OP_NARROW_MQ && OP_NARROW_MQ.matches);
}

function opSheetSet(open) {
  ui.opNarrowOpen = open === true;
  syncShellFold();
}

function opSheetOutside(target) {
  if (!ui.opCard || !target || ui.opCard.contains(target)) return false;
  return !(target.closest && target.closest('.bay-top'));
}

function shellFoldExpanded(value) {
  return value !== false;
}

function syncShellFold() {
  const root = document.getElementById('app');
  if (!root || !cfg.chrome) return;
  const railOpen = shellFoldExpanded(cfg.chrome.railExpanded);
  root.classList.remove('is-rail-collapsed');
  if (ui.railFoldBtn) {
    ui.railFoldBtn.setAttribute('aria-expanded', railOpen ? 'true' : 'false');
    ui.railFoldBtn.setAttribute('aria-label', railOpen ? 'Recolher trilho' : 'Abrir trilho');
    ui.railFoldBtn.dataset.icon = railOpen ? 'chevron-esquerda' : 'chevron-direita';
    ui.railFoldBtn.innerHTML = mesaIcon(railOpen ? 'chevron-esquerda' : 'chevron-direita');
  }
  const opOpen = opSheetNarrow() ? ui.opNarrowOpen === true : shellFoldExpanded(cfg.chrome.opExpanded);
  if (ui.opCard) ui.opCard.classList.toggle('is-op-collapsed', !opOpen);
  if (ui.opFoldBtn) {
    const label = opOpen ? 'Recolher painel' : 'Abrir painel';
    ui.opFoldBtn.setAttribute('aria-expanded', opOpen ? 'true' : 'false');
    ui.opFoldBtn.setAttribute('aria-label', label);
    ui.opFoldBtn.title = label;
    if (!ui.opFoldBtn.querySelector('svg')) ui.opFoldBtn.innerHTML = mesaIcon('chevron-direita');
  }
  const cols = cfg.chrome.columnsExpanded || {};
  const map = [
    ['autos', ui.colAutos],
    ['focus', ui.colFocus],
    ['account', ui.colAccount],
  ];
  for (const [key, col] of map) {
    if (!col) continue;
    const open = shellFoldExpanded(cols[key]);
    col.classList.toggle('is-col-collapsed', !open);
    const btn = ui.colFoldBtns && ui.colFoldBtns[key];
    const body = ui.colBodies && ui.colBodies[key];
    if (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      const labels = {
        autos: ['Recolher Automações', 'Abrir Automações'],
        focus: ['Recolher Baía em foco', 'Abrir Baía em foco'],
        account: ['Recolher Conta', 'Abrir Conta'],
      };
      btn.setAttribute('aria-label', open ? labels[key][0] : labels[key][1]);
      btn.dataset.icon = open ? 'chevron-cima' : 'chevron-baixo';
      btn.innerHTML = mesaIcon(open ? 'chevron-cima' : 'chevron-baixo');
    }
    if (body) body.hidden = !open;
  }
}

function shellFoldToggleRail() {
  if (!cfg.chrome) cfg.chrome = MESA_CATALOG.normalize({}).chrome;
  cfg.chrome.railExpanded = cfg.chrome.railExpanded === false;
  save();
  syncShellFold();
}

function shellFoldToggleOp() {
  if (opSheetNarrow()) { opSheetSet(ui.opNarrowOpen !== true); return; }
  if (!cfg.chrome) cfg.chrome = MESA_CATALOG.normalize({}).chrome;
  cfg.chrome.opExpanded = cfg.chrome.opExpanded === false;
  save();
  syncShellFold();
}

function shellFoldToggleColumn(key) {
  if (!cfg.chrome) cfg.chrome = MESA_CATALOG.normalize({}).chrome;
  if (!cfg.chrome.columnsExpanded) cfg.chrome.columnsExpanded = { autos: true, focus: true, account: true };
  cfg.chrome.columnsExpanded[key] = cfg.chrome.columnsExpanded[key] === false;
  save();
  syncShellFold();
}

function bindShellFoldButtons() {
  if (bindShellFoldButtons.done) return;
  bindShellFoldButtons.done = true;
  if (ui.railFoldBtn) ui.railFoldBtn.addEventListener('click', shellFoldToggleRail);
  if (ui.opFoldBtn) ui.opFoldBtn.addEventListener('click', shellFoldToggleOp);
  ui.colFoldBtns = ui.colFoldBtns || {};
  for (const key of ['autos', 'focus', 'account']) {
    const btn = ui.colFoldBtns[key];
    if (btn) btn.addEventListener('click', () => shellFoldToggleColumn(key));
  }
  bindOpSheetDismiss();
}

// Campo de digitação: Esc nele cancela a edição, não fecha a folha.
function opSheetTypingField(el) {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName === 'INPUT') {
    const type = String(el.type || 'text').toLowerCase();
    return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file'].includes(type);
  }
  return false;
}

function bindOpSheetDismiss() {
  const open = () => opSheetNarrow() && ui.opNarrowOpen === true;
  document.addEventListener('pointerdown', (event) => {
    if (open() && opSheetOutside(event.target)) opSheetSet(false);
  }, true);
  document.addEventListener('focusin', (event) => {
    if (open() && opSheetOutside(event.target)) opSheetSet(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !open()) return;
    // event.target continua sendo o input mesmo depois de removido do DOM pelo próprio handler.
    if (opSheetTypingField(event.target)) return;
    const active = document.activeElement;
    const inside = !!(active && ui.opCard && ui.opCard.contains(active));
    if (!inside && active && active !== document.body) return;
    opSheetSet(false);
    const tab = inside && ui.opGrid && ui.opTabBtns ? ui.opTabBtns[ui.opGrid.dataset.tab] : null;
    if (tab) tab.focus();
  });
  // Clique dentro do jogo: o foco vai para o <webview> e a casca perde o foco.
  window.addEventListener('blur', () => {
    setTimeout(() => {
      const active = document.activeElement;
      if (open() && active && active.tagName === 'WEBVIEW') opSheetSet(false);
    }, 0);
  });
  if (OP_NARROW_MQ) {
    OP_NARROW_MQ.addEventListener('change', () => {
      ui.opNarrowOpen = false;
      syncShellFold();
      if (typeof syncOpTabInk === 'function') syncOpTabInk();
    });
  }
}

function mountShellFold() {
  bindShellFoldButtons();
  syncShellFold();
}
