const STATUS_LABEL = {
  desconectado: 'Desconectado',
  conectando: 'Conectando',
  'no-chat': 'No chat',
  falha: 'Falha',
};

function mountLiveBonus(parent) {
  if (!window.mesa) return;
  const root = el('div', 'live-bonus');
  const head = el('div', 'live-bonus-head');
  const title = el('span', 'control-label', 'Bônus Twitch (chat)');
  const statusEl = el('span', 'live-bonus-status', STATUS_LABEL.desconectado);
  head.append(title, statusEl);

  const loginRow = el('p', 'live-bonus-meta', 'Conta: —');
  const clientRow = el('div', 'live-bonus-client');
  clientRow.append(el('span', 'control-label', 'Client ID'));
  const clientInput = el('input', 'live-bonus-input');
  clientInput.type = 'text';
  clientInput.autocomplete = 'off';
  clientInput.spellcheck = false;
  clientRow.append(clientInput);

  const actions = el('div', 'live-bonus-actions');
  const authorizeBtn = el('button', 'text-btn', 'Autorizar');
  authorizeBtn.type = 'button';
  const openTwitchBtn = el('button', 'text-btn', 'Abrir Twitch');
  openTwitchBtn.type = 'button';
  openTwitchBtn.hidden = true;
  const disconnectBtn = el('button', 'text-btn', 'Desconectar');
  disconnectBtn.type = 'button';
  actions.append(authorizeBtn, openTwitchBtn, disconnectBtn);

  const hint = el('div', 'live-bonus-hints');
  hint.append(
    el('p', null, 'A conta autorizada precisa ser a mesma do Conectar Twitch no jogo.'),
    el('p', null, 'O navegador avisa do certificado. Em Avançado, continue para 127.0.0.1.'),
  );

  const errorEl = el('p', 'live-bonus-error finding');
  errorEl.hidden = true;

  const channelsBox = el('div', 'live-bonus-channels');
  const channelNote = el('p', 'live-bonus-note', 'Canal manual fica até você remover. Só oficial com selo conta no jogo.');

  const manualRow = el('div', 'live-bonus-manual');
  const manualInput = el('input', 'live-bonus-input');
  manualInput.type = 'text';
  manualInput.placeholder = 'Login manual';
  const manualAdd = el('button', 'text-btn', 'Adicionar');
  manualAdd.type = 'button';
  manualRow.append(manualInput, manualAdd);

  const baysBox = el('div', 'live-bonus-bays');
  const kickBox = el('div', 'live-bonus-kick');

  root.append(head, loginRow, clientRow, actions, hint, errorEl, channelsBox, channelNote, manualRow, baysBox, kickBox);
  parent.append(root);

  let snapshot = null;
  let clientDirty = false;

  function paintStatus(data) {
    const joined = Array.isArray(data.joined) ? data.joined.length : 0;
    statusEl.textContent = `${STATUS_LABEL[data.status] || data.status || STATUS_LABEL.desconectado}${data.status === 'no-chat' ? ` · ${joined} canais` : ''}`;
    loginRow.textContent = data.login ? `Conta: ${data.login}` : 'Conta: —';
    if (!clientDirty) clientInput.value = data.clientId || '';
    errorEl.hidden = !data.error;
    errorEl.textContent = data.error || '';
    if (!data.error && data.status === 'no-chat' && !(data.joined || []).length) {
      const checked = (data.channels || []).some((channel) => channel.checked);
      errorEl.hidden = false;
      errorEl.textContent = checked
        ? 'Conectado, mas a Twitch ainda não confirmou nenhum canal. O jogo só conta depois disso.'
        : 'Conectado, mas nenhuma live oficial com selo chegou das baías. O jogo não conta o bônus assim.';
    }
    openTwitchBtn.hidden = !data.authorizeUrl;
    disconnectBtn.disabled = data.status === 'desconectado' && !data.login;
  }

  function paintChannels(data) {
    channelsBox.replaceChildren();
    for (const channel of data.channels || []) {
      const row = el('label', 'live-bonus-channel');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = channel.checked === true;
      box.addEventListener('change', () => {
        window.mesa.liveChannel(channel.login, box.checked).then(applySnapshot);
      });
      const text = el('span', null, channel.nome || channel.login);
      if (channel.manual) text.append(document.createTextNode(' (manual)'));
      row.append(box, text);
      if (channel.manual) {
        const remove = el('button', 'text-btn', 'Remover');
        remove.type = 'button';
        remove.addEventListener('click', () => {
          window.mesa.liveManualRemove(channel.login).then(applySnapshot);
        });
        row.append(remove);
      }
      channelsBox.append(row);
    }
  }

  function paintBays(data) {
    baysBox.replaceChildren();
    (data.bays || []).forEach((bay, index) => {
      const row = el('div', 'live-bonus-bay');
      const tw = bay.twitch || {};
      const k = bay.kick || {};
      let kickText = '';
      if (k.pct !== undefined) kickText += ` Kick ${k.pct}%`;
      if (k.minutos !== undefined) kickText += ` · ${k.minutos} min`;
      row.textContent = `Baía ${index + 1}: Twitch ${tw.assistindo === true ? 'assistindo' : tw.assistindo === false ? 'parado' : '—'} · ${tw.pct != null ? tw.pct : 0}%${kickText}`;
      baysBox.append(row);
    });
  }

  function paintKick(data) {
    kickBox.replaceChildren();
    const title = el('span', 'control-label', 'Kick ao vivo');
    kickBox.append(title);
    const list = el('div', 'live-bonus-kick-list');
    for (const item of data.kickAoVivo || []) {
      const row = el('div', 'live-bonus-kick-row');
      row.append(el('span', null, `${item.nome || item.slug} (${item.espectadores != null ? item.espectadores : '—'})`));
      const open = el('button', 'text-btn', 'Abrir');
      open.type = 'button';
      open.addEventListener('click', () => window.mesa.liveKickOpen(item.slug));
      row.append(open);
      list.append(row);
    }
    kickBox.append(list);
  }

  function applySnapshot(data) {
    snapshot = data;
    paintStatus(data);
    paintChannels(data);
    paintBays(data);
    paintKick(data);
  }

  clientInput.addEventListener('input', () => { clientDirty = true; });
  clientInput.addEventListener('change', () => {
    clientDirty = false;
    window.mesa.liveClientId(clientInput.value).then(applySnapshot);
  });

  authorizeBtn.addEventListener('click', () => {
    authorizeBtn.disabled = true;
    const typed = clientInput.value.trim();
    const persist = typed
      ? window.mesa.liveClientId(typed)
      : Promise.resolve(null);
    persist
      .then(() => window.mesa.liveAuthorize())
      .then(applySnapshot)
      .catch((error) => {
        errorEl.hidden = false;
        errorEl.textContent = error && error.message ? error.message : 'Não foi possível autorizar.';
      })
      .finally(() => {
        authorizeBtn.disabled = false;
      });
  });
  openTwitchBtn.addEventListener('click', () => {
    window.mesa.liveOpenTwitch().then(applySnapshot).catch((error) => {
      errorEl.hidden = false;
      errorEl.textContent = error && error.message ? error.message : 'Não foi possível abrir a Twitch.';
    });
  });
  disconnectBtn.addEventListener('click', () => {
    window.mesa.liveDisconnect().then(applySnapshot);
  });
  manualAdd.addEventListener('click', () => {
    const login = manualInput.value.trim();
    if (!login) return;
    window.mesa.liveManualAdd(login).then((data) => {
      manualInput.value = '';
      applySnapshot(data);
    });
  });

  window.mesa.onLiveStatus((data) => applySnapshot(data));
  window.mesa.liveGet().then(applySnapshot);
}
