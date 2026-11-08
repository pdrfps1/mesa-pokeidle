function perfCell(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function fillPerfTable(table, report) {
  table.replaceChildren();
  const head = document.createElement('tr');
  ['Situação', 'Amostras', 'CPU', 'Memória'].forEach((label) => head.append(perfCell('th', null, label)));
  table.append(head);
  if (!report.rows.length) {
    const row = document.createElement('tr');
    const cell = perfCell('td', null, 'Ainda não há uma leitura completa. Fique uns 20 segundos em cada situação.');
    cell.colSpan = 4;
    row.append(cell);
    table.append(row);
    return;
  }
  report.rows.forEach((item) => {
    const row = document.createElement('tr');
    const parts = item.parts.map((part) => `${part.name} ${part.cpu}%`).join(' · ');
    const situation = perfCell('td', null, item.key);
    if (parts) situation.append(perfCell('span', 'perf-parts', parts));
    row.append(
      situation,
      perfCell('td', null, String(item.count)),
      perfCell('td', null, `${item.cpu}%`),
      perfCell('td', null, `${item.ram} MB`),
    );
    table.append(row);
  });
}

function mountPerf(parent) {
  if (!window.mesa || typeof window.mesa.perfReport !== 'function') return;
  const section = el('article', 'settings-wide card card-border mesa-panel perf-report');
  const text = el('div', 'min-w-0 flex-1');
  const table = document.createElement('table');
  table.className = 'table table-sm perf-table w-full';
  const actions = el('div', 'perf-actions');
  const reset = el('button', 'btn btn-sm btn-soft', 'Zerar');
  const copy = el('button', 'btn btn-sm btn-ghost', 'Copiar');
  reset.type = 'button';
  copy.type = 'button';
  actions.append(reset, copy);
  text.append(
    el('h2', 'settings-card-title', 'Processamento e Hardware'),
    el('p', 'settings-perf-lead', 'Mede mesa, GPU e cada baía. Deixe ~20 s em cada situação.'),
    table,
  );
  section.append(text, actions);
  parent.append(section);
  fillPerfTable(table, { rows: [] });
  window.mesa.perfReport().then((report) => {
    if (!report) return;

    function show(next) {
      if (!next) return;
      fillPerfTable(table, next);
      section.dataset.text = next.text || '';
    }

    async function pull() {
      let next;
      try { next = await window.mesa.perfReport(); } catch { return; }
      show(next);
    }

    show(report);
    reset.addEventListener('click', async () => {
      let next = null;
      try { next = await window.mesa.perfReset(); } catch { next = null; }
      if (next) show(next);
      else pull();
    });
    copy.addEventListener('click', async () => {
      const body = section.dataset.text || '';
      if (!body) return;
      try { await navigator.clipboard.writeText(body); } catch { return; }
      copy.textContent = 'Copiado';
      setTimeout(() => { copy.textContent = 'Copiar'; }, 1500);
    });
    setInterval(() => {
      if (cfg.view !== 'ajustes') return;
      pull();
    }, 2000);
  }).catch(() => {});
}
