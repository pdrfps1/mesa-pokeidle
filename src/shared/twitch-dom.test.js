'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const D = require('./twitch-dom');

const S = D.SELETORES;

// Todos os descendentes pela árvore de children (o que querySelectorAll('*') devolve no DOM).
function descendentes(e) {
  const out = [];
  const walk = (x) => { for (const c of x.children || []) { out.push(c); walk(c); } };
  walk(e);
  return out;
}

// Só os seletores que o módulo usa: botões, role=button, title e button.
function casaSeletor(e, sel) {
  if (sel === 'button,[role="button"]') return e.tag === 'button' || e.attrs.role === 'button';
  if (sel === '[title]') return e.attrs.title !== undefined;
  if (sel === 'button') return e.tag === 'button';
  if (sel === '*') return true;
  return false;
}

// Elemento falso: textContent, atributos, clique contado, pai para closest e listas por seletor.
function el(props = {}) {
  return {
    tag: 'div',
    textContent: '',
    attrs: {},
    disabled: false,
    clicks: 0,
    parent: null,
    children: [],
    get parentElement() {
      return this.parent;
    },
    listas: {},
    onClick: null,
    getAttribute(nome) {
      return Object.prototype.hasOwnProperty.call(this.attrs, nome) ? this.attrs[nome] : null;
    },
    click() {
      this.clicks += 1;
      if (this.onClick) this.onClick();
    },
    closest(sel) {
      for (let n = this; n; n = n.parent) {
        if (sel.includes('button') && (n.tag === 'button' || n.attrs.role === 'button')) return n;
      }
      return null;
    },
    // listas[sel] devolve o que o teste fixou; todos é filtrado pelo seletor, como o DOM faria.
    querySelectorAll(sel) {
      if (sel === '*') return descendentes(this);
      const porSeletor = (this.todos || []).filter((e) => casaSeletor(e, sel));
      return [...(this.listas[sel] || []), ...porSeletor];
    },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    ...props,
  };
}

// Documento falso: querySelector lê o mapa de seletor exato; os diálogos da página ficam em dialogos.
function doc(mapa = {}, dialogos = []) {
  return {
    mapa,
    dialogos,
    querySelector(sel) {
      return this.mapa[sel] || null;
    },
    querySelectorAll(sel) {
      // O módulo não consulta mais diálogos genéricos; a lista fica só para o teste provar que eles são ignorados.
      return sel === '[role="dialog"]' ? this.dialogos : [];
    },
  };
}

describe('primeiro', () => {
  it('pula seletor que lança e segue a ordem da lista', () => {
    const root = {
      querySelector(sel) {
        if (sel === 'a') throw new Error('seletor inválido');
        return sel === 'b' ? { nome: 'b' } : null;
      },
    };
    assert.deepEqual(D.primeiro(root, ['a', 'b', 'c']), { nome: 'b' });
    assert.equal(D.primeiro(root, ['x']), null);
  });
});

describe('lerFatos', () => {
  it('logado e deslogado saem dos seletores certos', () => {
    const logado = doc({ [S.logado[0]]: el() });
    assert.equal(D.lerFatos(logado, { pathname: '/' }, null).fatos.logado, true);
    assert.equal(D.lerFatos(logado, { pathname: '/' }, null).fatos.deslogado, false);
    const fora = doc({ [S.deslogado[1]]: el() });
    assert.equal(D.lerFatos(fora, { pathname: '/' }, null).fatos.deslogado, true);
    assert.equal(D.lerFatos(fora, { pathname: '/' }, null).fatos.logado, false);
  });

  it('portão acha pelo segundo seletor, se o primeiro não existir', () => {
    const mapa = doc({ [S.portao[1]]: el() });
    assert.equal(D.lerFatos(mapa, { pathname: '/x' }, null).fatos.portao, true);
  });

  it('pausado por data-a-player-state', () => {
    const play = el({ attrs: { 'data-a-player-state': 'paused' } });
    const mapa = doc({ [S.play[0]]: play });
    assert.equal(D.lerFatos(mapa, { pathname: '/x' }, null).fatos.pausado, true);
  });

  it('rodando só quando o tempo do vídeo andou desde a leitura anterior', () => {
    const video = { paused: false, ended: false, readyState: 4, currentTime: 10 };
    const mapa = doc({ [S.video[0]]: video });
    const primeira = D.lerFatos(mapa, { pathname: '/x' }, { tempo: 10 });
    assert.equal(primeira.fatos.rodando, false);
    assert.deepEqual(primeira.anterior, { tempo: 10 });
    video.currentTime = 12;
    assert.equal(D.lerFatos(mapa, { pathname: '/x' }, { tempo: 10 }).fatos.rodando, true);
  });

  it('baú pelo ícone (com closest) e pelo aria-label', () => {
    const botaoIcone = el({ tag: 'button' });
    const icone = el({ tag: 'span' });
    icone.parent = botaoIcone;
    assert.equal(D.acharBau(doc({ [S.bau[0]]: icone })), botaoIcone);
    const botaoAria = el({ tag: 'button', attrs: { 'aria-label': 'Claim Bonus' } });
    assert.equal(D.acharBau(doc({ [S.bau[1]]: botaoAria })), botaoAria);
    assert.equal(D.lerFatos(doc({ [S.bau[0]]: icone }), { pathname: '/x' }, null).fatos.bau, true);
  });

  it('saldo pelo seletor; sem ele, pelo texto do botão de pontos', () => {
    const logado = el();
    const pelo = doc({ [S.logado[0]]: logado, [S.saldo[0]]: el({ textContent: ' 1.234 ' }) });
    assert.equal(D.lerFatos(pelo, { pathname: '/x' }, null).fatos.saldoTexto, '1.234');
    const pelo2 = doc({ [S.logado[0]]: logado, [S.botaoPontos[0]]: el({ textContent: '1,2 mil' }) });
    assert.equal(D.lerFatos(pelo2, { pathname: '/x' }, null).fatos.saldoTexto, '1,2 mil');
  });

  it('saldo só é lido com login', () => {
    const mapa = doc({ [S.saldo[0]]: el({ textContent: '900' }) });
    assert.equal(D.lerFatos(mapa, { pathname: '/x' }, null).fatos.saldoTexto, '');
  });

  it('canal vem do pathname; /directory dá directory; inválido dá vazio', () => {
    const mapa = doc({});
    assert.equal(D.lerFatos(mapa, { pathname: '/Fulano' }, null).fatos.canal, 'fulano');
    assert.equal(D.lerFatos(mapa, { pathname: '/directory' }, null).fatos.canal, 'directory');
    assert.equal(D.lerFatos(mapa, { pathname: '/Fulano!x' }, null).fatos.canal, '');
    assert.equal(D.lerFatos(mapa, { pathname: '/' }, null).fatos.canal, '');
  });
});

// Carta de recompensa: título e custo no mesmo cartão (O-3). Fica no centro, como no diálogo.
// O resto do texto (o custo) vira um filho próprio, como num DOM real.
function cartaNoCentro(centro, textoCarta, tituloTexto, tag = 'div') {
  const titulo = el({ tag: 'span', textContent: tituloTexto });
  const resto = textoCarta.slice(tituloTexto.length).trim();
  const filhos = [titulo];
  if (resto) filhos.push(el({ tag: 'span', textContent: resto }));
  const carta = el({ tag, textContent: textoCarta, children: filhos });
  filhos.forEach((f) => { f.parent = carta; });
  carta.parent = centro;
  centro.children = [...(centro.children || []), carta];
  return carta;
}

// Botão de confirmação dentro do centro, como no diálogo de verdade.
function noCentro(centro, dedicado) {
  dedicado.parent = centro;
  centro.children = [...(centro.children || []), dedicado];
  return dedicado;
}

describe('acharRecompensa e acharBotaoResgatar', () => {
  it('título exato no title vence um botão de texto parcial único (A-4)', () => {
    const centro = el();
    const exato = el({ tag: 'button', attrs: { title: 'Bônus XP' }, textContent: 'Resgatar' });
    centro.todos = [exato];
    exato.parent = centro;
    centro.listas['button,[role="button"]'] = [el({ tag: 'button', textContent: 'Bônus XP (2x)' })];
    assert.equal(D.acharRecompensa(doc({ [S.centro[0]]: centro }), 'Bônus XP'), exato);
  });

  it('confirmação: cartão de custo certo com o título pedido é aceito', () => {
    const dedicado = el({ tag: 'button' });
    const centro = el();
    cartaNoCentro(centro, 'Bônus XP 1.000', 'Bônus XP');
    noCentro(centro, dedicado);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 1000, 'Bônus XP'), dedicado);
  });

  it('ignora o botão que também contém o título, sem seletor dedicado', () => {
    const centro = el();
    centro.listas.button = [el({ tag: 'button', textContent: 'Bônus XP 300' })];
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro }), 300, 'Bônus XP'), null);
  });
});

describe('resgatar', () => {
  // Cenário com clique real: o resumo abre e fecha o centro e a ordem dos cliques fica registrada.
  function cenario(opcoes = {}) {
    const ordem = [];
    const d = doc();
    const centro = el();
    const item = el({ tag: 'button', textContent: 'Bônus XP', disabled: opcoes.itemDesabilitado === true });
    item.onClick = () => ordem.push('item');
    const botao = el({ tag: 'button', textContent: '300', disabled: opcoes.botaoDesabilitado === true });
    botao.onClick = () => ordem.push('botao');
    centro.listas['button,[role="button"]'] = opcoes.semItem ? [] : [item];
    if (!opcoes.semBotao) {
      d.mapa[S.resgatar[0]] = botao;
      noCentro(centro, botao);
      cartaNoCentro(centro, 'Bônus XP 300', 'Bônus XP');
    }
    const resumo = el({ tag: 'button', textContent: '1.234' });
    let aberto = false;
    resumo.onClick = () => {
      ordem.push('resumo');
      aberto = !aberto;
      if (aberto) d.mapa[S.centro[0]] = centro;
      else delete d.mapa[S.centro[0]];
    };
    if (!opcoes.semResumo) d.mapa[S.botaoPontos[0]] = resumo;
    if (opcoes.campo) centro.listas.textarea = [el({ tag: 'textarea' })];
    const deps = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };
    return { d, ordem, deps };
  }

  it('caminho feliz: resumo, item, botão e fecha o centro', async () => {
    const { d, ordem, deps } = cenario();
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps);
    assert.deepEqual(res, { estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['resumo', 'item', 'botao', 'resumo']);
  });

  it('sem resumo: falha sem clicar em nada', async () => {
    const { d, ordem, deps } = cenario({ semResumo: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { estado: 'falhou', motivo: 'sem-resumo' });
    assert.deepEqual(ordem, []);
  });

  it('sem recompensa: fecha o centro', async () => {
    const { d, ordem, deps } = cenario({ semItem: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { estado: 'falhou', motivo: 'sem-recompensa', vistos: [] });
    assert.deepEqual(ordem, ['resumo', 'resumo']);
  });

  it('recompensa desabilitada: indisponivel, e fecha', async () => {
    const { d, ordem, deps } = cenario({ itemDesabilitado: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { estado: 'falhou', motivo: 'indisponivel' });
    assert.deepEqual(ordem, ['resumo', 'resumo']);
  });

  it('recompensa que pede texto: pede-texto, e fecha', async () => {
    const { d, ordem, deps } = cenario({ campo: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { estado: 'falhou', motivo: 'pede-texto' });
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
  });

  it('sem botão de custo: sem-botao', async () => {
    const { d, ordem, deps } = cenario({ semBotao: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { estado: 'falhou', motivo: 'sem-botao' });
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
  });

  it('botão de custo desabilitado: indisponivel', async () => {
    const { d, ordem, deps } = cenario({ botaoDesabilitado: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { estado: 'falhou', motivo: 'indisponivel' });
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
  });
});

describe('utilitários', () => {
  it('desabilitado vê disabled e aria-disabled', () => {
    assert.equal(D.desabilitado(el({ disabled: true })), true);
    assert.equal(D.desabilitado(el({ attrs: { 'aria-disabled': 'true' } })), true);
    assert.equal(D.desabilitado(el()), false);
  });

  it('digitos tira pontos e espaços', () => {
    assert.equal(D.digitos('1.000'), '1000');
    assert.equal(D.digitos('300 pts'), '300');
  });

  it('clicar devolve false sem elemento', () => {
    assert.equal(D.clicar(null), false);
    const b = el();
    assert.equal(D.clicar(b), true);
    assert.equal(b.clicks, 1);
  });
});

describe('logado com tela de login (T1)', () => {
  it('user-menu-toggle com login-button é deslogado, não logado', () => {
    const d = doc({ [S.logado[0]]: el(), [S.deslogado[0]]: el() });
    const f = D.lerFatos(d, { pathname: '/x' }, null).fatos;
    assert.equal(f.logado, false);
    assert.equal(f.deslogado, true);
  });

  it('user-menu-toggle sem tela de login é logado', () => {
    const f = D.lerFatos(doc({ [S.logado[0]]: el() }), { pathname: '/x' }, null).fatos;
    assert.equal(f.logado, true);
    assert.equal(f.deslogado, false);
  });
});

describe('acharRecompensa: igualdade primeiro (O1) e só botões (T2)', () => {
  function centroCom(textos) {
    const centro = el();
    centro.listas['button,[role="button"]'] = textos.map((t) => el({ tag: 'button', textContent: t }));
    return doc({ [S.centro[0]]: centro });
  }

  it('título exato escolhe o botão exato, não o nome maior parecido', () => {
    const d = centroCom(['Bônus XP (2x)', 'Bônus XP']);
    const achado = D.acharRecompensa(d, 'Bônus XP');
    assert.equal(D.textoDe(achado), 'Bônus XP');
  });

  it('dois candidatos só por contenção: não clica em nenhum', () => {
    assert.equal(D.acharRecompensa(centroCom(['Bônus XP (2x)', 'Bônus XP (3x)']), 'Bônus XP'), null);
  });

  it('dois botões exatamente iguais: não clica em nenhum', () => {
    assert.equal(D.acharRecompensa(centroCom(['Bônus XP', 'bônus  xp']), 'Bônus XP'), null);
  });

  it('um único candidato por contenção é aceito', () => {
    const achado = D.acharRecompensa(centroCom(['Bônus XP (2x)']), 'Bônus XP');
    assert.equal(D.textoDe(achado), 'Bônus XP (2x)');
  });

  it('ignora o que não é botão: um div com o título não é candidato', () => {
    const centro = el();
    centro.todos = [el({ tag: 'div', textContent: 'Bônus XP' })];
    assert.equal(D.acharRecompensa(doc({ [S.centro[0]]: centro }), 'Bônus XP'), null);
  });
});

describe('botão de confirmação confere o custo no diálogo (O1)', () => {
  it('seletor dedicado com o custo no diálogo é aceito', () => {
    const dedicado = el({ tag: 'button' });
    const centro = el();
    cartaNoCentro(centro, 'Bônus XP 300', 'Bônus XP');
    noCentro(centro, dedicado);
    const d = doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado });
    assert.equal(D.acharBotaoResgatar(d, 300, 'Bônus XP'), dedicado);
  });

  it('seletor dedicado com custo diferente no diálogo não é clicado', async () => {
    const ordem = [];
    const d = doc();
    const centro = el({ textContent: 'Confirmar por 500 pontos' });
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.onClick = () => ordem.push('item');
    centro.listas['button,[role="button"]'] = [item];
    const dedicado = el({ tag: 'button' });
    d.mapa[S.resgatar[0]] = dedicado;
    const resumo = el({ tag: 'button', textContent: '1.234' });
    let aberto = false;
    resumo.onClick = () => {
      ordem.push('resumo');
      aberto = !aberto;
      if (aberto) d.mapa[S.centro[0]] = centro;
      else delete d.mapa[S.centro[0]];
    };
    d.mapa[S.botaoPontos[0]] = resumo;
    const deps = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps);
    assert.deepEqual(res, { estado: 'falhou', motivo: 'sem-botao' });
    assert.equal(dedicado.clicks, 0);
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
  });
});

describe('acharRecompensa: busca básica', () => {
  it('acha o botão pelo texto, ignorando caixa e espaços', () => {
    const centro = el();
    const botao = el({ tag: 'button', textContent: '  BÔNUS   xp ' });
    centro.listas['button,[role="button"]'] = [botao];
    assert.equal(D.acharRecompensa(doc({ [S.centro[0]]: centro }), 'bônus XP'), botao);
  });

  it('sem botão com o texto, acha pelo [title] e sobe ao botão', () => {
    const botao = el({ tag: 'button' });
    const dentro = el({ tag: 'span', attrs: { title: 'Bônus XP' } });
    dentro.parent = botao;
    const centro = el();
    botao.parent = centro;
    centro.listas['[title]'] = [dentro];
    assert.equal(D.acharRecompensa(doc({ [S.centro[0]]: centro }), 'Bônus XP'), botao);
  });

  it('não acha nada: null', () => {
    assert.equal(D.acharRecompensa(doc({ [S.centro[0]]: el() }), 'Bônus XP'), null);
    assert.equal(D.acharRecompensa(doc({}), ''), null);
  });
});

describe('item fora do centro não é clicado (item 1)', () => {
  it('closest sobe até um role=button externo que tem o título: nada clicado', async () => {
    const ordem = [];
    const d = doc();
    const externo = el({ tag: 'div', attrs: { role: 'button' } });
    const centro = el();
    centro.parent = externo;
    d.mapa[S.centro[0]] = centro;
    const inner = el({ tag: 'span', attrs: { title: 'Bônus XP' }, textContent: 'Bônus XP' });
    inner.parent = centro;
    centro.todos = [inner];
    inner.onClick = () => ordem.push('inner');
    assert.equal(D.acharRecompensa(d, 'Bônus XP'), null);
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => ordem.push('resumo');
    d.mapa[S.botaoPontos[0]] = resumo;
    const esperarJa = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.ok(['sem-centro', 'sem-recompensa'].includes(res.motivo));
    assert.equal(externo.clicks, 0);
    assert.equal(inner.clicks, 0);
    assert.ok(!ordem.includes('inner'));
  });
});

describe('confirmação falha fechado (O-3)', () => {
  it('dois cartões de custo 300 com títulos diferentes, sem seletor dedicado: nada clicado', () => {
    const centro = el();
    cartaNoCentro(centro, 'Hidratar 300', 'Hidratar');
    cartaNoCentro(centro, 'Bônus XP 300', 'Bônus XP');
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro }), 300, 'Bônus XP'), null);
  });

  it('seletor dedicado presente, mas o centro sem o título pedido: nada clicado', () => {
    const centro = el();
    cartaNoCentro(centro, 'Hidratar 300', 'Hidratar');
    const dedicado = el({ tag: 'button' });
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
  });

  it('seletor dedicado, título e custo certos no mesmo li de Bônus XP 500: clica', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [
      no('li', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '300')]),
      no('li', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '500'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 500, 'Bônus XP'), dedicado);
  });
});

// Árvore com pai, filhos e textContent concatenado, como no navegador.
function no(tag, attrs, texto, filhos = []) {
  const n = el({ tag, attrs, textContent: texto });
  n.children = filhos;
  filhos.forEach((f) => { f.parent = n; });
  n.textContent = texto + filhos.map((f) => f.textContent).join('');
  return n;
}

describe('subida da carta para no cartão (correção 3)', () => {
  it('cenário 9: detalhe de Hidratar 300 sobre a grade, Bônus XP sem custo no cartão: nada, sem clique', () => {
    const dedicado = el({ tag: 'button' });
    const grade = no('div', { class: 'grade' }, '', [
      no('div', { class: 'card' }, '', [no('span', {}, 'Bônus XP')]),
      no('div', { class: 'card' }, '', [no('span', {}, 'Hidratar'), no('span', {}, '300')]),
    ]);
    const detalhe = no('div', { role: 'dialog' }, '', [no('h2', {}, 'Hidratar'), no('span', {}, '300'), dedicado]);
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [grade, detalhe]);
    const d = doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado });
    assert.equal(D.acharBotaoResgatar(d, 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('cenário 1: cartão com wrapper, título e custo dentro do mesmo cartão: clica', () => {
    const dedicado = el({ tag: 'button' });
    const carta = no('div', { class: 'carta' }, '', [
      no('h3', {}, '', [no('span', {}, 'Bônus XP')]),
      no('span', {}, '300'),
    ]);
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [carta, dedicado]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });

  it('caso feliz: título e custo irmãos dentro de um cartão: clica', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      dedicado,
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });

  it('cenário 4: custo num irmão do cartão, com outro cartão ao lado: nada', () => {
    const dedicado = el({ tag: 'button' });
    const linha = no('div', {}, '', [
      no('div', { class: 'cartao' }, '', [no('span', {}, 'Bônus XP')]),
      no('div', { class: 'coluna' }, '', [no('span', {}, '300')]),
    ]);
    const outro = no('div', { class: 'cartao2' }, '', [no('span', {}, 'Hidratar'), no('span', {}, '300')]);
    const rodape = no('div', { class: 'rodape' }, '', [dedicado]);
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [linha, outro, rodape]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
  });

  it('botão de confirmação num rodapé só dele, ao lado do título e do custo: clica', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const detalhe = no('div', { role: 'dialog' }, '', [
      no('div', {}, '', [no('h2', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('div', { class: 'rodape' }, '', [dedicado]),
    ]);
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [detalhe]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });

  it('botão de confirmação dentro do cartão de outra recompensa: nada', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [
      no('div', { class: 'xp' }, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('div', { class: 'outra' }, '', [no('span', {}, 'Hidratar'), no('span', {}, '300'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
  });

  it('cenário 7: cartão sem título ao lado do cartão de Bônus XP, botão num rodapé só dele: nada', () => {
    const dedicado = el({ tag: 'button' });
    const grade = no('div', {}, '', [
      no('div', { class: 'a' }, '', [no('span', {}, 'Hidratar'), no('span', {}, '300')]),
      no('div', { class: 'b' }, '', [no('span', {}, 'Bônus XP')]),
    ]);
    const rodape = no('div', { class: 'rodape' }, '', [dedicado]);
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [grade, rodape]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
  });

  it('cartões li: Bônus XP sem botão e Hidratar com o botão dentro: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [
      no('li', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('li', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '300'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('cartão do título em li e o botão num div de outra recompensa: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [
      no('li', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('div', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '300'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('cartão do título em button e o botão num article de outra recompensa: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [
      no('button', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('article', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '300'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('botão fora do centro, num div com texto ao lado do centro, em body: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
    ]);
    const fora = no('div', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '300'), dedicado]);
    const body = no('body', {}, '', [centro, fora]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
    assert.equal(fora.parent, body);
  });

  it('botão dentro do mesmo li que tem título e custo: clica', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', { id: 'channel-points-reward-center-body' }, '', [
      no('li', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });
});

describe('centro, diálogos e títulos (diagnóstico de sem-recompensa)', () => {
  const esperarJa = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };

  it('diálogo alheio aberto antes do clique: clica no botão de pontos e busca no centro certo', async () => {
    const ordem = [];
    const alheio = el({ tag: 'div', attrs: { role: 'dialog' } });
    const d = doc({}, [alheio]);
    const centro = el();
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.onClick = () => ordem.push('item');
    centro.listas['button,[role="button"]'] = [item];
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { ordem.push('resumo'); d.mapa[S.centro[0]] = centro; };
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
    assert.equal(alheio.clicks, 0);
    assert.equal(res.motivo, 'sem-botao');
  });

  it('diálogo genérico aberto antes do clique que contém a recompensa, sem centro específico: não é centro, sem clique no item', async () => {
    const ordem = [];
    const d = doc();
    const generico = el({ tag: 'div', attrs: { role: 'dialog' } });
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.onClick = () => ordem.push('item');
    generico.listas['button,[role="button"]'] = [item];
    d.dialogos.push(generico);
    const dedicado = el({ tag: 'button' });
    d.mapa[S.resgatar[0]] = dedicado;
    noCentro(generico, dedicado);
    cartaNoCentro(generico, 'Bônus XP 300', 'Bônus XP');
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => ordem.push('resumo');
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { estado: 'falhou', motivo: 'sem-centro' });
    assert.equal(item.clicks, 0);
    assert.equal(dedicado.clicks, 0);
    // Pré-checagem clica o resumo (nenhum centro aberto); o painel genérico não entra na conta.
    assert.deepEqual(ordem, ['resumo']);
  });

  it('diálogo genérico com a recompensa que aparece depois do clique, sem centro específico: nada clicado dentro dele', async () => {
    const ordem = [];
    const d = doc();
    const generico = el({ tag: 'div', attrs: { role: 'dialog' } });
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.onClick = () => ordem.push('item');
    generico.listas['button,[role="button"]'] = [item];
    const dedicado = el({ tag: 'button' });
    dedicado.onClick = () => ordem.push('confirma');
    d.mapa[S.resgatar[0]] = dedicado;
    noCentro(generico, dedicado);
    cartaNoCentro(generico, 'Bônus XP 300', 'Bônus XP');
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { ordem.push('resumo'); d.dialogos.push(generico); };
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { estado: 'falhou', motivo: 'sem-centro' });
    assert.equal(item.clicks, 0);
    assert.equal(dedicado.clicks, 0);
    assert.deepEqual(ordem, ['resumo']);
  });

  it('diálogo genérico aberto antes sem a recompensa e centro específico após o clique: usa o específico', async () => {
    const d = doc();
    const generico = el({ tag: 'div', attrs: { role: 'dialog' } });
    const aviso = el({ tag: 'button', textContent: 'Entendi' });
    generico.listas['button,[role="button"]'] = [aviso];
    d.dialogos.push(generico);
    const centro = el();
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    centro.listas['button,[role="button"]'] = [item];
    const dedicado = el({ tag: 'button' });
    d.mapa[S.resgatar[0]] = dedicado;
    noCentro(centro, dedicado);
    cartaNoCentro(centro, 'Bônus XP 300', 'Bônus XP');
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { d.mapa[S.centro[0]] = centro; };
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { estado: 'clicado', motivo: '' });
    assert.equal(item.clicks, 1);
    assert.equal(dedicado.clicks, 1);
    assert.equal(aviso.clicks, 0);
  });

  it('diálogo genérico aberto antes sem a recompensa e sem centro específico: sem-centro, nenhum clique', async () => {
    const ordem = [];
    const d = doc();
    const generico = el({ tag: 'div', attrs: { role: 'dialog' } });
    const aviso = el({ tag: 'button', textContent: 'Entendi' });
    generico.listas['button,[role="button"]'] = [aviso];
    d.dialogos.push(generico);
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => ordem.push('resumo');
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { estado: 'falhou', motivo: 'sem-centro' });
    assert.equal(aviso.clicks, 0);
    assert.deepEqual(ordem, ['resumo']);
  });

  it('diálogo novo sem a recompensa que aparece depois do clique: sem-centro, só clique no resumo', async () => {
    const ordem = [];
    const d = doc();
    const alheio = el({ tag: 'div', attrs: { role: 'dialog' } });
    const aviso = el({ tag: 'button', textContent: 'Entendi' });
    alheio.listas['button,[role="button"]'] = [aviso];
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { ordem.push('resumo'); d.dialogos.push(alheio); };
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { estado: 'falhou', motivo: 'sem-centro' });
    assert.equal(aviso.clicks, 0);
    assert.deepEqual(ordem, ['resumo']);
  });

  it('centro some durante a espera do item: a guarda impede o clique mesmo com o item alcançável pelo doc', async () => {
    const ordem = [];
    const d = doc();
    const centro = el();
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.onClick = () => ordem.push('item');
    // Item só alcançável pelo documento (não pelo centro): sem a guarda, buscarRecompensa cairia no doc e clicaria.
    d.querySelectorAll = (sel) => (sel === 'button,[role="button"]' ? [item] : []);
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => {
      ordem.push('resumo');
      d.mapa[S.centro[0]] = centro;
    };
    d.mapa[S.botaoPontos[0]] = resumo;
    let esperas = 0;
    const deps = {
      esperar: (fn) => {
        esperas += 1;
        // Centro some na segunda chamada de esperar (a busca do item).
        if (esperas === 2) delete d.mapa[S.centro[0]];
        // Como o esperar real: tenta fn mais de uma vez antes de desistir.
        let achado = null;
        for (let tentativa = 0; tentativa < 3 && !achado; tentativa += 1) achado = fn();
        return Promise.resolve(achado);
      },
      pausa: () => Promise.resolve(),
    };
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps);
    assert.deepEqual(res, { estado: 'falhou', motivo: 'sem-centro' });
    assert.equal(item.clicks, 0);
    assert.deepEqual(ordem, ['resumo']);
  });

  it('centro não aparece depois do clique: sem-centro', async () => {
    const ordem = [];
    const d = doc();
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => ordem.push('resumo');
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { estado: 'falhou', motivo: 'sem-centro' });
    assert.deepEqual(ordem, ['resumo']);
  });

  it('diálogo que aparece depois do clique, sem seletor específico, não vira o centro', async () => {
    const d = doc();
    const generico = el({ tag: 'div', attrs: { role: 'dialog' } });
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    generico.listas['button,[role="button"]'] = [item];
    const dedicado = el({ tag: 'button' });
    d.mapa[S.resgatar[0]] = dedicado;
    noCentro(generico, dedicado);
    cartaNoCentro(generico, 'Bônus XP 300', 'Bônus XP');
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { if (!d.dialogos.includes(generico)) d.dialogos.push(generico); };
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { estado: 'falhou', motivo: 'sem-centro' });
    assert.equal(item.clicks, 0);
    assert.equal(dedicado.clicks, 0);
  });

  it('dois botões aninhados com o título: um clique, no interno', () => {
    const inner = el({ tag: 'button', textContent: 'Bônus XP 300' });
    const outer = el({ tag: 'div', attrs: { role: 'button' }, textContent: 'Bônus XP 300' });
    inner.parent = outer;
    const centro = el();
    centro.todos = [outer, inner];
    assert.equal(D.acharRecompensa(doc({ [S.centro[0]]: centro }), 'Bônus XP'), inner);
  });

  it('dois cartões disjuntos com o título: recompensa-ambigua, sem clique', async () => {
    const d = doc();
    const centro = el();
    const a = el({ tag: 'button', textContent: 'Bônus XP (2x)' });
    const b = el({ tag: 'button', textContent: 'Bônus XP (3x)' });
    centro.listas['button,[role="button"]'] = [a, b];
    d.mapa[S.centro[0]] = centro;
    const ordem = [];
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => ordem.push('resumo');
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.deepEqual(res, { estado: 'falhou', motivo: 'recompensa-ambigua', vistos: ['Bônus XP (2x)', 'Bônus XP (3x)'] });
    assert.equal(a.clicks + b.clicks, 0);
    assert.deepEqual(ordem, ['resumo']);
  });

  it('título com zero-width e NFD casa', () => {
    const botao = el({ tag: 'button', textContent: 'Bônus​ XP' });
    const centro = el();
    centro.listas['button,[role="button"]'] = [botao];
    assert.equal(D.acharRecompensa(doc({ [S.centro[0]]: centro }), 'Bônus XP'), botao);
  });

  it('vistos: títulos do centro, até 45 caracteres', async () => {
    const d = doc();
    const centro = el();
    centro.listas['button,[role="button"]'] = [
      el({ tag: 'button', textContent: 'Hidratar 300' }),
      el({ tag: 'button', textContent: 'x'.repeat(60) }),
    ];
    d.mapa[S.centro[0]] = centro;
    d.mapa[S.botaoPontos[0]] = el({ tag: 'button', textContent: '1.234' });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), {
      estado: 'falhou', motivo: 'sem-recompensa', vistos: ['Hidratar 300', 'x'.repeat(45)],
    });
  });
});

describe('regra fechada do botão de confirmação (correção 4)', () => {
  const CENTRO = { id: 'channel-points-reward-center-body' };

  it('botão sem texto num div fora do centro, com o título no centro: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
    ]);
    const fora = no('div', {}, '', [dedicado]);
    no('body', {}, '', [centro, fora]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('invólucro sem texto ao lado do cartão de B (li), cartão de A (li) sem botão: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', CENTRO, '', [
      no('li', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('li', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '500')]),
      no('div', {}, '', [dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('rodapé compartilhado da grade: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [
        no('li', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
        no('li', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '500')]),
      ]),
      no('div', { class: 'rodape' }, '', [dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('só Bônus XP Plus com 300 e o botão no cartão: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', CENTRO, '', [
      no('li', {}, '', [no('span', {}, 'Bônus XP Plus'), no('span', {}, '300'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('dois blocos div, Bônus XP 300 e Hidratar 500, com o botão no centro: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('div', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '500')]),
      dedicado,
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('detalhe com título, custo, descrição que cita o título e rodapé com o botão: clica', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const detalhe = no('div', { role: 'dialog' }, '', [
      no('h2', {}, 'Bônus XP'),
      no('span', {}, '300'),
      no('p', {}, 'Ganhe Bônus XP por hora'),
      no('div', { class: 'rodape' }, '', [dedicado]),
    ]);
    const centro = no('div', CENTRO, '', [detalhe]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });

  it('custo só no texto do botão (Resgatar 300): clica', () => {
    const dedicado = no('button', {}, 'Resgatar 300');
    const centro = no('div', CENTRO, '', [no('span', {}, 'Bônus XP'), dedicado]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });

  it('botão Voltar sem número, ao lado do cartão Bônus XP 300 no centro: clica', () => {
    const dedicado = no('button', {}, 'Voltar');
    const centro = el(CENTRO);
    cartaNoCentro(centro, 'Bônus XP 300', 'Bônus XP');
    noCentro(centro, dedicado);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });

  it('custo com texto (500 pontos) ao lado de Bônus XP 300, botão de Hidratar: nada', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('div', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '500 pontos'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('título, 300, descrição Receba XP por 1 hora e rodapé com o botão: clica', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', CENTRO, '', [
      no('div', { role: 'dialog' }, '', [
        no('h2', {}, 'Bônus XP'),
        no('span', {}, '300'),
        no('p', {}, 'Receba XP por 1 hora'),
        no('div', { class: 'rodape' }, '', [dedicado]),
      ]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });

  it('li com texto solto Hidratar, filhos Bônus XP e 300 e o botão dentro: nada', () => {
    const dedicado = el({ tag: 'button' });
    const li = no('li', {}, 'Hidratar', [no('span', {}, 'Bônus XP'), no('span', {}, '300'), dedicado]);
    const centro = no('div', CENTRO, '', [li]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('div Hidratar com Custa 500 pontos e botão ao lado de Bônus XP 300: nada', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('div', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, 'Custa 500 pontos'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('o mesmo com Custo: 500 pts: nada', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('div', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, 'Custo: 500 pts'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('Esta recompensa custa 500 pontos ao lado de título e custo, rodapé só do botão: nada', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('p', {}, 'Esta recompensa custa 500 pontos'),
      no('div', { class: 'rodape' }, '', [dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('G11a: folhas Hidratar, 300 e Bônus XP soltas com o botão: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Hidratar'), no('span', {}, '300'), no('span', {}, 'Bônus XP'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('G11b: Bônus XP e 300, e abaixo um div com Hidratar e o botão: nada', () => {
    const dedicado = el({ tag: 'button' });
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('div', {}, '', [no('span', {}, 'Hidratar'), dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('duas frases longas ao lado de título e custo: nada', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('p', {}, 'Receba XP por uma hora inteira'),
      no('p', {}, 'Ganhe XP todo dia sem parar'),
      no('div', { class: 'rodape' }, '', [dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('texto curto Dobra o XP ao lado de título e custo: nada (limite conhecido da regra fechada)', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('p', {}, 'Dobra o XP'),
      no('div', { class: 'rodape' }, '', [dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), null);
    assert.equal(dedicado.clicks, 0);
  });

  it('Fechar como botão de texto no centro, com título, custo e rodapé do botão: clica', () => {
    const dedicado = no('button', {}, 'Resgatar');
    const centro = no('div', CENTRO, '', [
      no('div', {}, '', [no('span', {}, 'Bônus XP'), no('span', {}, '300')]),
      no('button', {}, 'Fechar'),
      no('div', { class: 'rodape' }, '', [dedicado]),
    ]);
    assert.equal(D.acharBotaoResgatar(doc({ [S.centro[0]]: centro, [S.resgatar[0]]: dedicado }), 300, 'Bônus XP'), dedicado);
  });
});
