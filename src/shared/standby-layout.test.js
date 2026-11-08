'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const layout = require('./standby-layout');

const PADRAO = ['captures', 'bay-0', 'bay-1', 'bay-2', 'bay-3', 'procs', 'twitch', 'twitch-bay-0', 'twitch-bay-1', 'twitch-bay-2', 'twitch-bay-3', 'pokecalc'];
const TWITCH = ['twitch', 'twitch-bay-0', 'twitch-bay-1', 'twitch-bay-2', 'twitch-bay-3'];
// Oculto por padrão: os da Twitch e a calculadora de status.
const OCULTOS = [...TWITCH, 'pokecalc'];

describe('reset e padrão', () => {
  it('padrão: ordem completa, span 2 para capturas, recursos e Twitch, 1 para as baías, e só os da Twitch ocultos', () => {
    const state = layout.reset();
    assert.deepEqual(state.order, PADRAO);
    assert.equal(state.widgets.captures.span, 2);
    assert.equal(state.widgets.procs.span, 2);
    assert.equal(state.widgets.twitch.span, 2);
    assert.equal(state.widgets.pokecalc.span, 2);
    for (const id of ['bay-0', 'bay-1', 'bay-2', 'bay-3', 'twitch-bay-0', 'twitch-bay-1', 'twitch-bay-2', 'twitch-bay-3']) assert.equal(state.widgets[id].span, 1);
    for (const id of PADRAO) {
      assert.equal(state.widgets[id].hidden, OCULTOS.includes(id), `hidden de ${id}`);
      assert.equal(state.widgets[id].collapsed, false);
    }
  });

  it('normalize de lixo devolve o padrão', () => {
    for (const raw of [null, undefined, [], 'bay-0', 42, true]) {
      assert.deepEqual(layout.normalize(raw), layout.reset());
    }
  });
});

describe('normalize', () => {
  it('descarta id desconhecido', () => {
    const state = layout.normalize({ order: ['x', 'bay-2', 'nada'] });
    assert.equal(state.order.includes('x'), false);
    assert.equal(state.order.includes('nada'), false);
    assert.equal(state.order.length, PADRAO.length);
    assert.equal(state.order[0], 'bay-2');
  });

  it('remove duplicado, mantendo a primeira ocorrência', () => {
    const state = layout.normalize({ order: ['bay-1', 'bay-1', 'captures', 'bay-1'] });
    assert.equal(state.order.filter((id) => id === 'bay-1').length, 1);
    assert.deepEqual(state.order.slice(0, 2), ['bay-1', 'captures']);
  });

  it('acrescenta no fim os faltantes, na ordem padrão', () => {
    const state = layout.normalize({ order: ['procs', 'bay-0'] });
    assert.deepEqual(state.order, ['procs', 'bay-0', 'captures', 'bay-1', 'bay-2', 'bay-3', 'twitch', 'twitch-bay-0', 'twitch-bay-1', 'twitch-bay-2', 'twitch-bay-3', 'pokecalc']);
  });

  it('força span para 1 ou 2 e usa o padrão quando o valor não é número', () => {
    const state = layout.normalize({
      widgets: {
        'bay-0': { span: 7 },
        'bay-1': { span: 0 },
        captures: { span: 'abc' },
        procs: { span: null },
        'bay-2': { span: 2 },
      },
    });
    assert.equal(state.widgets['bay-0'].span, 2);
    assert.equal(state.widgets['bay-1'].span, 1);
    assert.equal(state.widgets.captures.span, 2);
    assert.equal(state.widgets.procs.span, 2);
    assert.equal(state.widgets['bay-2'].span, 2);
    assert.equal(state.widgets['bay-3'].span, 1);
  });

  it('hidden e collapsed só valem true quando são true', () => {
    const state = layout.normalize({ widgets: { 'bay-0': { hidden: 'sim', collapsed: true }, 'bay-1': { hidden: true } } });
    assert.equal(state.widgets['bay-0'].hidden, false);
    assert.equal(state.widgets['bay-0'].collapsed, true);
    assert.equal(state.widgets['bay-1'].hidden, true);
  });

  it('é idempotente', () => {
    const once = layout.normalize({ order: ['procs', 'bay-9', 'procs'], widgets: { procs: { span: 1, hidden: true } } });
    assert.deepEqual(layout.normalize(once), once);
  });
});

describe('move', () => {
  it('move um passo para cima e para baixo', () => {
    const state = layout.reset();
    assert.deepEqual(layout.move(state, 'bay-1', -1).order.slice(0, 3), ['captures', 'bay-1', 'bay-0']);
    assert.deepEqual(layout.move(state, 'bay-1', 1).order.slice(1, 4), ['bay-0', 'bay-2', 'bay-1']);
  });

  it('nas bordas, não sai da lista', () => {
    const state = layout.reset();
    assert.deepEqual(layout.move(state, 'captures', -1).order, PADRAO);
    assert.deepEqual(layout.move(state, 'pokecalc', 1).order, PADRAO);
    assert.deepEqual(layout.move(state, 'bay-0', 99).order,['captures', 'bay-1', 'bay-2', 'bay-3', 'procs', 'twitch', 'twitch-bay-0', 'twitch-bay-1', 'twitch-bay-2', 'twitch-bay-3', 'pokecalc', 'bay-0']);
  });

  it('não altera o estado de entrada', () => {
    const state = layout.reset();
    layout.move(state, 'bay-0', 2);
    assert.deepEqual(state.order, PADRAO);
  });

  it('id desconhecido devolve o estado sem mudança', () => {
    assert.deepEqual(layout.move(layout.reset(), 'x', 1).order, PADRAO);
  });
});

describe('moveTo', () => {
  it('põe o widget na posição pedida', () => {
    assert.deepEqual(layout.moveTo(layout.reset(), 'bay-3', 1).order, ['captures', 'bay-3', 'bay-0', 'bay-1', 'bay-2', 'procs', 'twitch', 'twitch-bay-0', 'twitch-bay-1', 'twitch-bay-2', 'twitch-bay-3', 'pokecalc']);
  });

  it('limita o índice à lista', () => {
    assert.equal(layout.moveTo(layout.reset(), 'captures', 99).order.at(-1), 'captures');
    assert.equal(layout.moveTo(layout.reset(), 'procs', -4).order[0], 'procs');
  });
});

describe('set', () => {
  it('altera só os campos do patch', () => {
    const state = layout.set(layout.reset(), 'bay-2', { span: 2, collapsed: true });
    assert.equal(state.widgets['bay-2'].span, 2);
    assert.equal(state.widgets['bay-2'].collapsed, true);
    assert.equal(state.widgets['bay-2'].hidden, false);
    assert.equal(state.widgets['bay-0'].span, 1);
  });

  it('span numérico no patch é forçado para 1 ou 2; valor não numérico mantém o atual', () => {
    assert.equal(layout.set(layout.reset(), 'bay-0', { span: 5 }).widgets['bay-0'].span, 2);
    assert.equal(layout.set(layout.reset(), 'captures', { span: 'x' }).widgets.captures.span, 2);
    assert.equal(layout.set(layout.reset(), 'bay-0', { span: 'x' }).widgets['bay-0'].span, 1);
  });

  it('id desconhecido não cria widget', () => {
    assert.deepEqual(Object.keys(layout.set(layout.reset(), 'x', { hidden: true }).widgets), PADRAO);
  });
});

describe('reset', () => {
  it('volta ao padrão depois de mudanças', () => {
    const changed = layout.set(layout.move(layout.reset(), 'procs', -3), 'bay-0', { hidden: true, span: 2 });
    assert.notDeepEqual(changed, layout.reset());
    assert.deepEqual(layout.reset(), layout.normalize({}));
    assert.deepEqual(layout.reset().order, PADRAO);
  });

  it('reset() deixa os antigos visíveis e os da Twitch ocultos, mesmo depois de mudanças', () => {
    const mudado = layout.set(layout.set(layout.reset(), 'twitch-bay-1', { hidden: false }), 'bay-0', { hidden: true });
    assert.equal(mudado.widgets['twitch-bay-1'].hidden, false);
    assert.equal(mudado.widgets['bay-0'].hidden, true);
    const state = layout.reset();
    for (const id of PADRAO) assert.equal(state.widgets[id].hidden, OCULTOS.includes(id), id);
  });
});

describe('widgets da Twitch: ocultos por padrão e estado salvo antigo', () => {
  const SEIS = ['captures', 'bay-0', 'bay-1', 'bay-2', 'bay-3', 'procs'];

  it('estado salvo com os 6 ids antigos ganha os 5 da Twitch no fim, ocultos; os antigos mantêm o hidden salvo', () => {
    const state = layout.normalize({
      order: SEIS,
      widgets: {
        'bay-1': { span: 2, hidden: true, collapsed: false },
        procs: { span: 2, hidden: false, collapsed: true },
      },
    });
    assert.deepEqual(state.order, PADRAO);
    assert.deepEqual(state.order.slice(6), [...TWITCH, 'pokecalc']);
    for (const id of OCULTOS) assert.equal(state.widgets[id].hidden, true, id);
    assert.equal(state.widgets['bay-1'].hidden, true);
    assert.equal(state.widgets['bay-1'].span, 2);
    assert.equal(state.widgets.procs.hidden, false);
    assert.equal(state.widgets.procs.collapsed, true);
  });

  it('antigos sem campo hidden continuam visíveis; só os novos ficam ocultos', () => {
    const state = layout.normalize({ order: SEIS, widgets: { captures: { span: 2 } } });
    for (const id of SEIS) assert.equal(state.widgets[id].hidden, false, id);
    for (const id of TWITCH) assert.equal(state.widgets[id].hidden, true, id);
  });

  it('hidden salvo nos widgets da Twitch vale como salvo: false mostra, true oculta, ausente segue o padrão', () => {
    const state = layout.normalize({ widgets: { twitch: { hidden: false }, 'twitch-bay-2': { hidden: true } } });
    assert.equal(state.widgets.twitch.hidden, false);
    assert.equal(state.widgets['twitch-bay-2'].hidden, true);
    assert.equal(state.widgets['twitch-bay-0'].hidden, true);
  });

  it('mostrar um widget da Twitch muda só o dele, e o reset volta a ocultá-lo', () => {
    const mostrado = layout.set(layout.reset(), 'twitch-bay-1', { hidden: false });
    assert.equal(mostrado.widgets['twitch-bay-1'].hidden, false);
    assert.equal(mostrado.widgets.twitch.hidden, true);
    assert.equal(layout.reset().widgets['twitch-bay-1'].hidden, true);
  });
});
