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

function paintStandby() {
  if (!ui.standby || cfg.view !== 'espera') return;
  ui.standby.forEach((card, index) => {
    const status = statusOf(index);
    const placed = cfg.bays[index].placed !== false;
    const note = [standbyPlace(index), placed ? (typeof MesaAutoHunt !== 'undefined' && MesaAutoHunt.line ? MesaAutoHunt.line(index) : '') : '', placed ? autosOf(index) : ''].filter(Boolean).join(' ');
    card.name.textContent = titleOf(index);
    card.status.textContent = placed ? status.word : 'fora';
    card.status.dataset.tone = placed ? status.tone : 'off';
    card.level.textContent = live[index].loggedIn && live[index].level ? live[index].level : '\u2013';
    card.gold.textContent = live[index].loggedIn && live[index].gold ? live[index].gold : '\u2013';
    card.xp.textContent = MesaStatus.fmtXp(placed && live[index].loggedIn ? live[index].rate : null).text;
    card.map.textContent = placed ? (mapOf(index) || '\u2013') : '\u2013';
    card.ram.textContent = !placed || live[index].ram == null ? '\u2013' : `${live[index].ram} MB`;
    card.seen.textContent = placed && live[index].lastGood ? live[index].lastGood : '\u2013';
    card.note.hidden = !note;
    card.note.textContent = note;
    card.vip.hidden = !placed || !live[index].hunt || live[index].hunt.vip !== true;
    card.open.hidden = !placed;
  });
}

function watchStandby(index) {
  const button = el('button', 'text-btn', 'Ver jogo');
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
  const lead = el('p', 'standby-lead', 'O jogo fica fora da tela e o farm continua. Poção e ball podem reagir um pouco mais devagar.');
  const grid = el('div', 'standby-grid');
  ui.standby = [];
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    const card = el('article', 'standby-card');
    const name = el('b', 'standby-name', `Baía ${index + 1}`);
    const kicker = el('span', 'standby-kicker', `Baía ${index + 1}`);
    const status = el('span', 'bay-status', 'sem sessão');
    const vip = el('span', 'vip', 'VIP');
    vip.hidden = true;
    const head = el('div', 'standby-head');
    const title = el('div');
    title.append(kicker, name);
    const marks = el('div', 'standby-marks');
    marks.append(vip, status);
    head.append(title, marks);
    const facts = el('div', 'standby-facts');
    const level = el('b', null, '\u2013');
    const gold = el('b', null, '\u2013');
    const xp = el('b', null, '\u2013');
    const map = el('b', null, '\u2013');
    const ram = el('b', null, '\u2013');
    const seen = el('b', null, '\u2013');
    [
      ['Nível', level],
      ['Ouro', gold],
      ['XP/h', xp],
      ['Mapa', map],
      ['Memória', ram],
      ['Atualizado', seen],
    ].forEach(([label, value]) => {
      const fact = el('div');
      fact.append(el('span', null, label), value);
      facts.append(fact);
    });
    const note = el('p', 'standby-note', '');
    note.hidden = true;
    const open = watchStandby(index);
    card.append(head, facts, note, open);
    grid.append(card);
    ui.standby.push({ name, status, vip, level, gold, xp, map, ram, seen, note, open });
  }
  parent.append(lead, grid);
}
