function placedIndexes() {
  const indexes = [];
  cfg.bays.forEach((bay, index) => {
    if (bay.placed !== false) indexes.push(index);
  });
  return indexes;
}

function bayAwayButton(index) {
  const button = el('button', 'btn btn-sm btn-outline', 'Tirar');
  button.type = 'button';
  button.dataset.icon = 'tirar';
  button.title = 'Tira esta baía da grade. O login continua guardado.';
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    unplaceBay(index);
  });
  return button;
}

function unplaceBay(index) {
  const staying = placedIndexes();
  if (staying.length <= 1 || !staying.includes(index)) return;
  cfg.bays[index].placed = false;
  if (typeof releaseGame === 'function') releaseGame(index);
  live[index].phase = cfg.bays[index].open === false ? 'fechada' : 'fora';
  if (cfg.selected === index) {
    const next = placedIndexes()[0];
    cfg.selected = next == null ? 0 : next;
  }
  save();
  paint();
}

function placeBay(index) {
  if (!cfg.bays[index] || cfg.bays[index].placed !== false) return;
  cfg.bays[index].placed = true;
  if (cfg.bays[index].open !== false) live[index].phase = 'fila';
  save();
  paint();
  if (cfg.bays[index].open !== false && typeof ensureGame === 'function') ensureGame(index, false);
}

function mountBayPlacedBar(parent) {
  ui.bayPlacedBar = el('div', 'bay-placed-bar');
  ui.bayPlacedBar.append(el('span', 'control-label', 'Na grade'));
  ui.bayPlacedRow = el('div', 'bay-placed-row');
  ui.bayPlacedChecks = [];
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const label = el('label', 'label cursor-pointer gap-2');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'checkbox checkbox-success checkbox-md';
    input.setAttribute('aria-label', `Baía ${index + 1} na grade`);
    const bayIndex = index;
    input.addEventListener('change', () => {
      if (input.checked) placeBay(bayIndex);
      else unplaceBay(bayIndex);
      syncBayPlacedChecks();
    });
    label.append(input, document.createTextNode(`Baía ${index + 1}`));
    ui.bayPlacedChecks.push(input);
    ui.bayPlacedRow.append(label);
  }
  ui.bayPlacedBar.append(ui.bayPlacedRow);
  if (typeof mountLayoutJoin === 'function') {
    ui.layoutsBar = {};
    const layoutGroup = el('div', 'bay-layout-group');
    layoutGroup.append(el('span', 'control-label', 'Disposição'), mountLayoutJoin(ui.layoutsBar, 'btn-xs'));
    ui.bayPlacedBar.append(layoutGroup);
  }
  parent.prepend(ui.bayPlacedBar);
}

function syncBayPlacedChecks() {
  if (!ui.bayPlacedChecks) return;
  const staying = placedIndexes();
  const onlyOne = staying.length <= 1;
  ui.bayPlacedChecks.forEach((input, index) => {
    const on = cfg.bays[index].placed !== false;
    input.checked = on;
    input.disabled = on && onlyOne;
  });
}

function mountAway(parent) {
  ui.awayBar = el('div', 'away-bar');
  ui.awayBar.hidden = true;
  ui.awayList = el('div', 'join');
  ui.awayBar.append(el('span', 'control-label', 'Fora da grade'), ui.awayList);
  parent.append(ui.awayBar);
}

function paintBayGrid() {
  if (!ui.baysBox) return;
  const indexes = placedIndexes();
  ui.baysBox.dataset.count = String(indexes.length);
  ui.baysBox.style.setProperty('--bay-count', String(Math.max(1, indexes.length)));
  const span = cfg.layout === 'grade' && indexes.length === 3 ? indexes[indexes.length - 1] : -1;
  ui.bays.forEach((bay, index) => {
    bay.root.classList.toggle('is-span', index === span);
  });
  if (typeof applyBaySplitWeights === 'function') applyBaySplitWeights();
}

function paintAway() {
  if (!ui.awayList) return;
  const away = [];
  cfg.bays.forEach((bay, index) => {
    if (bay.placed === false) away.push(index);
  });
  ui.awayBar.hidden = away.length === 0;
  const signature = away.map((index) => `${index}:${titleOf(index)}`).join('|');
  if (ui.awayList.dataset.signature === signature) return;
  ui.awayList.dataset.signature = signature;
  ui.awayList.replaceChildren();
  away.forEach((index) => {
    const button = el('button', 'join-item btn btn-sm', titleOf(index));
    button.type = 'button';
    button.dataset.icon = 'voltar';
    button.title = 'Coloca esta baía de volta na grade';
    button.addEventListener('click', () => placeBay(index));
    ui.awayList.append(button);
  });
}

function paintSlots() {
  paintBayGrid();
  paintAway();
  syncBayPlacedChecks();
}
