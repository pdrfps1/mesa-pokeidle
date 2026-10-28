function mountUpdates(parent) {
  if (!window.mesa || typeof window.mesa.checkUpdates !== 'function') return;
  ui.updateBtn = el('button', 'text-btn', 'Verificar atualizações');
  ui.updateBtn.type = 'button';
  ui.updateStatus = el('p', 'update-status', '');
  ui.updateStatus.setAttribute('aria-live', 'polite');
  ui.updateLink = el('a', 'update-link', 'Abrir página da release');
  ui.updateLink.href = '#';
  ui.updateLink.hidden = true;
  ui.updateLink.addEventListener('click', (event) => {
    event.preventDefault();
    const href = ui.updateLink.dataset.href;
    if (href && window.mesa && typeof window.mesa.openExternal === 'function') {
      window.mesa.openExternal(href);
    }
  });
  const actions = el('div', 'stack');
  actions.append(ui.updateBtn, ui.updateStatus, ui.updateLink);
  const row = el('div', 'setting');
  const text = el('div');
  text.append(
    el('strong', null, 'Atualização'),
    el('p', null, 'Compara com a última release no GitHub e substitui o Mesa.exe quando houver versão mais nova.'),
  );
  row.append(text, actions);
  parent.append(row);
  ui.updateBtn.addEventListener('click', () => { runUpdateCheck(false); });
}

function setUpdateLink(releaseUrl) {
  if (!ui.updateLink) return;
  if (releaseUrl) {
    ui.updateLink.hidden = false;
    ui.updateLink.dataset.href = releaseUrl;
  } else {
    ui.updateLink.hidden = true;
    ui.updateLink.removeAttribute('data-href');
  }
}

async function runUpdateCheck(silent) {
  if (!ui.updateBtn || !window.mesa || typeof window.mesa.checkUpdates !== 'function') return;
  ui.updateBtn.disabled = true;
  if (!silent) {
    ui.updateStatus.textContent = 'Verificando…';
    setUpdateLink('');
  }
  let result;
  try { result = await window.mesa.checkUpdates(); } catch { result = null; }
  ui.updateBtn.disabled = false;
  if (!result) {
    ui.updateStatus.textContent = 'Não foi possível verificar agora. Tente de novo.';
    setUpdateLink('');
    return;
  }
  if (result.message) ui.updateStatus.textContent = result.message;
  setUpdateLink(result.releaseUrl || '');
}
