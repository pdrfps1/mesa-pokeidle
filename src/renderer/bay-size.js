/* Tamanho próprio de cada baía (disposição Livre). Grade, fila e coluna continuam em bay-split.js. */

const BAY_SIZE_GAP = 8;
const BAY_SIZE_KEY_STEP = 20;

function bayBoxOf(index) {
  const current = cfg.bays[index] && cfg.bays[index].box;
  return MESA_CATALOG.boxOf(current);
}

function setBayBox(index, patch) {
  cfg.bays[index].box = MESA_CATALOG.boxOf({ ...bayBoxOf(index), ...patch });
}

function clampBaySpan(value) {
  const box = MESA_CATALOG.box;
  return Math.min(box.spanMax, Math.max(box.spanMin, Math.round(value)));
}

// Largura de uma coluna da grade de 12, em px, medida no contêiner real.
function bayGridMetrics() {
  const width = ui.baysBox ? ui.baysBox.clientWidth : 0;
  const cols = 12;
  const col = Math.max(1, (width - BAY_SIZE_GAP * (cols - 1)) / cols);
  return { col, gap: BAY_SIZE_GAP };
}

// Aplica span e altura nas variáveis CSS de cada baía. Só o layout Livre usa essas variáveis.
function paintBayBoxes() {
  if (!ui.bays) return;
  ui.bays.forEach((bay, index) => {
    const box = bayBoxOf(index);
    bay.root.style.setProperty('--bay-span', String(box.span));
    if (box.h > 0) bay.root.style.setProperty('--bay-h', `${box.h}px`);
    else bay.root.style.removeProperty('--bay-h');
  });
}

// Alça no canto inferior direito de cada baía: arrastar ou setas do teclado.
function mountBayGrip(index) {
  const grip = document.createElement('span');
  grip.className = 'bay-grip';
  grip.tabIndex = 0;
  grip.setAttribute('role', 'button');
  grip.setAttribute('aria-label', `Redimensionar ${titleOf(index)}`);
  grip.title = 'Arraste para mudar a largura e a altura desta baía (disposição Livre)';

  grip.addEventListener('pointerdown', (event) => {
    if (cfg.layout !== 'livre' || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pointer = event.pointerId;
    const rect = ui.bays[index].root.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, box: { ...bayBoxOf(index) } };
    grip.setPointerCapture(pointer);
    grip.classList.add('is-dragging');

    const onMove = (move) => {
      const dx = move.clientX - start.x;
      const dy = move.clientY - start.y;
      const { col, gap } = bayGridMetrics();
      const span = clampBaySpan((start.width + dx + gap) / (col + gap));
      const h = dy === 0 ? start.box.h : MESA_CATALOG.boxHeight(Math.max(1, start.height + dy));
      cfg.bays[index].box = { span, h };
      paintBayBoxes();
    };
    const finish = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', finish);
      grip.removeEventListener('pointercancel', finish);
      grip.classList.remove('is-dragging');
      if (grip.hasPointerCapture(pointer)) grip.releasePointerCapture(pointer);
      const after = bayBoxOf(index);
      if (after.span !== start.box.span || after.h !== start.box.h) {
        save();
        paint();
      } else {
        paintBayBoxes();
      }
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', finish);
    grip.addEventListener('pointercancel', finish);
  });

  grip.addEventListener('keydown', (event) => {
    if (cfg.layout !== 'livre') return;
    const box = bayBoxOf(index);
    const rect = ui.bays[index].root.getBoundingClientRect();
    const currentH = box.h || Math.round(rect.height);
    let next = null;
    if (event.key === 'ArrowRight') next = { span: box.span + 1, h: box.h };
    else if (event.key === 'ArrowLeft') next = { span: box.span - 1, h: box.h };
    else if (event.key === 'ArrowDown') next = { span: box.span, h: MESA_CATALOG.boxHeight(currentH + BAY_SIZE_KEY_STEP) };
    else if (event.key === 'ArrowUp') next = { span: box.span, h: MESA_CATALOG.boxHeight(currentH - BAY_SIZE_KEY_STEP) };
    else if (event.key === 'Home') next = { span: box.span, h: 0 };
    if (!next) return;
    event.preventDefault();
    cfg.bays[index].box = { span: clampBaySpan(next.span), h: next.h };
    save();
    paint();
  });
  return grip;
}

// Controles da baía em foco, na coluna "Baía em foco": largura por atalhos e altura por controle deslizante.
function mountBaySizeControls() {
  const box = el('div', 'bay-size');
  box.setAttribute('aria-label', 'Tamanho da baía em foco');

  const widthRow = el('div', 'bay-size-row');
  widthRow.append(el('span', 'bay-size-name', 'Largura'));
  const chips = el('div', 'join bay-size-chips');
  ui.sizeChips = [];
  for (const preset of MESA_CATALOG.box.presets) {
    const chip = el('button', 'join-item btn btn-xs', preset.label);
    chip.type = 'button';
    chip.dataset.span = String(preset.span);
    chip.addEventListener('click', () => {
      setBayBox(cfg.selected, { span: preset.span });
      save();
      paint();
    });
    ui.sizeChips.push(chip);
    chips.append(chip);
  }
  ui.sizeUse = el('button', 'btn btn-xs btn-soft', 'Usar Livre');
  ui.sizeUse.type = 'button';
  ui.sizeUse.title = 'Muda a disposição para Livre, onde cada baía tem o próprio tamanho';
  ui.sizeUse.addEventListener('click', () => { cfg.layout = 'livre'; save(); paint(); });
  widthRow.append(chips, ui.sizeUse);

  const heightRow = el('div', 'bay-size-row');
  heightRow.append(el('span', 'bay-size-name', 'Altura'));
  ui.sizeRange = el('input', 'range range-xs range-accent limiar-range');
  ui.sizeRange.type = 'range';
  ui.sizeRange.min = String(MESA_CATALOG.box.heightMin);
  ui.sizeRange.max = String(MESA_CATALOG.box.heightMax);
  ui.sizeRange.step = String(MESA_CATALOG.box.heightStep);
  ui.sizeRange.setAttribute('aria-label', 'Altura da baía em foco');
  ui.sizeOut = el('b', 'num bay-size-out', '–');
  ui.sizeRange.addEventListener('input', () => {
    setBayBox(cfg.selected, { h: Number(ui.sizeRange.value) });
    paintBayBoxes();
    syncRangeFill(ui.sizeRange);
    ui.sizeOut.textContent = `${bayBoxOf(cfg.selected).h} px`;
  });
  ui.sizeRange.addEventListener('change', () => { save(); paint(); });
  ui.sizeAuto = el('button', 'btn btn-xs btn-ghost', 'Automática');
  ui.sizeAuto.type = 'button';
  ui.sizeAuto.title = 'Deixa a altura pelo conteúdo';
  ui.sizeAuto.addEventListener('click', () => {
    setBayBox(cfg.selected, { h: 0 });
    save();
    paint();
  });
  heightRow.append(ui.sizeRange, ui.sizeOut, ui.sizeAuto);

  ui.sizeNote = el('p', 'bay-size-note', 'Tamanho próprio por baía só no modo Livre.');
  box.append(ui.sizeNote, widthRow, heightRow);
  ui.sizeBox = box;
  return box;
}

function paintBaySize() {
  if (!ui.sizeBox) return;
  const free = cfg.layout === 'livre';
  ui.sizeBox.classList.toggle('is-off', !free);
  ui.sizeUse.hidden = free;
  if (ui.sizeNote) ui.sizeNote.hidden = free;
  const box = bayBoxOf(cfg.selected);
  for (const chip of ui.sizeChips) {
    const on = Number(chip.dataset.span) === box.span;
    chip.classList.toggle('btn-active', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    chip.disabled = !free;
  }
  ui.sizeRange.disabled = !free;
  ui.sizeAuto.disabled = !free;
  ui.sizeRange.value = String(box.h || 340);
  syncRangeFill(ui.sizeRange);
  ui.sizeOut.textContent = box.h ? `${box.h} px` : '–';
  ui.sizeAuto.classList.toggle('btn-active', box.h === 0);
  ui.sizeAuto.setAttribute('aria-pressed', box.h === 0 ? 'true' : 'false');
}
