/* Proporção da grade (bayWeights). Não é cfg.bays[i].scale. */

var baySplit = { signature: '', drag: null, ro: null };

function baySplitNarrow() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;
}

function baySplitTemplate(weights) {
  return weights.map((w) => `minmax(0, ${w}fr)`).join(' ');
}

function baySplitAxisStore(layout, axis) {
  if (!cfg.bayWeights) cfg.bayWeights = MESA_CATALOG.normalize({}).bayWeights;
  const bucket = cfg.bayWeights[layout];
  if (layout === 'fila') return bucket.cols;
  if (layout === 'coluna') return bucket.rows;
  return bucket[axis];
}

function baySplitPrefix(weights, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) out.push(weights[i] ?? 1);
  return out;
}

function baySplitTrackCount(spec, arr) {
  const placed = placedIndexes().length;
  if (spec.axis === 'cols' && cfg.layout === 'fila') return placed;
  if (spec.axis === 'rows' && cfg.layout === 'coluna') return placed;
  return arr.length;
}

function baySplitMinFraction(count, axisPx, headerPx) {
  let minF = 0.18;
  if (axisPx > 0 && headerPx > 0) minF = Math.max(minF, headerPx / axisPx);
  if (count * minF > 1) minF = 1 / count;
  return minF;
}

function baySplitHeaderPx() {
  if (!ui.bays) return 0;
  for (const bay of ui.bays) {
    if (bay.root.hidden) continue;
    const top = bay.root.querySelector('.bay-top');
    if (top) return top.getBoundingClientRect().height;
  }
  return 0;
}

function baySplitSpecs() {
  const layout = cfg.layout;
  const count = placedIndexes().length;
  const specs = [];
  if (count <= 1) return specs;
  // Livre: cada baía tem o próprio tamanho (bay-size.js), sem divisórias compartilhadas.
  if (layout === 'livre') return specs;
  if (layout === 'fila') {
    for (let i = 0; i < count - 1; i += 1) {
      specs.push({ id: `fila-c${i}`, axis: 'cols', index: i, orient: 'vertical', left: i, right: i + 1 });
    }
    return specs;
  }
  if (layout === 'coluna') {
    for (let i = 0; i < count - 1; i += 1) {
      specs.push({ id: `col-r${i}`, axis: 'rows', index: i, orient: 'horizontal', top: i, bottom: i + 1 });
    }
    return specs;
  }
  if (count >= 2) specs.push({ id: 'grade-c0', axis: 'cols', index: 0, orient: 'vertical', left: 0, right: 1, short: count === 3 });
  if (count >= 3) specs.push({ id: 'grade-r0', axis: 'rows', index: 0, orient: 'horizontal', top: 0, bottom: 1 });
  return specs;
}

function baySplitSignature() {
  const indexes = placedIndexes();
  const span = cfg.layout === 'grade' && indexes.length === 3 ? indexes[indexes.length - 1] : -1;
  return `${cfg.layout}|${indexes.join(',')}|${span}|${baySplitSpecs().map((s) => s.id).join(',')}`;
}

function baySplitPaintVars() {
  if (!ui.baysBox) return;
  const layout = cfg.layout;
  const count = placedIndexes().length;
  if (baySplitNarrow() || count <= 1) {
    ui.baysBox.style.removeProperty('--bay-cols');
    ui.baysBox.style.removeProperty('--bay-rows');
    return;
  }
  if (layout === 'fila') {
    ui.baysBox.style.setProperty('--bay-cols', baySplitTemplate(baySplitPrefix(baySplitAxisStore('fila', 'cols'), count)));
    ui.baysBox.style.removeProperty('--bay-rows');
    return;
  }
  if (layout === 'coluna') {
    ui.baysBox.style.setProperty('--bay-rows', baySplitTemplate(baySplitPrefix(baySplitAxisStore('coluna', 'rows'), count)));
    ui.baysBox.style.removeProperty('--bay-cols');
    return;
  }
  if (count >= 2) ui.baysBox.style.setProperty('--bay-cols', baySplitTemplate(baySplitAxisStore('grade', 'cols')));
  else ui.baysBox.style.removeProperty('--bay-cols');
  if (count >= 3) ui.baysBox.style.setProperty('--bay-rows', baySplitTemplate(baySplitAxisStore('grade', 'rows')));
  else ui.baysBox.style.removeProperty('--bay-rows');
}

function baySplitRowSpan(nodes) {
  return nodes.reduce((acc, bay) => {
    const r = bay.root.getBoundingClientRect();
    return acc ? { top: Math.min(acc.top, r.top), bottom: Math.max(acc.bottom, r.bottom) } : { top: r.top, bottom: r.bottom };
  }, null);
}

function baySplitGapPx() {
  return Math.max(parseFloat(getComputedStyle(ui.baysBox).gap) || 16, 8);
}

function baySplitRectPair(spec) {
  const visible = ui.bays.filter((bay) => !bay.root.hidden);
  const thick = baySplitGapPx();
  const grid = ui.baysBox.getBoundingClientRect();
  if (spec.orient === 'vertical') {
    const left = visible[spec.left];
    const right = visible[spec.right];
    if (!left || !right) return null;
    const a = left.root.getBoundingClientRect();
    const b = right.root.getBoundingClientRect();
    const x = (a.right + b.left) / 2;
    const top = spec.short ? Math.min(a.top, b.top) : grid.top;
    const bottom = spec.short ? Math.max(a.bottom, b.bottom) : grid.bottom;
    const h = bottom - top;
    return { x, y: top + h / 2, w: thick, h, axisPx: grid.width };
  }
  const count = visible.length;
  if (cfg.layout === 'coluna') {
    const topBay = visible[spec.top];
    const bottomBay = visible[spec.bottom];
    if (!topBay || !bottomBay) return null;
    const a = topBay.root.getBoundingClientRect();
    const b = bottomBay.root.getBoundingClientRect();
    const y = (a.bottom + b.top) / 2;
    return { x: grid.left + grid.width / 2, y, w: grid.width, h: thick, axisPx: grid.height };
  }
  const topNodes = cfg.layout === 'grade' && count === 3
    ? [visible[0], visible[1]]
    : [visible[spec.top * 2], visible[spec.top * 2 + 1]].filter(Boolean);
  const bottomNodes = cfg.layout === 'grade' && count === 3
    ? [visible[2]]
    : [visible[spec.bottom * 2], visible[spec.bottom * 2 + 1]].filter(Boolean);
  const topRect = baySplitRowSpan(topNodes);
  const bottomRect = baySplitRowSpan(bottomNodes);
  if (!topRect || !bottomRect) return null;
  const y = (topRect.bottom + bottomRect.top) / 2;
  return { x: grid.left + grid.width / 2, y, w: grid.width, h: thick, axisPx: grid.height };
}

function baySplitObstacleRects(bay) {
  if (!bay) return [];
  const out = [];
  const actions = bay.root.querySelector('.bay-actions');
  if (actions && !actions.hidden) {
    const r = actions.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push(r);
  }
  const rename = bay.root.querySelector('input.rename');
  if (rename && !rename.hidden && rename.offsetParent !== null) {
    const r = rename.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push(r);
  }
  return out;
}

function baySplitSepNeighborBays(spec) {
  const visible = ui.bays.filter((bay) => !bay.root.hidden);
  if (spec.orient === 'vertical') {
    return [visible[spec.left], visible[spec.right]].filter(Boolean);
  }
  const count = visible.length;
  if (cfg.layout === 'coluna') {
    return [visible[spec.bottom]].filter(Boolean);
  }
  if (cfg.layout === 'grade' && count === 3) return [visible[2]].filter(Boolean);
  return [visible[spec.bottom * 2], visible[spec.bottom * 2 + 1]].filter(Boolean);
}

function baySplitRectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Recorta a alça para não cobrir .bay-actions / input.rename nas baías vizinhas. */
function baySplitSepLayoutBox(spec, rect, wrap) {
  const cx = rect.x;
  const cy = rect.y;
  let left = cx - rect.w / 2;
  let right = cx + rect.w / 2;
  let top = cy - rect.h / 2;
  let bottom = cy + rect.h / 2;
  const sep = { left, top, right, bottom };
  for (const bay of baySplitSepNeighborBays(spec)) {
    for (const ob of baySplitObstacleRects(bay)) {
      if (spec.orient === 'vertical') top = Math.max(top, ob.bottom);
      else if (baySplitRectsOverlap(sep, ob)) bottom = Math.min(bottom, ob.top);
    }
  }
  const height = bottom - top;
  const width = right - left;
  if (height <= 0 || width <= 0) return null;
  return {
    left: left - wrap.left,
    top: top - wrap.top,
    width,
    height,
  };
}

function baySplitAriaNow(spec) {
  const arr = baySplitAxisStore(cfg.layout, spec.axis);
  const sum = arr[spec.index] + arr[spec.index + 1];
  return sum > 0 ? Math.round((arr[spec.index] / sum) * 100) : 50;
}

function baySplitEqualAxis(spec) {
  const arr = baySplitAxisStore(cfg.layout, spec.axis);
  for (let i = 0; i < arr.length; i += 1) arr[i] = 1;
  baySplitPaintVars();
  baySplitLayoutSeparators(true);
  save();
}

function baySplitAdjustPair(spec, deltaPx, axisPx) {
  if (!Number.isFinite(deltaPx) || axisPx <= 0) return;
  const arr = baySplitAxisStore(cfg.layout, spec.axis);
  const i = spec.index;
  const count = baySplitTrackCount(spec, arr);
  let sumActive = 0;
  for (let k = 0; k < count; k += 1) sumActive += arr[k];
  if (sumActive <= 0) return;
  const pairSum = arr[i] + arr[i + 1];
  const minW = baySplitMinFraction(count, axisPx, baySplitHeaderPx()) * sumActive;
  if (pairSum < 2 * minW) return;
  let left = arr[i] + (deltaPx / axisPx) * sumActive;
  left = Math.max(minW, Math.min(left, pairSum - minW));
  arr[i] = left;
  arr[i + 1] = pairSum - left;
  baySplitPaintVars();
  baySplitLayoutSeparators(true);
}

function baySplitKeyboardStep(spec, direction) {
  const box = ui.baysBox.getBoundingClientRect();
  const axisPx = spec.orient === 'vertical' ? box.width : box.height;
  const sign = spec.orient === 'vertical' ? (direction === 'left' ? -1 : 1) : (direction === 'up' ? -1 : 1);
  baySplitAdjustPair(spec, sign * axisPx * 0.05, axisPx);
  const sep = ui.baysWrap && ui.baysWrap.querySelector(`[data-sep-id="${spec.id}"]`);
  if (sep) sep.setAttribute('aria-valuenow', String(baySplitAriaNow(spec)));
  save();
}

function baySplitStartDrag(spec, event) {
  event.stopPropagation();
  event.preventDefault();
  event.target.setPointerCapture(event.pointerId);
  baySplit.drag = { spec, id: event.pointerId, last: spec.orient === 'vertical' ? event.clientX : event.clientY };
  event.target.classList.add('is-dragging');
  document.body.classList.add('is-bay-split-drag');
  if (spec.orient === 'horizontal') document.body.classList.add('is-bay-split-drag-row');
}

function baySplitMoveDrag(event) {
  if (!baySplit.drag || event.pointerId !== baySplit.drag.id) return;
  const spec = baySplit.drag.spec;
  const box = ui.baysBox.getBoundingClientRect();
  const axisPx = spec.orient === 'vertical' ? box.width : box.height;
  const now = spec.orient === 'vertical' ? event.clientX : event.clientY;
  const delta = now - baySplit.drag.last;
  baySplit.drag.last = now;
  baySplitAdjustPair(spec, delta, axisPx);
  const sep = event.target.closest('[role="separator"]');
  if (sep) sep.setAttribute('aria-valuenow', String(baySplitAriaNow(spec)));
}

function baySplitEndDrag(event) {
  if (!baySplit.drag || event.pointerId !== baySplit.drag.id) return;
  const sep = event.target.closest('[role="separator"]');
  if (sep) sep.classList.remove('is-dragging');
  document.body.classList.remove('is-bay-split-drag', 'is-bay-split-drag-row');
  baySplit.drag = null;
  save();
}

function baySplitMakeSep(spec) {
  const sep = el('button', 'bay-split-sep');
  sep.type = 'button';
  sep.setAttribute('role', 'separator');
  sep.tabIndex = 0;
  sep.dataset.sepId = spec.id;
  sep.classList.toggle('is-row', spec.orient === 'horizontal');
  sep.setAttribute('aria-orientation', spec.orient === 'vertical' ? 'vertical' : 'horizontal');
  sep.setAttribute('aria-valuemin', '18');
  sep.setAttribute('aria-valuemax', '82');
  sep.setAttribute('aria-valuenow', String(baySplitAriaNow(spec)));
  sep.setAttribute('aria-label', spec.orient === 'vertical' ? 'Ajustar largura das baías' : 'Ajustar altura das baías');
  sep.addEventListener('pointerdown', (event) => baySplitStartDrag(spec, event));
  sep.addEventListener('pointermove', baySplitMoveDrag);
  sep.addEventListener('pointerup', baySplitEndDrag);
  sep.addEventListener('pointercancel', baySplitEndDrag);
  sep.addEventListener('dblclick', (event) => { event.stopPropagation(); event.preventDefault(); baySplitEqualAxis(spec); });
  sep.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); baySplitEqualAxis(spec); return; }
    if (spec.orient === 'vertical' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      baySplitKeyboardStep(spec, event.key === 'ArrowLeft' ? 'left' : 'right');
      return;
    }
    if (spec.orient === 'horizontal' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      baySplitKeyboardStep(spec, event.key === 'ArrowUp' ? 'up' : 'down');
    }
  });
  return sep;
}

function baySplitLayoutSeparators(keepFocus) {
  if (!ui.baysWrap || !ui.baysBox) return;
  const specs = baySplitSpecs();
  if (baySplitNarrow() || !specs.length) {
    ui.baysWrap.querySelectorAll('.bay-split-sep').forEach((node) => node.remove());
    return;
  }
  const wrap = ui.baysWrap.getBoundingClientRect();
  const active = document.activeElement;
  const activeId = keepFocus && active && active.classList && active.classList.contains('bay-split-sep') ? active.dataset.sepId : '';
  const existing = new Map();
  ui.baysWrap.querySelectorAll('.bay-split-sep').forEach((node) => { existing.set(node.dataset.sepId, node); });
  const next = new Set(specs.map((s) => s.id));
  existing.forEach((node, id) => { if (!next.has(id)) node.remove(); });
  for (const spec of specs) {
    const rect = baySplitRectPair(spec);
    if (!rect) continue;
    const box = baySplitSepLayoutBox(spec, rect, wrap);
    let sep = existing.get(spec.id);
    if (!box) {
      if (sep) sep.hidden = true;
      continue;
    }
    if (!sep) { sep = baySplitMakeSep(spec); ui.baysWrap.append(sep); }
    sep.hidden = false;
    sep.style.left = `${box.left}px`;
    sep.style.top = `${box.top}px`;
    sep.style.width = `${box.width}px`;
    sep.style.height = `${box.height}px`;
    sep.hidden = false;
    sep.setAttribute('aria-valuenow', String(baySplitAriaNow(spec)));
  }
  if (activeId) {
    const again = ui.baysWrap.querySelector(`[data-sep-id="${activeId}"]`);
    if (again) again.focus();
  }
}

function baySplitEnsureObserver() {
  if (!ui.baysBox || typeof ResizeObserver !== 'function' || baySplit.ro) return;
  baySplit.ro = new ResizeObserver(() => { baySplitPaintVars(); baySplitLayoutSeparators(true); });
  baySplit.ro.observe(ui.baysBox);
}

function applyBaySplitWeights() {
  if (!ui.baysBox) return;
  baySplitEnsureObserver();
  baySplit.signature = baySplitSignature();
  baySplitPaintVars();
  baySplitLayoutSeparators(true);
}
