function field(className, label) {
  const input = el('input', className || 'input input-sm');
  input.setAttribute('aria-label', label);
  input.spellcheck = false;
  return input;
}

function mountExtras(parent) {
  ui.sniper = toggle('', 'label cursor-pointer gap-2 justify-end settings-switch');
  toggleInput(ui.sniper).setAttribute('aria-label', 'Comprar com sniper');
  ui.ceiling = field('input input-sm num sniper-ceiling', 'Teto de preço');
  ui.ceiling.type = 'number';
  ui.ceiling.min = '0';
  ui.ceiling.step = '1';
  ui.goods = field('input input-sm sniper-goods', 'O que pode comprar');
  ui.goods.placeholder = 'Itens, separados por vírgula';
  ui.sniperNote = el('p', 'sniper-note', 'Nenhuma oferta lida ainda.');

  const controls = el('div', 'sniper-controls');
  controls.append(ui.sniper, ui.ceiling);
  const row = el('div', 'settings-field settings-field-sniper');
  const text = el('div', 'settings-field-text');
  text.append(
    el('strong', null, 'Sniper da baía em foco'),
    el('p', null, 'Desligado até você ligar. Com o Mercado aberto, clica em Comprar só no que você listar, se o preço da tela for até o teto.'),
  );
  row.append(text, controls);
  const below = el('div', 'sniper-below');
  below.append(ui.sniperNote, ui.goods);
  parent.append(row, below);

  toggleInput(ui.sniper).addEventListener('change', () => {
    cfg.bays[cfg.selected].sniper = toggleInput(ui.sniper).checked;
    save();
    paintExtras();
  });
  ui.ceiling.addEventListener('change', () => {
    cfg.bays[cfg.selected].ceiling = MESA_CATALOG.normalize({ bays: [{ ceiling: ui.ceiling.value }] }).bays[0].ceiling;
    save();
    paint();
  });
  ui.goods.addEventListener('change', () => {
    cfg.bays[cfg.selected].goods = ui.goods.value;
    save();
    paint();
  });
}

function paintExtras() {
  if (!ui.sniper) return;
  const bay = cfg.bays[cfg.selected];
  setChecked(ui.sniper, bay.sniper === true);
  const sniperOn = toggleInput(ui.sniper).checked;
  const row = ui.sniper.closest('.settings-field-sniper');
  const below = row && row.nextElementSibling;
  if (row) row.classList.toggle('is-sniper-off', !sniperOn);
  if (below && below.classList.contains('sniper-below')) below.classList.toggle('is-sniper-off', !sniperOn);
  if (document.activeElement !== ui.ceiling) ui.ceiling.value = String(bay.ceiling || 0);
  if (document.activeElement !== ui.goods) ui.goods.value = bay.goods || '';
  if (!sniperOn) {
    ui.sniperNote.textContent = 'Sniper desligado nesta baía.';
    ui.goods.hidden = true;
    ui.ceiling.hidden = true;
  } else {
    ui.goods.hidden = false;
    ui.ceiling.hidden = false;
    const market = live[cfg.selected].market;
    if (!(bay.ceiling > 0) || !bay.goods.trim()) ui.sniperNote.textContent = 'Defina o teto e os nomes, separados por vírgula.';
    else if (!market) ui.sniperNote.textContent = 'Abra o Mercado nesta baía. A leitura começa quando a página mostrar ofertas.';
    else if (market.bought) ui.sniperNote.textContent = `Clicou em Comprar: ${market.bought}`;
    else ui.sniperNote.textContent = `Ofertas com Comprar na tela: ${market.seen}.`;
  }
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) pushSniper(index);
}

function pushSniper(index) {
  const webview = webviews[index];
  if (!webview || !live[index].ready) return;
  const bay = cfg.bays[index];
  const goods = String(bay.goods || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 12);
  webview.send('sniper', { on: bay.sniper === true, ceiling: bay.ceiling || 0, goods });
}
