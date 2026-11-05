const STANDBY_MARK = ['gota', 'folha', 'fantasma', 'estrela'];

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

function paintStandbyHistoryChart(wrap, points, bayIndex) {
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

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  const gradId = `standby-fill-${bayIndex}`;
  grad.setAttribute('id', gradId);
  grad.setAttribute('x1', '0');
  grad.setAttribute('y1', '0');
  grad.setAttribute('x2', '0');
  grad.setAttribute('y2', '1');
  const stopA = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stopA.setAttribute('offset', '0%');
  stopA.setAttribute('stop-color', 'currentColor');
  stopA.setAttribute('stop-opacity', '0.35');
  const stopB = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stopB.setAttribute('offset', '100%');
  stopB.setAttribute('stop-color', 'currentColor');
  stopB.setAttribute('stop-opacity', '0.02');
  grad.append(stopA, stopB);
  defs.append(grad);
  svg.append(defs);

  const linePoints = points.map((point) => `${xAt(point.t).toFixed(2)},${yAt(point.xpH).toFixed(2)}`);
  const areaPoints = [
    `${xAt(points[0].t).toFixed(2)},${baseline.toFixed(2)}`,
    ...linePoints,
    `${xAt(points[points.length - 1].t).toFixed(2)},${baseline.toFixed(2)}`,
  ].join(' ');

  const area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  area.setAttribute('points', areaPoints);
  area.setAttribute('fill', `url(#${gradId})`);
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

function paintStandby() {
  if (!ui.standby || cfg.view !== 'espera') return;
  ui.standby.forEach((card, index) => {
    const status = statusOf(index);
    const placed = cfg.bays[index].placed !== false;
    const note = [standbyPlace(index), placed ? (typeof MesaAutoHunt !== 'undefined' && MesaAutoHunt.line ? MesaAutoHunt.line(index) : '') : ''].filter(Boolean).join(' ');
    card.name.textContent = titleOf(index);
    card.status.textContent = placed ? status.word : 'fora';
    card.status.className = 'standby-status';
    if (card.root) card.root.dataset.tone = placed ? status.tone : 'off';
    card.level.textContent = live[index].loggedIn && live[index].level ? live[index].level : '\u2013';
    card.gold.textContent = live[index].loggedIn && live[index].gold ? live[index].gold : '\u2013';
    card.xp.textContent = MesaStatus.fmtXp(placed && live[index].loggedIn ? live[index].rate : null).text;
    card.map.textContent = placed ? (mapOf(index) || '\u2013') : '\u2013';
    card.ram.textContent = !placed || live[index].ram == null ? '\u2013' : `${live[index].ram} MB`;
    card.updated.textContent = placed && live[index].lastGood ? live[index].lastGood : '\u2013';
    card.note.hidden = !note;
    card.note.textContent = note;
    card.vip.hidden = !placed || !live[index].hunt || live[index].hunt.vip !== true;
    card.open.hidden = !placed;
    paintStandbyHistoryChart(card.chartWrap, placed ? historySeries(index) : [], index);
  });
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

function mountStandby(parent) {
  const captures = el('section', 'standby-captures');
  captures.setAttribute('aria-labelledby', 'capturas-titulo');
  const capturesTitle = el('h2', null, 'Capturas');
  capturesTitle.id = 'capturas-titulo';
  const captureAlert = el('div', 'alert alert-info alert-soft');
  captureAlert.setAttribute('role', 'alert');
  captureAlert.append(el('span', null, 'Nenhuma captura registrada nesta sessão.'));
  captures.append(capturesTitle, captureAlert);

  const foot = el('footer', 'standby-foot');
  foot.append(
    el('p', 'standby-lead', 'O jogo fica fora da tela e o farm continua.'),
    el('p', 'standby-foot-note', 'Poção e ball podem reagir um pouco mais devagar.'),
  );
  const grid = el('div', 'standby-grid');
  ui.standby = [];
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const card = el('article', 'standby-card card card-border mesa-panel');
    card.dataset.bay = String(index);
    const mark = el('span', 'standby-mark');
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = mesaIcon(STANDBY_MARK[index]);
    const name = el('b', 'standby-name', `Baía ${index + 1}`);
    const status = el('span', 'bay-status', 'sem sessão');
    const vip = el('span', 'standby-vip', 'VIP');
    vip.hidden = true;
    const head = el('div', 'standby-head');
    const marks = el('div', 'standby-marks');
    marks.append(vip, status);
    head.append(name, marks);
    const body = el('div', 'standby-body');
    const left = el('div', 'standby-left');
    const facts = el('div', 'standby-facts');
    const level = el('b', 'num', '\u2013');
    const map = el('b', null, '\u2013');
    const ram = el('b', 'num', '\u2013');
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
    const gold = el('b', 'num', '\u2013');
    const xp = el('b', 'num', '\u2013');
    const updated = el('b', 'num', '\u2013');
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
    card.append(mark, head, body, note);
    grid.append(card);
    ui.standby.push({ root: card, name, status, vip, level, gold, xp, map, ram, updated, note, open, chartWrap });
  }
  parent.append(captures, grid, foot);
}
