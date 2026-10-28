function placedIndexes() {
  const indexes = [];
  cfg.bays.forEach((bay, index) => {
    if (bay.placed !== false) indexes.push(index);
  });
  return indexes;
}

function bayAwayButton(index) {
  const button = el('button', 'text-btn', 'Tirar');
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

function mountAway(parent) {
  ui.awayBar = el('div', 'away-bar');
  ui.awayBar.hidden = true;
  ui.awayList = el('div', 'layouts');
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
    const button = el('button', 'text-btn', titleOf(index));
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
}
