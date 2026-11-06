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
    get tagName() {
      return String(this.tag).toUpperCase();
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

describe('botoesDoCentro', () => {
  function centroCom(botoes) {
    const centro = el();
    for (const b of botoes) b.parent = centro;
    centro.listas['button,[role="button"]'] = botoes;
    return centro;
  }

  it('Redeem com dts RequestRewardButton e custo 300: atributos curtos, custo true, sem texto exportado', () => {
    const redeem = el({ tag: 'button', textContent: 'Resgatar 300', attrs: { 'data-test-selector': 'RequestRewardButton', 'aria-label': 'Resgatar' } });
    const d = doc({ [S.centro[0]]: centroCom([redeem]) });
    const out = D.botoesDoCentro(d, 300);
    assert.deepEqual(out, [{ dts: 'RequestRewardButton', alvo: '', aria: 'Resgatar', tab: false, custo: true, desab: false }]);
    assert.equal(D.contarBotoesCentro(d), 1);
    assert.equal(JSON.stringify(out).includes('Resgatar 300'), false);
  });

  it('botão sem atributos: tudo vazio ou falso', () => {
    const d = doc({ [S.centro[0]]: centroCom([el({ tag: 'button' })]) });
    assert.deepEqual(D.botoesDoCentro(d, 300), [{ dts: '', alvo: '', aria: '', tab: false, custo: false, desab: false }]);
  });

  it('dígito em atributo vira #, data-a-target entra curto', () => {
    const b = el({ tag: 'button', attrs: { 'aria-label': 'Canal 2', 'data-a-target': 'reward-1' } });
    const out = D.botoesDoCentro(doc({ [S.centro[0]]: centroCom([b]) }), 300);
    assert.equal(out[0].aria, 'Canal #');
    assert.equal(out[0].alvo, 'reward-#');
  });

  it('tab no ancestral até a raiz, disabled e aria-disabled marcam desab', () => {
    const centro = el();
    const tab = el({ tag: 'div', attrs: { role: 'tab' }, parent: centro });
    const dentroTab = el({ tag: 'button', parent: tab });
    const desab1 = el({ tag: 'button', disabled: true });
    const desab2 = el({ tag: 'button', attrs: { 'aria-disabled': 'true' } });
    centro.listas['button,[role="button"]'] = [dentroTab, desab1, desab2];
    const out = D.botoesDoCentro(doc({ [S.centro[0]]: centro }), 300);
    assert.deepEqual(out.map((b) => [b.tab, b.desab]), [[true, false], [false, true], [false, true]]);
  });

  it('limite de 24 botões: 24 na ordem do DOM, total continua contando todos', () => {
    const botoes = Array.from({ length: 25 }, (_, i) => el({ tag: 'button', attrs: { 'aria-label': 'Botao ' + String.fromCharCode(65 + i) } }));
    const d = doc({ [S.centro[0]]: centroCom(botoes) });
    const out = D.botoesDoCentro(d, 300);
    assert.equal(out.length, 24);
    assert.equal(out[0].aria, 'Botao A');
    assert.equal(out[23].aria, 'Botao X');
    assert.equal(D.contarBotoesCentro(d), 25);
  });

  it('24 botões exatos: todos entram, total 24', () => {
    const botoes = Array.from({ length: 24 }, () => el({ tag: 'button' }));
    const d = doc({ [S.centro[0]]: centroCom(botoes) });
    assert.equal(D.botoesDoCentro(d, 300).length, 24);
    assert.equal(D.contarBotoesCentro(d), 24);
  });

  it('raiz null: devolve [] e total 0', () => {
    assert.deepEqual(D.botoesDoCentro(doc({}), 300), []);
    assert.equal(D.contarBotoesCentro(doc({})), 0);
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
    assert.deepEqual(res, { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['resumo', 'item', 'botao', 'resumo']);
  });

  it('cardClicado: busca por título clicada devolve o item; item desabilitado não clica e fica null', async () => {
    const { d, deps } = cenario();
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps);
    assert.deepEqual(res.cardClicado, { dts: '', alvo: '', aria: '', custo: false, desab: false });
    const semClique = cenario({ itemDesabilitado: true });
    const r2 = await D.resgatar(semClique.d, { titulo: 'Bônus XP', custo: 300 }, semClique.deps);
    assert.equal(r2.motivo, 'indisponivel');
    assert.equal(r2.cardClicado, null);
  });

  it('sem resumo: falha sem clicar em nada', async () => {
    const { d, ordem, deps } = cenario({ semResumo: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { cardClicado: null, estado: 'falhou', motivo: 'sem-resumo' });
    assert.deepEqual(ordem, []);
  });

  it('sem recompensa: fecha o centro', async () => {
    const { d, ordem, deps } = cenario({ semItem: true });
    // dialogos: [] entrou no sem-recompensa (diagnóstico); vistos segue só com custos.
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { cardClicado: null, estado: 'falhou', motivo: 'sem-recompensa', vistos: [], dialogos: [] });
    assert.deepEqual(ordem, ['resumo', 'resumo']);
  });

  it('recompensa desabilitada: indisponivel, e fecha', async () => {
    const { d, ordem, deps } = cenario({ itemDesabilitado: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { cardClicado: null, estado: 'falhou', motivo: 'indisponivel' });
    assert.deepEqual(ordem, ['resumo', 'resumo']);
  });

  it('recompensa que pede texto: pede-texto, e fecha', async () => {
    const { d, ordem, deps } = cenario({ campo: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'falhou', motivo: 'pede-texto' });
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
  });

  it('sem-botao traz botoesCentro e totalBotoesCentro, lidos com o centro ainda aberto', async () => {
    const { d, deps } = cenario({ semBotao: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps);
    assert.equal(res.totalBotoesCentro, 1);
    assert.deepEqual(res.botoesCentro, [{ dts: '', alvo: '', aria: '', tab: false, custo: false, desab: false }]);
  });

  it('sem botão de custo: sem-botao', async () => {
    const { d, ordem, deps } = cenario({ semBotao: true });
    // Agora o sem-botao traz fase, trava e diálogos. Sem seletor dedicado a trava é sem-dedicado.
    const { dialogos, botoesCentro, totalBotoesCentro, ...res } = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps);
    assert.deepEqual(res, { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'falhou', motivo: 'sem-botao', fase: 'confirmar', trava: 'sem-dedicado' });
    assert.ok(Array.isArray(dialogos));
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
  });

  it('botão de custo desabilitado: indisponivel', async () => {
    const { d, ordem, deps } = cenario({ botaoDesabilitado: true });
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'falhou', motivo: 'indisponivel' });
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
  });
});

describe('diag da leitura de fatos (sem texto da página)', () => {
  it('conta seletores, botões e tamanho do saldo, sem nenhum texto', () => {
    const resumo = el({ tag: 'div', textContent: 'Saldo secreto 1.234' });
    resumo.listas.button = [el({ tag: 'button' }), el({ tag: 'button' }), el({ tag: 'button' })];
    const mapa = doc({
      [S.logado[0]]: el(),
      [S.resumo[0]]: resumo,
      [S.botaoPontos[0]]: el({ tag: 'button' }),
      [S.saldo[0]]: el({ textContent: '1.234' }),
      [S.centro[1]]: el(),
    });
    const diag = D.lerFatos(mapa, { pathname: '/x' }, null).fatos.diag;
    assert.deepEqual(diag, {
      resumo: true,
      botaoPontos: true,
      botoesNoResumo: 3,
      botoesResumo: [
        { dts: '', alvo: '', aria: '' },
        { dts: '', alvo: '', aria: '' },
        { dts: '', alvo: '', aria: '' },
      ],
      saldoSeletor: 0,
      saldoTamanho: 5,
      saldoLido: true,
      centroSeletor: 1,
    });
    for (const [k, v] of Object.entries(diag)) if (k !== 'botoesResumo') assert.ok(typeof v === 'number' || typeof v === 'boolean');
    const texto = JSON.stringify(diag);
    assert.equal(texto.includes('secreto'), false);
    assert.equal(texto.includes('1.234'), false);
  });

  it('página sem nada: tudo falso, zero ou -1, sem texto', () => {
    const diag = D.lerFatos(doc({}), { pathname: '/x' }, null).fatos.diag;
    assert.deepEqual(diag, {
      resumo: false,
      botaoPontos: false,
      botoesNoResumo: 0,
      botoesResumo: [],
      saldoSeletor: -1,
      saldoTamanho: 0,
      saldoLido: false,
      centroSeletor: -1,
    });
  });
});

describe('botões do resumo, fase e pistas do sem-centro', () => {
  const esperarJa = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };

  it('botoesResumo: atributos curtos, dígito vira #, controle sai, textContent ignorado, máximo 4', () => {
    const botoes = [0, 1, 2, 3, 4].map((i) => el({
      tag: 'button',
      textContent: 'SEGREDO 99',
      attrs: { 'data-test-selector': `pts-${i}`, 'data-a-target': 'alvo\u0001x', 'aria-label': 'Abrir 12 itens' },
    }));
    const resumo = el({ tag: 'div' });
    resumo.listas.button = botoes;
    const diag = D.lerFatos(doc({ [S.botaoPontos[0]]: el({ tag: 'button' }), [S.resumo[0]]: resumo }), { pathname: '/x' }, null).fatos.diag;
    assert.equal(diag.botoesResumo.length, 4);
    assert.deepEqual(diag.botoesResumo[0], { dts: 'pts-#', alvo: 'alvox', aria: 'Abrir ## itens' });
    assert.equal(JSON.stringify(diag).includes('SEGREDO'), false);
  });

  it('botoesResumo: corta em 40 caracteres e sem resumo fica vazio', () => {
    const resumo = el({ tag: 'div' });
    resumo.listas.button = [el({ tag: 'button', attrs: { 'aria-label': 'x'.repeat(60) } })];
    const com = D.lerFatos(doc({ [S.resumo[0]]: resumo }), { pathname: '/x' }, null).fatos.diag;
    assert.equal(com.botoesResumo[0].aria.length, 40);
    const sem = D.lerFatos(doc({}), { pathname: '/x' }, null).fatos.diag;
    assert.deepEqual(sem.botoesResumo, []);
  });

  it('fase confirmar: o centro some depois do clique no item', async () => {
    const d = doc();
    const centro = el();
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.onClick = () => { delete d.mapa[S.centro[0]]; };
    centro.listas['button,[role="button"]'] = [item];
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { d.mapa[S.centro[0]] = centro; };
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), {
      cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false },
      estado: 'falhou', motivo: 'sem-centro', fase: 'confirmar', clicou: true, pistas: [], dialogoAntes: false, dialogos: [], pistasAntes: [], cabecalho: { achado: false, cadeia: [] }, classes: [],
    });
    assert.equal(item.clicks, 1);
  });

  it('clicou=false quando o centro já estava aberto: não clica no resumo', async () => {
    const d = doc();
    const centro = el();
    d.mapa[S.centro[0]] = centro;
    const resumo = el({ tag: 'button', textContent: '1.234' });
    d.mapa[S.botaoPontos[0]] = resumo;
    let n = 0;
    const deps = {
      esperar: (fn) => {
        n += 1;
        // Centro some na busca (segunda espera).
        if (n === 2) delete d.mapa[S.centro[0]];
        return Promise.resolve(fn());
      },
      pausa: () => Promise.resolve(),
    };
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps), {
      cardClicado: null,
      estado: 'falhou', motivo: 'sem-centro', fase: 'buscar', clicou: false, pistas: [], dialogoAntes: false, dialogos: [], pistasAntes: [], cabecalho: { achado: false, cadeia: [] }, classes: [],
    });
    assert.equal(resumo.clicks, 0);
  });

  it('centro já aberto antes do resgate: clique no item, centro some, clicou=true na fase confirmar', async () => {
    const d = doc();
    const centro = el();
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.onClick = () => { delete d.mapa[S.centro[0]]; };
    centro.listas['button,[role="button"]'] = [item];
    d.mapa[S.centro[0]] = centro;
    const resumo = el({ tag: 'button', textContent: '1.234' });
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), {
      cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false },
      estado: 'falhou', motivo: 'sem-centro', fase: 'confirmar', clicou: true, pistas: [], dialogoAntes: false, dialogos: [], pistasAntes: [], cabecalho: { achado: false, cadeia: [] }, classes: [],
    });
    assert.equal(item.clicks, 1);
    assert.equal(resumo.clicks, 0);
  });

  it('role=dialog vira pista; o contador mostra só o clique no resumo', async () => {
    const d = doc();
    const alheio = el({ tag: 'div', attrs: { role: 'dialog' } });
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { d.dialogos.push(alheio); };
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), {
      cardClicado: null,
      estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true, pistas: ['div[dialog]'], pistasAntes: [], dialogoAntes: false, dialogos: [{ botoes: 0, abas: 0, itens: [], dts: [], titulo: false, campoTexto: false, antes: false }], cabecalho: { achado: false, cadeia: [] }, classes: [],
    });
    assert.equal(resumo.clicks, 1);
    assert.equal(alheio.clicks, 0);
  });

  it('pistas: sem repetição, seletores com *= e id, e no máximo 8', async () => {
    const d = doc();
    const dup = el({ tag: 'section', id: 'reward-x', attrs: { 'data-test-selector': 'reward-center-1' } });
    const dupDois = el({ tag: 'section', id: 'reward-x', attrs: { 'data-test-selector': 'reward-center-2' } });
    const dialogos = Array.from({ length: 5 }, (_, i) => el({ tag: 'div', id: `reward-${'abcde'[i]}`, attrs: { role: 'dialog' } }));
    const ids = Array.from({ length: 4 }, (_, i) => el({ tag: 'span', id: `reward-${'pqrs'[i]}` }));
    d.querySelectorAll = (sel) => {
      if (sel === '[data-test-selector*="reward" i]') return [dup, dupDois];
      if (sel === '[role="dialog"]') return dialogos;
      if (sel === '[id*="reward" i]') return ids;
      return [];
    };
    const resumo = el({ tag: 'button', textContent: '1.234' });
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    // 5 diálogos + 1 seção (a segunda cai na mesma pista) + 4 ids = 10 candidatos, cortados em 8.
    assert.equal(res.pistas.length, 8);
    assert.equal(new Set(res.pistas).size, 8);
    assert.equal(res.pistas.filter((p) => p === 'section#reward-x[reward-center-#]').length, 1);
    assert.equal(res.pistas[0], 'div#reward-a[dialog]');
  });
});

describe('dialogosDiag e dialogoAntes (diagnóstico do sem-centro)', () => {
  const esperarJa = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };

  // Diálogo com um botão (dts e aria), uma aba e, se pedido, um campo de texto.
  function dialogoComAba(texto, comCampo = false) {
    const botao = el({ tag: 'button', textContent: 'Fechar', attrs: { 'data-test-selector': 'close-btn', 'aria-label': 'Fechar 12' } });
    const aba = el({ tag: 'div', textContent: 'Aba', attrs: { role: 'tab', 'data-a-target': 'tab-2' } });
    const filhos = [botao, aba];
    const dlg = el({ tag: 'div', textContent: texto, attrs: { role: 'dialog' } });
    dlg.listas['button,[role="button"]'] = [botao];
    dlg.listas['[role="tab"]'] = [aba];
    if (comCampo) {
      const campo = el({ tag: 'textarea' });
      dlg.listas.textarea = [campo];
      filhos.push(campo);
    }
    dlg.children = filhos;
    return dlg;
  }

  it('diálogo com aba e botão: contagens, itens com tab, dts, título', () => {
    const d = doc({}, [dialogoComAba('Bônus XP 300')]);
    assert.deepEqual(D.dialogosDiag(d, 'Bônus XP'), [{
      botoes: 1,
      abas: 1,
      itens: [
        { dts: 'close-btn', alvo: '', aria: 'Fechar ##', tab: false },
        { dts: '', alvo: 'tab-#', aria: '', tab: true },
      ],
      dts: ['close-btn'],
      titulo: true,
      campoTexto: false,
      antes: false,
    }]);
  });

  it('título ausente e campo de texto presente', () => {
    const d = doc({}, [dialogoComAba('Outra coisa', true)]);
    const [r] = D.dialogosDiag(d, 'Bônus XP');
    assert.equal(r.titulo, false);
    assert.equal(r.campoTexto, true);
  });

  it('título pedido vazio ou undefined: titulo false', () => {
    const d = doc({}, [dialogoComAba('Bônus XP 300')]);
    assert.equal(D.dialogosDiag(d, '')[0].titulo, false);
    assert.equal(D.dialogosDiag(d, undefined)[0].titulo, false);
  });

  it('getAttribute que lança: dialogosDiag não quebra e devolve valores vazios', () => {
    const botao = el({ tag: 'button', textContent: 'Fechar' });
    botao.getAttribute = () => { throw new Error('boom'); };
    const dlg = el({ tag: 'div', textContent: 'Bônus XP 300', attrs: { role: 'dialog' } });
    dlg.listas['button,[role="button"]'] = [botao];
    dlg.children = [botao];
    const [r] = D.dialogosDiag(doc({}, [dlg]), 'Bônus XP');
    assert.equal(r.botoes, 1);
    assert.deepEqual(r.itens, []);
    assert.deepEqual(r.dts, []);
    assert.equal(r.titulo, true);
  });

  it('nenhum diálogo: lista vazia', () => {
    assert.deepEqual(D.dialogosDiag(doc({}), 'Bônus XP'), []);
  });

  it('seis botões sem rótulo antes de um rotulado: o rotulado aparece em itens e botoes conta os sete', () => {
    const semRotulo = Array.from({ length: 6 }, () => el({ tag: 'button' }));
    const rotulado = el({ tag: 'button', attrs: { 'aria-label': 'Fechar 12' } });
    const dlg = el({ tag: 'div', textContent: 'Bônus XP', attrs: { role: 'dialog' } });
    dlg.listas['button,[role="button"]'] = [...semRotulo, rotulado];
    dlg.children = [...semRotulo, rotulado];
    const [r] = D.dialogosDiag(doc({}, [dlg]), 'Bônus XP');
    assert.equal(r.botoes, 7);
    assert.deepEqual(r.itens, [{ dts: '', alvo: '', aria: 'Fechar ##', tab: false }]);
  });

  it('limites: 2 diálogos, 6 itens e 8 dts; botões seguem contados', () => {
    const muitos = Array.from({ length: 8 }, (_, i) => el({ tag: 'button', attrs: { 'data-test-selector': `b${'abcdefgh'[i]}` } }));
    const dlg = el({ attrs: { role: 'dialog' }, textContent: 'Bônus XP' });
    dlg.listas['button,[role="button"]'] = muitos;
    dlg.children = muitos;
    const d = doc({}, [dlg, dialogoComAba('x'), dialogoComAba('y')]);
    const res = D.dialogosDiag(d, 'Bônus XP');
    assert.equal(res.length, 2);
    assert.equal(res[0].botoes, 8);
    assert.equal(res[0].itens.length, 6);
    assert.equal(res[0].dts.length, 8);
  });

  it('dialogoAntes: true quando o diálogo já existia antes do clique; o botão do diálogo não é clicado', async () => {
    const d = doc({}, [dialogoComAba('Algo')]);
    d.mapa['[role="dialog"]'] = d.dialogos[0];
    const resumo = el({ tag: 'button', textContent: '1.234' });
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.motivo, 'sem-centro');
    assert.equal(res.dialogoAntes, true);
    assert.equal(res.dialogos.length, 1);
    assert.equal(resumo.clicks, 1);
    assert.equal(d.dialogos[0].children[0].clicks, 0);
  });

  it('diálogo aberto pelo clique: dialogoAntes false, mas o diálogo entra em dialogos', async () => {
    const d = doc();
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { d.dialogos.push(dialogoComAba('Bônus XP')); };
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.dialogoAntes, false);
    assert.equal(res.dialogos.length, 1);
    assert.equal(res.dialogos[0].titulo, true);
    assert.equal(resumo.clicks, 1);
  });

  it('nenhum diálogo: dialogoAntes false e dialogos vazio', async () => {
    const d = doc();
    d.mapa[S.botaoPontos[0]] = el({ tag: 'button', textContent: '1.234' });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.dialogoAntes, false);
    assert.deepEqual(res.dialogos, []);
  });
});

describe('cabecalhoDiag, classesPista e antes por diálogo (diagnóstico do sem-centro)', () => {
  const esperarJa = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };

  // Cadeia de ancestrais a partir de um cabeçalho: o primeiro da lista é o pai direto.
  function cadeiaDe(niveis) {
    const h = el({ tag: 'h2', id: 'channel-points-reward-center-header' });
    let atual = h;
    for (const nivel of niveis) {
      const pai = el(nivel);
      atual.parent = pai;
      atual = pai;
    }
    return h;
  }

  it('cabecalhoDiag sem cabeçalho: achado false e cadeia vazia', () => {
    assert.deepEqual(D.cabecalhoDiag(doc({}), 'Bônus XP'), { achado: false, cadeia: [] });
  });

  it('cabecalhoDiag: cadeia de 5 níveis corta em 4; no curto, classe válida e atributos curtos', () => {
    const h = cadeiaDe([
      { tag: 'section', attrs: { id: 'hdr-1', class: 'a1 b c', 'data-test-selector': 'rc-2', role: 'region' } },
      { tag: 'div', attrs: {} },
      { tag: 'div', textContent: 'Bônus XP 300' },
      { tag: 'div', closest: () => ({ tag: 'div' }) },
      { tag: 'div' },
    ]);
    const r = D.cabecalhoDiag(doc({ '[id*="reward-center-header" i]': h }), 'Bônus XP');
    assert.equal(r.achado, true);
    assert.equal(r.cadeia.length, 4);
    assert.deepEqual(r.cadeia[0], { no: 'section#hdr-#.a#[rc-#][region]', botoes: 0, titulo: false, resumo: false, dialogo: false });
    assert.equal(r.cadeia[1].no, 'div');
    assert.equal(r.cadeia[2].titulo, true);
    assert.equal(r.cadeia[3].dialogo, true);
  });

  it('cabecalhoDiag: classe com caractere inválido e classe com dígito', () => {
    const h = cadeiaDe([
      { tag: 'div', attrs: { class: 'bad!x' } },
      { tag: 'div', attrs: { class: 'ok-1 bad!cls' } },
    ]);
    const r = D.cabecalhoDiag(doc({ '[id*="reward-center-header" i]': h }), 'Bônus XP');
    assert.equal(r.cadeia[0].no, 'div');
    assert.equal(r.cadeia[1].no, 'div.ok-#');
  });

  it('cabecalhoDiag: getAttribute que lança não quebra e cai no nome da tag', () => {
    const h = cadeiaDe([{ tag: 'div', attrs: { class: 'x' } }]);
    h.parent.getAttribute = () => { throw new Error('boom'); };
    const r = D.cabecalhoDiag(doc({ '[id*="reward-center-header" i]': h }), 'Bônus XP');
    assert.equal(r.achado, true);
    assert.equal(r.cadeia[0].no, 'div');
  });

  it('cabecalhoDiag: resumo vem de contém e botões com teto', () => {
    const pai = el({ tag: 'div' });
    pai.listas['button,[role="button"]'] = Array.from({ length: 3 }, () => el({ tag: 'button' }));
    pai.listas['[data-test-selector="community-points-summary"]'] = [el({ tag: 'div' })];
    const h = cadeiaDe([]);
    h.parent = pai;
    const r = D.cabecalhoDiag(doc({ '[id*="reward-center-header" i]': h }), 'Bônus XP');
    assert.equal(r.cadeia[0].botoes, 3);
    assert.equal(r.cadeia[0].resumo, true);
  });

  it('classesPista: rc: e cp:, até 4 de cada, só classes válidas, sem repetição', () => {
    const d = doc();
    const rc = ['a', 'b', 'c', 'd', 'e'].map((l) => el({ tag: 'div', attrs: { class: `reward-center-${l} a1 bad!x` } }));
    const cp = [el({ tag: 'section', attrs: { class: 'cp-x' } }), el({ tag: 'section', attrs: { class: 'cp-x' } })];
    d.querySelectorAll = (sel) => {
      if (sel === '[class*="reward-center"]') return rc;
      if (sel === '[class*="community-points"]') return cp;
      return [];
    };
    const classes = D.classesPista(d);
    assert.equal(classes.length, 5);
    assert.equal(classes[0], 'rc:div.reward-center-a.a#');
    assert.equal(classes.filter((c) => c.startsWith('rc:')).length, 4);
    assert.deepEqual(classes.filter((c) => c.startsWith('cp:')), ['cp:section.cp-x']);
  });

  it('classesPista sem contêiner e com querySelectorAll que lança: lista vazia', () => {
    assert.deepEqual(D.classesPista(doc()), []);
    assert.deepEqual(D.classesPista({ querySelectorAll() { throw new Error('boom'); } }), []);
  });

  it('dialogosDiag com antesSet: antes por diálogo; sem o conjunto, antes false', () => {
    const a = el({ tag: 'div', textContent: 'a', attrs: { role: 'dialog' } });
    const b = el({ tag: 'div', textContent: 'b', attrs: { role: 'dialog' } });
    const d = doc({}, [a, b]);
    assert.deepEqual(D.dialogosDiag(d, 'x').map((x) => x.antes), [false, false]);
    assert.deepEqual(D.dialogosDiag(d, 'x', new Set([a])).map((x) => x.antes), [true, false]);
  });

  it('pistasAntes é diferente de pistas: o diálogo que surge no clique só entra em pistas', async () => {
    const d = doc({}, []);
    const pre = el({ tag: 'div', id: 'ra', attrs: { role: 'dialog' } });
    d.dialogos.push(pre);
    const depois = el({ tag: 'div', id: 'rb', attrs: { role: 'dialog' } });
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { d.dialogos.push(depois); };
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.deepEqual(res.pistasAntes, ['div#ra[dialog]']);
    assert.deepEqual(res.pistas, ['div#ra[dialog]', 'div#rb[dialog]']);
    assert.deepEqual(res.dialogos.map((x) => x.antes), [true, false]);
  });

  it('antes por diálogo: um já aberto antes e outro aberto pelo clique', async () => {
    const d = doc({}, []);
    const jaAberto = el({ tag: 'div', textContent: 'velho', attrs: { role: 'dialog' } });
    d.dialogos.push(jaAberto);
    const novo = el({ tag: 'div', textContent: 'novo', attrs: { role: 'dialog' } });
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => { d.dialogos.push(novo); };
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.dialogos[0].antes, true);
    assert.equal(res.dialogos[1].antes, false);
    assert.equal(res.dialogoAntes, false);
  });

  it('sem-centro leva cabecalho e classes do DOM; titulo marcado na cadeia', async () => {
    const d = doc();
    const h = cadeiaDe([{ tag: 'div', textContent: 'Bônus XP 300' }]);
    d.mapa['[id*="reward-center-header" i]'] = h;
    d.querySelectorAll = (sel) => (sel === '[class*="reward-center"]' ? [el({ tag: 'div', attrs: { class: 'rc-z' } })] : []);
    const resumo = el({ tag: 'button', textContent: '1.234' });
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.motivo, 'sem-centro');
    assert.equal(res.cabecalho.achado, true);
    assert.equal(res.cabecalho.cadeia[0].titulo, true);
    assert.deepEqual(res.classes, ['rc:div.rc-z']);
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
    const { dialogos, botoesCentro, totalBotoesCentro, ...res } = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, deps);
    assert.deepEqual(res, { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'falhou', motivo: 'sem-botao', fase: 'confirmar', trava: 'fora-do-centro' });
    assert.ok(Array.isArray(dialogos));
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
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: null, estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true, pistas: ['div[dialog]'], pistasAntes: ['div[dialog]'], dialogoAntes: false, dialogos: [{ botoes: 1, abas: 0, itens: [], dts: [], titulo: false, campoTexto: false, antes: true }], cabecalho: { achado: false, cadeia: [] }, classes: [] });
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
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: null, estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true, pistas: ['div[dialog]'], pistasAntes: [], dialogoAntes: false, dialogos: [{ botoes: 1, abas: 0, itens: [], dts: [], titulo: false, campoTexto: false, antes: false }], cabecalho: { achado: false, cadeia: [] }, classes: [] });
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
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'clicado', motivo: '' });
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
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: null, estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true, pistas: ['div[dialog]'], pistasAntes: ['div[dialog]'], dialogoAntes: false, dialogos: [{ botoes: 1, abas: 0, itens: [], dts: [], titulo: false, campoTexto: false, antes: true }], cabecalho: { achado: false, cadeia: [] }, classes: [] });
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
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: null, estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true, pistas: ['div[dialog]'], pistasAntes: [], dialogoAntes: false, dialogos: [{ botoes: 1, abas: 0, itens: [], dts: [], titulo: false, campoTexto: false, antes: false }], cabecalho: { achado: false, cadeia: [] }, classes: [] });
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
    assert.deepEqual(res, { cardClicado: null, estado: 'falhou', motivo: 'sem-centro', fase: 'buscar', clicou: true, pistas: [], pistasAntes: [], dialogoAntes: false, dialogos: [], cabecalho: { achado: false, cadeia: [] }, classes: [] });
    assert.equal(item.clicks, 0);
    assert.deepEqual(ordem, ['resumo']);
  });

  it('centro não aparece depois do clique: sem-centro', async () => {
    const ordem = [];
    const d = doc();
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => ordem.push('resumo');
    d.mapa[S.botaoPontos[0]] = resumo;
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: null, estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true, pistas: [], pistasAntes: [], dialogoAntes: false, dialogos: [], cabecalho: { achado: false, cadeia: [] }, classes: [] });
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
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: null, estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true, pistas: ['div[dialog]'], pistasAntes: [], dialogoAntes: false, dialogos: [{ botoes: 1, abas: 0, itens: [], dts: [], titulo: false, campoTexto: false, antes: false }], cabecalho: { achado: false, cadeia: [] }, classes: [] });
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
    assert.deepEqual(res, { cardClicado: null, estado: 'falhou', motivo: 'recompensa-ambigua', vistos: ['Bônus XP (2x)', 'Bônus XP (3x)'] });
    assert.equal(a.clicks + b.clicks, 0);
    assert.deepEqual(ordem, ['resumo']);
  });

  it('título com zero-width e NFD casa', () => {
    const botao = el({ tag: 'button', textContent: 'Bônus​ XP' });
    const centro = el();
    centro.listas['button,[role="button"]'] = [botao];
    assert.equal(D.acharRecompensa(doc({ [S.centro[0]]: centro }), 'Bônus XP'), botao);
  });

  it('vistos no sem-recompensa: só custos (botões só com número), nunca título nem texto de card', async () => {
    const d = doc();
    const centro = el();
    centro.listas['button,[role="button"]'] = [
      el({ tag: 'button', textContent: 'Hidratar 500' }),
      el({ tag: 'button', textContent: 'x'.repeat(60) }),
      el({ tag: 'button', textContent: '500' }),
    ];
    d.mapa[S.centro[0]] = centro;
    d.mapa[S.botaoPontos[0]] = el({ tag: 'button', textContent: '1.234' });
    // Antes vinham os títulos ('Hidratar 500', 60 x); agora o vistos é só o custo.
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.deepEqual(res, {
      cardClicado: null,
      estado: 'falhou', motivo: 'sem-recompensa', vistos: ['500'], dialogos: [],
    });
    // Nenhum texto de card (título longo, 'Hidratar 500') pode entrar em vistos.
    assert.deepEqual(res.vistos, ['500']);
    assert.ok(!res.vistos.some((v) => v.length > 45 || v.includes('Hidratar')));
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

describe('centro pelo cabeçalho com id específico (diálogo que contém o cabeçalho)', () => {
  const HDR = '#channel-points-reward-center-header';
  const esperarJa = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };

  // Diálogo de extensão: item e botão dentro de um role=dialog sem cabeçalho. Cliques registrados como ext-*.
  function dialogoExtensao(ordem, nome) {
    const dialogo = el({ tag: 'div', attrs: { role: 'dialog' } });
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.parent = dialogo;
    item.onClick = () => ordem.push(`ext-${nome}-item`);
    dialogo.listas['button,[role="button"]'] = [item];
    const botao = el({ tag: 'button', textContent: '300' });
    botao.onClick = () => ordem.push(`ext-${nome}-confirma`);
    noCentro(dialogo, botao);
    cartaNoCentro(dialogo, 'Bônus XP 300', 'Bônus XP');
    return { dialogo, item, botao };
  }

  // Cenário com cabeçalho. Por padrão o cabeçalho fica dentro de um intermediário dentro de um role=dialog.
  // Opções: hdrFora (cabeçalho em div sem diálogo), hdrDialogoProprio (o cabeçalho é o role=dialog),
  // jaAberto (cabeçalho já no mapa antes do resgate), somaAoItem (cabeçalho some depois do clique no item).
  function cenarioCabecalho(opcoes = {}) {
    const ordem = [];
    const d = doc();
    const dialogo = el({ tag: 'div', attrs: { role: 'dialog' } });
    const h = el({ tag: 'div', attrs: { id: 'channel-points-reward-center-header' } });
    if (opcoes.hdrFora) {
      h.parent = el({ tag: 'div' });
    } else if (opcoes.hdrDialogoProprio) {
      h.attrs.role = 'dialog';
      h.parent = el({ tag: 'div' });
    } else {
      const inter = el({ tag: 'div' });
      h.parent = inter;
      inter.parent = dialogo;
      inter.children = [h];
      dialogo.children = [inter];
    }
    const item = el({ tag: 'button', textContent: 'Bônus XP' });
    item.parent = dialogo;
    item.onClick = () => {
      ordem.push('item');
      if (opcoes.somaAoItem) delete d.mapa[HDR];
    };
    dialogo.listas['button,[role="button"]'] = [item];
    const botao = el({ tag: 'button', textContent: '300' });
    botao.onClick = () => ordem.push('confirma');
    noCentro(dialogo, botao);
    cartaNoCentro(dialogo, 'Bônus XP 300', 'Bônus XP');
    d.mapa[S.resgatar[0]] = botao;
    const resumo = el({ tag: 'button', textContent: '1.234' });
    let aberto = !!opcoes.jaAberto;
    if (aberto) d.mapa[HDR] = h;
    resumo.onClick = () => {
      ordem.push('resumo');
      aberto = !aberto;
      if (aberto) d.mapa[HDR] = h;
      else delete d.mapa[HDR];
    };
    d.mapa[S.botaoPontos[0]] = resumo;
    return { d, ordem, dialogo, h, item, botao };
  }

  it('T1 caminho feliz: cabeçalho num intermediário dentro de role=dialog, item e dedicado no diálogo', async () => {
    const { d, ordem, item, botao } = cenarioCabecalho();
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.deepEqual(res, { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['resumo', 'item', 'confirma', 'resumo']);
    assert.equal(item.clicks, 1);
    assert.equal(botao.clicks, 1);
  });

  it('T2 cabeçalho fora de diálogo: recusado, sem clique no item nem no dedicado', async () => {
    const { d, ordem, item, botao } = cenarioCabecalho({ hdrFora: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.estado, 'falhou');
    assert.equal(res.motivo, 'sem-centro');
    assert.equal(res.fase, 'abrir');
    assert.deepEqual(ordem, ['resumo']);
    assert.equal(item.clicks, 0);
    assert.equal(botao.clicks, 0);
  });

  it('T3 dois diálogos de extensão, sem cabeçalho: recusado, 0 cliques nos botões dos diálogos', async () => {
    const ordem = [];
    const d = doc();
    const a = dialogoExtensao(ordem, 'A');
    const b = dialogoExtensao(ordem, 'B');
    d.dialogos.push(a.dialogo, b.dialogo);
    d.mapa[S.resgatar[0]] = b.botao;
    const resumo = el({ tag: 'button', textContent: '1.234' });
    resumo.onClick = () => ordem.push('resumo');
    d.mapa[S.botaoPontos[0]] = resumo;
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.estado, 'falhou');
    assert.equal(res.motivo, 'sem-centro');
    assert.deepEqual(ordem, ['resumo']);
    assert.equal(a.item.clicks + a.botao.clicks + b.item.clicks + b.botao.clicks, 0);
  });

  it('T4 extensão e centro juntos: só o item e o dedicado do diálogo aceito recebem clique', async () => {
    const { d, ordem, item, botao } = cenarioCabecalho();
    const ext = dialogoExtensao(ordem, 'ext');
    d.dialogos.push(ext.dialogo);
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.deepEqual(res, { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['resumo', 'item', 'confirma', 'resumo']);
    assert.equal(item.clicks, 1);
    assert.equal(botao.clicks, 1);
    assert.equal(ext.item.clicks, 0);
    assert.equal(ext.botao.clicks, 0);
  });

  it('T4 variante: dedicado apontando para o botão da extensão dá sem-botao, sem confirmação (dentroDe)', async () => {
    const { d, ordem, botao } = cenarioCabecalho();
    const ext = dialogoExtensao(ordem, 'ext');
    d.dialogos.push(ext.dialogo);
    d.mapa[S.resgatar[0]] = ext.botao;
    const { dialogos, botoesCentro, totalBotoesCentro, ...res } = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.deepEqual(res, { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'falhou', motivo: 'sem-botao', fase: 'confirmar', trava: 'fora-do-centro' });
    assert.ok(Array.isArray(dialogos));
    assert.deepEqual(ordem, ['resumo', 'item', 'resumo']);
    assert.equal(ext.botao.clicks, 0);
    assert.equal(botao.clicks, 0);
  });

  it('T5 centro já aberto antes do resgate: sem clique no resumo no pré-check, só o do fechamento', async () => {
    const { d, ordem } = cenarioCabecalho({ jaAberto: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.deepEqual(res, { cardClicado: { dts: '', alvo: '', aria: '', custo: false, desab: false }, estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['item', 'confirma', 'resumo']);
    assert.equal(ordem.filter((x) => x === 'resumo').length, 1);
  });

  it('T6 cabeçalho some depois do clique no item: fase confirmar, dedicado sem clique', async () => {
    const { d, ordem, botao } = cenarioCabecalho({ somaAoItem: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.estado, 'falhou');
    assert.equal(res.motivo, 'sem-centro');
    assert.equal(res.fase, 'confirmar');
    assert.deepEqual(ordem, ['resumo', 'item']);
    assert.equal(botao.clicks, 0);
  });

  it('T7 o próprio cabeçalho com role=dialog e sem diálogo ancestral: não aceito', async () => {
    const { d, ordem, item, botao } = cenarioCabecalho({ hdrDialogoProprio: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.estado, 'falhou');
    assert.equal(res.motivo, 'sem-centro');
    assert.equal(res.fase, 'abrir');
    assert.deepEqual(ordem, ['resumo']);
    assert.equal(item.clicks, 0);
    assert.equal(botao.clicks, 0);
  });

  it('T8 prioridade: com S.centro[0] e o cabeçalho no diálogo, centroAberto devolve o do seletor antigo', () => {
    const d = doc();
    const antigo = el({ tag: 'div' });
    const dialogo = el({ tag: 'div', attrs: { role: 'dialog' } });
    const h = el({ tag: 'div', attrs: { id: 'channel-points-reward-center-header' } });
    h.parent = dialogo;
    d.mapa[S.centro[0]] = antigo;
    d.mapa[HDR] = h;
    assert.equal(D.centroAberto(d), antigo);
    delete d.mapa[S.centro[0]];
    assert.equal(D.centroAberto(d), dialogo);
  });
});

describe('fallback por custo: card abre o detalhe, título conferido antes do Redeem', () => {
  const esperarJa = { esperar: (fn) => Promise.resolve(fn()), pausa: () => Promise.resolve() };

  // Centro em lista (cards só com o custo). Ao clicar num card, o detalhe mostra a folha do título e o Redeem com o custo.
  // O resumo abre e fecha; ao reabrir, volta à lista. Opções: redeemFora, extras (textos no detalhe), resumoTravado, sumirAoClicar, semDetalhe (card clicado não troca a lista).
  function cenarioCusto(cards, opcoes = {}) {
    const ordem = [];
    const d = doc();
    const centro = el();
    const redeem = el({ tag: 'button', textContent: '' });
    redeem.onClick = () => ordem.push('redeem');
    const botoes = cards.map((c) => {
      const b = el({ tag: 'button', textContent: c.custo, disabled: c.desabilitado === true, attrs: c.attrs || {} });
      if (c.escondido) {
        const folha = el({ tag: 'span', textContent: c.escondido });
        folha.parent = b;
        b.children = [folha];
      }
      b.onClick = () => {
        ordem.push(c.nome);
        if (opcoes.sumirAoClicar) {
          delete d.mapa[S.centro[0]];
          return;
        }
        if (!opcoes.semDetalhe) mostrarDetalhe(c);
      };
      return b;
    });
    function mostrarLista() {
      centro.listas['button,[role="button"]'] = botoes;
      centro.children = [];
    }
    function mostrarDetalhe(c) {
      centro.listas['button,[role="button"]'] = [];
      const folha = el({ tag: 'span', textContent: c.titulo });
      folha.parent = centro;
      const filhos = [folha];
      for (const t of opcoes.extras || []) {
        const extra = el({ tag: 'span', textContent: t });
        extra.parent = centro;
        filhos.push(extra);
      }
      redeem.textContent = c.custo;
      if (!opcoes.redeemFora) {
        redeem.parent = centro;
        filhos.push(redeem);
      }
      centro.children = filhos;
    }
    d.mapa[S.resgatar[0]] = redeem;
    const resumo = el({ tag: 'button', textContent: '1.234' });
    let aberto = false;
    resumo.onClick = () => {
      ordem.push('resumo');
      if (opcoes.resumoTravado && aberto) return;
      aberto = !aberto;
      if (aberto) {
        d.mapa[S.centro[0]] = centro;
        mostrarLista();
      } else {
        delete d.mapa[S.centro[0]];
      }
    };
    d.mapa[S.botaoPontos[0]] = resumo;
    return { d, ordem, redeem };
  }

  it('card de 300 abre o detalhe com o título; Redeem só depois da conferência', async () => {
    const { d, ordem, redeem } = cenarioCusto([
      { nome: 'card300', custo: '300', titulo: 'Bônus XP' },
      { nome: 'card500', custo: '500', titulo: 'Hidratar' },
      { nome: 'card900', custo: '900', titulo: 'Outro' },
    ]);
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: { dts: '', alvo: '', aria: '', custo: true, desab: false }, estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['resumo', 'card300', 'redeem', 'resumo']);
    assert.equal(redeem.clicks, 1);
  });

  it('cardClicado: card do custo clicado devolve dts, alvo e aria curtos, custo true e sem texto', async () => {
    const { d, ordem } = cenarioCusto([
      { nome: 'card300', custo: '300', titulo: 'Bônus XP', attrs: { 'data-test-selector': 'RewardCard12', 'data-a-target': 'reward-3', 'aria-label': 'Bônus XP 300' } },
    ]);
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.estado, 'clicado');
    assert.deepEqual(res.cardClicado, { dts: 'RewardCard##', alvo: 'reward-#', aria: 'Bônus XP ###', custo: true, desab: false });
    assert.deepEqual(ordem, ['resumo', 'card300', 'redeem', 'resumo']);
  });

  it('cardClicado: sem nenhum card clicado fica null', async () => {
    const { d } = cenarioCusto([]);
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.motivo, 'sem-recompensa');
    assert.equal(res.cardClicado, null);
  });

  it('cardClicado: com dois cards clicados devolve o último', async () => {
    const { d } = cenarioCusto([
      { nome: 'card300a', custo: '300', titulo: 'Hidratar', attrs: { 'data-test-selector': 'A1' } },
      { nome: 'card300b', custo: '300', titulo: 'Bônus XP', attrs: { 'data-test-selector': 'B2' } },
    ]);
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.cardClicado.dts, 'B#');
  });

  it('card errado volta: fecha, reabre a lista e confere o próximo; só o certo recebe Redeem', async () => {
    const { d, ordem } = cenarioCusto([
      { nome: 'card300a', custo: '300', titulo: 'Hidratar' },
      { nome: 'card300b', custo: '300', titulo: 'Bônus XP' },
    ]);
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: { dts: '', alvo: '', aria: '', custo: true, desab: false }, estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['resumo', 'card300a', 'resumo', 'resumo', 'card300b', 'redeem', 'resumo']);
    assert.equal(ordem.filter((x) => x === 'redeem').length, 1);
  });

  it('prefixo ambíguo: Bônus XP 2x não confere com Bônus XP; só o exato recebe Redeem', async () => {
    const { d, ordem } = cenarioCusto([
      { nome: 'card300a', custo: '300', titulo: 'Bônus XP 2x' },
      { nome: 'card300b', custo: '300', titulo: 'Bônus XP' },
    ]);
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: { dts: '', alvo: '', aria: '', custo: true, desab: false }, estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['resumo', 'card300a', 'resumo', 'resumo', 'card300b', 'redeem', 'resumo']);
  });

  it('nenhum card confere: sem-recompensa com vistos só de custos e 0 Redeem', async () => {
    const { d, ordem, redeem } = cenarioCusto([
      { nome: 'a', custo: '300', titulo: 'Hidratar' },
      { nome: 'b', custo: '300', titulo: 'Outro' },
      { nome: 'c', custo: '500', titulo: 'Terceiro' },
    ]);
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), {
      cardClicado: { dts: '', alvo: '', aria: '', custo: true, desab: false },
      estado: 'falhou', motivo: 'sem-recompensa', vistos: ['300', '500'], dialogos: [],
    });
    assert.deepEqual(ordem, ['resumo', 'a', 'resumo', 'resumo', 'b', 'resumo']);
    assert.equal(redeem.clicks, 0);
  });

  it('sem card do custo: sem-recompensa, nenhum clique em card', async () => {
    const { d, ordem } = cenarioCusto([{ nome: 'a', custo: '500', titulo: 'Hidratar' }]);
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), {
      cardClicado: null,
      estado: 'falhou', motivo: 'sem-recompensa', vistos: ['500'], dialogos: [],
    });
    assert.deepEqual(ordem, ['resumo', 'resumo']);
  });

  it('título escondido dentro de card de outra recompensa não conta: sem Redeem', async () => {
    const { d, ordem, redeem } = cenarioCusto([{ nome: 'a', custo: '300', titulo: 'Hidratar', escondido: 'Bônus XP' }]);
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.estado, 'falhou');
    assert.equal(res.motivo, 'sem-recompensa');
    assert.equal(redeem.clicks, 0);
    assert.ok(!ordem.includes('redeem'));
  });

  it('Redeem fora do centro com título conferido: sem-botao, trava fora-do-centro, 0 Redeem', async () => {
    const { d, ordem, redeem } = cenarioCusto([{ nome: 'card300', custo: '300', titulo: 'Bônus XP' }], { redeemFora: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.motivo, 'sem-botao');
    assert.equal(res.fase, 'confirmar');
    assert.equal(res.trava, 'fora-do-centro');
    assert.deepEqual(ordem, ['resumo', 'card300', 'resumo']);
    assert.equal(redeem.clicks, 0);
  });

  it('detalhe com saldo no centro: sem-botao com trava custo (documenta a trava atual)', async () => {
    const { d, redeem } = cenarioCusto([{ nome: 'card300', custo: '300', titulo: 'Bônus XP' }], { extras: ['1.234'] });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.motivo, 'sem-botao');
    assert.equal(res.trava, 'custo');
    assert.equal(redeem.clicks, 0);
  });

  it('toggle que não fecha e não volta à lista: aborta sem clique extra', async () => {
    const { d, ordem, redeem } = cenarioCusto([{ nome: 'card300', custo: '300', titulo: 'Hidratar' }], { resumoTravado: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.motivo, 'sem-recompensa');
    assert.deepEqual(ordem, ['resumo', 'card300', 'resumo']);
    assert.equal(redeem.clicks, 0);
  });

  it('resumo travado com dois cards do custo: aborta após o fechamento que não fecha, sem card novo nem Redeem', async () => {
    const { d, ordem, redeem } = cenarioCusto([
      { nome: 'a', custo: '300', titulo: 'Hidratar' },
      { nome: 'b', custo: '300', titulo: 'Bônus XP' },
    ], { resumoTravado: true, semDetalhe: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.estado, 'falhou');
    assert.equal(res.motivo, 'sem-recompensa');
    assert.deepEqual(ordem, ['resumo', 'a', 'resumo']);
    assert.ok(!ordem.includes('b'));
    assert.ok(!ordem.includes('redeem'));
    assert.equal(redeem.clicks, 0);
  });

  it('todos os cards do custo desabilitados: indisponivel, sem clique em card', async () => {
    const { d, ordem } = cenarioCusto([
      { nome: 'a', custo: '300', titulo: 'Bônus XP', desabilitado: true },
      { nome: 'b', custo: '300', titulo: 'Bônus XP', desabilitado: true },
    ]);
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: null, estado: 'falhou', motivo: 'indisponivel' });
    assert.deepEqual(ordem, ['resumo', 'resumo']);
  });

  it('card desabilitado é pulado: o habilitado do mesmo custo é o clicado', async () => {
    const { d, ordem, redeem } = cenarioCusto([
      { nome: 'a', custo: '300', titulo: 'Bônus XP', desabilitado: true },
      { nome: 'b', custo: '300', titulo: 'Bônus XP' },
    ]);
    assert.deepEqual(await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa), { cardClicado: { dts: '', alvo: '', aria: '', custo: true, desab: false }, estado: 'clicado', motivo: '' });
    assert.deepEqual(ordem, ['resumo', 'b', 'redeem', 'resumo']);
    assert.equal(redeem.clicks, 1);
  });

  it('centro some depois do clique no card: sem-centro na fase confirmar', async () => {
    const { d, ordem } = cenarioCusto([{ nome: 'card300', custo: '300', titulo: 'Bônus XP' }], { sumirAoClicar: true });
    const res = await D.resgatar(d, { titulo: 'Bônus XP', custo: 300 }, esperarJa);
    assert.equal(res.motivo, 'sem-centro');
    assert.equal(res.fase, 'confirmar');
    assert.deepEqual(ordem, ['resumo', 'card300']);
  });
});
