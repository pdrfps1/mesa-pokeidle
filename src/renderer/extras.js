function field(className, label) {
  const input = el('input', className);
  input.setAttribute('aria-label', label);
  input.spellcheck = false;
  return input;
}

function mountExtras(parent) {
  ui.sniper = toggle('Ligado');
  ui.ceiling = field('field num', 'Teto de preço');
  ui.ceiling.type = 'number';
  ui.ceiling.min = '0';
  ui.ceiling.step = '1';
  ui.goods = field('field wide', 'O que pode comprar');
  ui.sniperNote = el('p', null, 'Nenhuma oferta lida ainda.');

  const sniperFields = el('div', 'stack');
  sniperFields.append(ui.sniper, ui.ceiling, ui.goods, ui.sniperNote);

  const row = el('div', 'setting');
  const text = el('div');
  text.append(
    el('strong', null, 'Sniper da baía em foco'),
    el('p', null, 'Desligado até você ligar. Com o Mercado aberto, clica em Comprar só no que você listar, se o preço da tela for até o teto.'),
  );
  row.append(text, sniperFields);
  parent.append(row);

  ui.sniper.addEventListener('click', () => {
    cfg.bays[cfg.selected].sniper = !cfg.bays[cfg.selected].sniper;
    save();
    paint();
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
  if (document.activeElement !== ui.ceiling) ui.ceiling.value = String(bay.ceiling || 0);
  if (document.activeElement !== ui.goods) ui.goods.value = bay.goods || '';
  const market = live[cfg.selected].market;
  if (!bay.sniper) ui.sniperNote.textContent = 'Sniper desligado nesta baía.';
  else if (!(bay.ceiling > 0) || !bay.goods.trim()) ui.sniperNote.textContent = 'Defina o teto e os nomes, separados por vírgula.';
  else if (!market) ui.sniperNote.textContent = 'Abra o Mercado nesta baía. A leitura começa quando a página mostrar ofertas.';
  else if (market.bought) ui.sniperNote.textContent = `Clicou em Comprar: ${market.bought}`;
  else ui.sniperNote.textContent = `Ofertas com Comprar na tela: ${market.seen}.`;
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) pushSniper(index);
}

function pushSniper(index) {
  const webview = webviews[index];
  if (!webview || !live[index].ready) return;
  const bay = cfg.bays[index];
  const goods = String(bay.goods || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean).slice(0, 12);
  webview.send('sniper', { on: bay.sniper === true, ceiling: bay.ceiling || 0, goods });
}
