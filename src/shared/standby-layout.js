// Layout dos widgets da Espera: ordem, largura (1 ou 2 colunas), oculto e recolhido.
// Funções puras. Quem chama grava o resultado em cfg.standby.
var MesaStandbyLayout = (function standbyLayoutModule() {
  const IDS = ['captures', 'bay-0', 'bay-1', 'bay-2', 'bay-3', 'procs', 'twitch', 'twitch-bay-0', 'twitch-bay-1', 'twitch-bay-2', 'twitch-bay-3', 'pokecalc'];
  const SPAN_PADRAO = {
    captures: 2, 'bay-0': 1, 'bay-1': 1, 'bay-2': 1, 'bay-3': 1, procs: 2,
    twitch: 2, 'twitch-bay-0': 1, 'twitch-bay-1': 1, 'twitch-bay-2': 1, 'twitch-bay-3': 1, pokecalc: 2,
  };
  // Os widgets da Twitch nascem ocultos. Estado salvo sem o campo hidden usa este padrão.
  // A calculadora de status também nasce oculta.
  const HIDDEN_PADRAO = {
    captures: false, 'bay-0': false, 'bay-1': false, 'bay-2': false, 'bay-3': false, procs: false,
    twitch: true, 'twitch-bay-0': true, 'twitch-bay-1': true, 'twitch-bay-2': true, 'twitch-bay-3': true, pokecalc: true,
  };

  function isPlain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  // Número válido vira 1 ou 2 (abaixo de 2 vale 1). Qualquer outra coisa devolve o padrão.
  function spanOf(value, fallback) {
    if (typeof value !== 'number' && typeof value !== 'string') return fallback;
    if (value === '') return fallback;
    const amount = Number(value);
    if (!Number.isFinite(amount)) return fallback;
    return amount >= 2 ? 2 : 1;
  }

  function defaultWidget(id) {
    return { span: SPAN_PADRAO[id], hidden: HIDDEN_PADRAO[id], collapsed: false };
  }

  function reset() {
    const widgets = {};
    for (const id of IDS) widgets[id] = defaultWidget(id);
    return { order: IDS.slice(), widgets };
  }

  // Aceita qualquer coisa. Descarta ids desconhecidos e repetidos, acrescenta os faltantes no fim.
  function normalize(raw) {
    if (!isPlain(raw)) return reset();
    const seen = new Set();
    const order = [];
    const list = Array.isArray(raw.order) ? raw.order : [];
    for (const id of list) {
      if (typeof id !== 'string' || !IDS.includes(id) || seen.has(id)) continue;
      seen.add(id);
      order.push(id);
    }
    for (const id of IDS) {
      if (!seen.has(id)) order.push(id);
    }
    const input = isPlain(raw.widgets) ? raw.widgets : {};
    const widgets = {};
    for (const id of IDS) {
      const item = isPlain(input[id]) ? input[id] : {};
      widgets[id] = {
        span: spanOf(item.span, SPAN_PADRAO[id]),
        // Campo ausente (estado salvo antes deste widget existir) usa o padrão; campo presente vale só se for true.
        hidden: 'hidden' in item ? item.hidden === true : HIDDEN_PADRAO[id],
        collapsed: item.collapsed === true,
      };
    }
    return { order, widgets };
  }

  // Move o widget `delta` posições. Nas bordas, fica onde está.
  function move(state, id, delta) {
    const base = normalize(state);
    const from = base.order.indexOf(id);
    const step = Number(delta);
    if (from < 0 || !Number.isInteger(step)) return base;
    const to = Math.min(base.order.length - 1, Math.max(0, from + step));
    return moveTo(base, id, to);
  }

  // Põe o widget na posição `index` (0-based), limitada à lista.
  function moveTo(state, id, index) {
    const base = normalize(state);
    const from = base.order.indexOf(id);
    const to = Number(index);
    if (from < 0 || !Number.isInteger(to)) return base;
    const order = base.order.slice();
    order.splice(from, 1);
    const at = Math.min(order.length, Math.max(0, to));
    order.splice(at, 0, id);
    return { order, widgets: base.widgets };
  }

  // Altera span, hidden e/ou collapsed de um widget. Campos ausentes do patch ficam como estão.
  function set(state, id, patch) {
    const base = normalize(state);
    if (!IDS.includes(id)) return base;
    const current = base.widgets[id];
    const data = isPlain(patch) ? patch : {};
    base.widgets[id] = {
      span: 'span' in data ? spanOf(data.span, current.span) : current.span,
      hidden: 'hidden' in data ? data.hidden === true : current.hidden,
      collapsed: 'collapsed' in data ? data.collapsed === true : current.collapsed,
    };
    return base;
  }

  return { ids: IDS.slice(), normalize, move, moveTo, set, reset };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaStandbyLayout;
