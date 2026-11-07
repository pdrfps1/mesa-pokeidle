'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Globais que o live-bonus.js lê do navegador. Ficam falsos aqui.
const criados = [];
const estado = { salvos: 0, liveStatus: null };

function criarEl(tag, cls, txt) {
  const handlers = {};
  const no = {
    tag,
    className: cls || '',
    textContent: txt == null ? '' : String(txt),
    hidden: false,
    checked: false,
    type: '',
    title: '',
    attrs: {},
    children: [],
    setAttribute(nome, valor) { no.attrs[nome] = String(valor); },
    removeAttribute(nome) { delete no.attrs[nome]; },
    append(...filhos) { no.children.push(...filhos); },
    replaceChildren(...filhos) { no.children = filhos; },
    addEventListener(tipo, fn) { (handlers[tipo] = handlers[tipo] || []).push(fn); },
    disparar(tipo) { (handlers[tipo] || []).forEach((fn) => fn({ type: tipo, target: no })); },
  };
  no.classList = criarClassList(no);
  criados.push(no);
  return no;
}

// classList do mock: as classes ficam em className, então porClasse e comClasse enxergam cada troca de classe.
function classesDe(no) {
  return (no.className || '').split(' ').filter(Boolean);
}

function criarClassList(no) {
  const adicionar = (c) => {
    const lista = classesDe(no);
    if (!lista.includes(c)) no.className = [...lista, c].join(' ');
  };
  const remover = (c) => {
    no.className = classesDe(no).filter((x) => x !== c).join(' ');
  };
  return {
    contains: (c) => classesDe(no).includes(c),
    add: (...cs) => cs.forEach((c) => adicionar(c)),
    remove: (...cs) => cs.forEach((c) => remover(c)),
    toggle(c, forca) {
      const ligar = forca === undefined ? !classesDe(no).includes(c) : !!forca;
      if (ligar) adicionar(c);
      else remover(c);
      return ligar;
    },
  };
}

globalThis.el = criarEl;
globalThis.cfg = { twitch: { tipos: {} }, bays: [{}, {}, {}, {}] };
globalThis.save = () => { estado.salvos += 1; };
globalThis.window = { mesa: null };

const LB = require('./live-bonus.js');

function prepararGlobais() {
  criados.length = 0;
  estado.salvos = 0;
  estado.liveStatus = null;
  globalThis.cfg = { twitch: { tipos: {} }, bays: [{}, {}, {}, {}] };
  globalThis.window = { mesa: null };
}

function bay(extra) {
  return Object.assign({
    auto: true, jogo: true, vinculado: true, loginJogo: 'treinador', loginTwitch: '', contaBate: false,
    janela: 'fechada', modo: 'oculta', canal: null, video: '', pontos: null,
    bonus: { xp: 0, captura: 0, shiny: 0 }, pct: 0, ultimo: null, pausadoAte: 0, situacao: 'sem-login',
  }, extra || {});
}

function snap(bays) {
  return {
    kickAoVivo: [{ slug: 'exemplo', nome: 'Exemplo Kick', espectadores: 120 }],
    twitch: { enviadoEm: Date.now(), custos: { xp: 300, captura: 500, shiny: 1000 }, bays },
  };
}

// Quatro baías; extraPorBaia = { 0: {...} } sobrescreve só as indicadas.
function quatro(extraPorBaia) {
  return [0, 1, 2, 3].map((i) => bay(extraPorBaia && extraPorBaia[i]));
}

const ok = (em) => ({ estado: 'ok', motivo: '', em });

function montar(snapInicial, sobrescrever) {
  const mesa = Object.assign({
    onLiveStatus(fn) { estado.liveStatus = fn; },
    liveGet() { return Promise.resolve(snapInicial); },
  }, sobrescrever || {});
  globalThis.window = { mesa };
  const pai = criarEl('div');
  const intervaloReal = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    LB.mountLiveBonus(pai);
  } finally {
    globalThis.setInterval = intervaloReal;
  }
  return pai;
}

const esperar = () => new Promise((r) => setImmediate(r));
const porClasse = (classe) => criados.filter((no) => no.className.split(' ').includes(classe));
const textos = (no) => [no.textContent, ...no.children.flatMap((filho) => textos(filho))];

function twNavs(navs) {
  return { bays: [0, 1, 2, 3].map((i) => ({ navegador: navs[i] })) };
}

describe('liveBonusLoginsNovos', () => {
  it('ok com em acima do marco devolve a baía e avança o marco', () => {
    const vistoEm = [100, 100, 100, 100];
    const novas = LB.liveBonusLoginsNovos(twNavs([ok(200)]), vistoEm);
    assert.deepEqual(novas, [0]);
    assert.equal(vistoEm[0], 200);
    assert.equal(vistoEm[1], 100);
  });

  it('o mesmo ok repetido devolve lista vazia', () => {
    const vistoEm = [100, 100, 100, 100];
    LB.liveBonusLoginsNovos(twNavs([ok(200)]), vistoEm);
    assert.deepEqual(LB.liveBonusLoginsNovos(twNavs([ok(200)]), vistoEm), []);
    assert.equal(vistoEm[0], 200);
  });

  it('ok com em abaixo do marco (recarga) devolve lista vazia e não mexe no marco', () => {
    const vistoEm = [200, 200, 200, 200];
    assert.deepEqual(LB.liveBonusLoginsNovos(twNavs([ok(50)]), vistoEm), []);
    assert.equal(vistoEm[0], 200);
  });

  it('estados que não são ok devolvem lista vazia e não mexem no marco', () => {
    const naoOk = [
      { estado: 'aberto', motivo: '', em: 900 },
      { estado: 'importando', motivo: '', em: 900 },
      { estado: 'falhou', motivo: 'pending', em: 900 },
      { estado: 'falhou', motivo: 'failed', em: 900 },
      { estado: '', motivo: '', em: 0 },
      { estado: '', motivo: '', em: 900 },
      { em: 900 },
    ];
    for (const nav of naoOk) {
      const vistoEm = [100, 100, 100, 100];
      assert.deepEqual(LB.liveBonusLoginsNovos(twNavs([nav]), vistoEm), [], JSON.stringify(nav));
      assert.equal(vistoEm[0], 100, JSON.stringify(nav));
    }
  });

  it('ok, depois estado vazio, depois ok novo devolve a baía de novo', () => {
    const vistoEm = [100, 100, 100, 100];
    assert.deepEqual(LB.liveBonusLoginsNovos(twNavs([ok(200)]), vistoEm), [0]);
    assert.deepEqual(LB.liveBonusLoginsNovos(twNavs([{ estado: '', motivo: '', em: 0 }]), vistoEm), []);
    assert.deepEqual(LB.liveBonusLoginsNovos(twNavs([ok(300)]), vistoEm), [0]);
    assert.equal(vistoEm[0], 300);
  });

  it('duas baías com ok no mesmo snapshot devolvem as duas e deixam as outras de fora', () => {
    const vistoEm = [100, 100, 100, 100];
    const navs = [ok(200), { estado: 'aberto', motivo: '', em: 900 }, ok(250), { estado: 'falhou', motivo: 'failed', em: 900 }];
    assert.deepEqual(LB.liveBonusLoginsNovos(twNavs(navs), vistoEm), [0, 2]);
    assert.deepEqual(vistoEm, [200, 100, 250, 100]);
  });

  it('null e objeto sem bays devolvem lista vazia sem lançar', () => {
    const vistoEm = [100, 100, 100, 100];
    assert.deepEqual(LB.liveBonusLoginsNovos(null, vistoEm), []);
    assert.deepEqual(LB.liveBonusLoginsNovos({}, vistoEm), []);
    assert.deepEqual(LB.liveBonusLoginsNovos({ bays: null }, vistoEm), []);
    assert.deepEqual(vistoEm, [100, 100, 100, 100]);
  });
});

describe('liveBonusDica', () => {
  it('ok com auto true devolve a frase com o interruptor', () => {
    const agora = Date.now();
    const dica = LB.liveBonusDica({ estado: 'ok', motivo: '', em: agora }, agora, true);
    assert.equal(dica.texto, 'Login copiado do navegador. «Assistir e resgatar sozinho» ficou ligado nesta baía.');
  });

  it('ok com auto false devolve a frase curta', () => {
    const agora = Date.now();
    const dica = LB.liveBonusDica({ estado: 'ok', motivo: '', em: agora }, agora, false);
    assert.equal(dica.texto, 'Login copiado do navegador.');
  });

  it('ok com mais de 60 s devolve texto vazio, e exatamente 60 s ainda mostra', () => {
    const agora = Date.now();
    assert.equal(LB.liveBonusDica({ estado: 'ok', motivo: '', em: agora - 60001 }, agora, true).texto, '');
    assert.notEqual(LB.liveBonusDica({ estado: 'ok', motivo: '', em: agora - 60000 }, agora, true).texto, '');
  });

  it('falhou com motivo pending mantém a frase de sempre e não menciona o interruptor', () => {
    const agora = Date.now();
    const nav = { estado: 'falhou', motivo: 'pending', em: agora };
    const esperado = 'Ainda não há login nessa janela. Entre na Twitch nela, feche-a e clique em «Já entrei».';
    const comAuto = LB.liveBonusDica(nav, agora, true);
    const semAuto = LB.liveBonusDica(nav, agora, false);
    assert.equal(comAuto.texto, esperado);
    assert.equal(semAuto.texto, esperado);
    assert.equal(comAuto.texto.includes('sozinho'), false);
    assert.equal(comAuto.texto.includes('ligado'), false);
    assert.equal(comAuto.parado, false);
  });

  it('falhou com motivo leitura-falhou: frase de leitura e parado true', () => {
    const agora = Date.now();
    const nav = { estado: 'falhou', motivo: 'leitura-falhou', em: agora };
    const dica = LB.liveBonusDica(nav, agora, false);
    assert.equal(dica.texto, 'Não consegui ler o navegador desta baía. Feche todas as janelas dele e clique em «Já entrei».');
    assert.equal(dica.parado, true);
  });

  it('aberto diz que é a janela que o app abriu', () => {
    const agora = Date.now();
    const dica = LB.liveBonusDica({ estado: 'aberto', motivo: '', em: agora }, agora, false);
    assert.equal(dica.texto.includes('nesta janela que abriu'), true);
  });
});

describe('liveBonusUltimo no painel: motivos novos e Vi:', () => {
  beforeEach(prepararGlobais);

  it('falha com vistos mostra só a frase curta; os vistos ficam fora da tela', async () => {
    const pai = montar(snap(quatro({ 0: { ultimo: detalheCompleto('sem-recompensa') } })));
    await esperar();
    telaSemDiagnostico(pai, 'falhou às');
  });

  it('motivo sem-centro e recompensa-ambigua têm rótulo próprio', async () => {
    const em = Date.now() - 1000;
    montar(snap(quatro({
      0: { ultimo: { tipo: 'xp', em, estado: 'falhou', motivo: 'sem-centro', vistos: [] } },
      1: { ultimo: { tipo: 'captura', em, estado: 'falhou', motivo: 'recompensa-ambigua', vistos: [] } },
    })));
    await esperar();
    assert.ok(criados.some((n) => n.tag === 'dd' && n.textContent.includes('não abriu a lista de recompensas')));
    const ambigua = criados.find((n) => n.tag === 'dd' && n.textContent.includes('mais de uma recompensa'));
    assert.ok(ambigua, 'rótulo da recompensa ambígua');
    assert.equal(ambigua.textContent.includes('Vi:'), false);
  });

  it('sem-centro com detalhe completo: só a frase curta na tela', async () => {
    const pai = montar(snap(quatro({ 0: { ultimo: detalheCompleto('sem-centro') } })));
    await esperar();
    telaSemDiagnostico(pai, 'falhou às');
  });

  it('resultado antigo do sem-centro (limparResultado) não mostra detalhe na tela', async () => {
    const P = require('../main/twitch/points.js');
    const bruto = { id: 5, estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true, pistas: ['div[dialog]'], pistasAntes: ['div[dialog]'], dialogoAntes: true, dialogos: [{ botoes: 1, abas: 0, titulo: false, campoTexto: false, itens: [], dts: [] }] };
    const ultimo = Object.assign({ tipo: 'xp', em: Date.now() - 1000 }, P.limparResultado(bruto));
    const pai = montar(snap(quatro({ 0: { ultimo } })));
    await esperar();
    telaSemDiagnostico(pai, 'falhou às');
  });

  it('sem-botao com 24 botões no centro e total 999: nem a lista nem os números aparecem na tela', async () => {
    // Fixture no teto que a Mesa entrega ao painel: até 24 botões (BOTOES_CENTRO_MAX_LIMPO) e total com teto 999 (CONTAGEM_MAX).
    // O corte em si é testado em points.test.js; aqui a tela só não pode mostrar a lista nem o total.
    const botoes = Array.from({ length: 24 }, (_, k) => ({ dts: `b${k}`, alvo: 'x', aria: 'y', tab: false, custo: k === 0, desab: false }));
    const ultimo = Object.assign(detalheCompleto('sem-botao'), { botoesCentro: botoes, totalBotoesCentro: 999 });
    const pai = montar(snap(quatro({ 0: { ultimo } })));
    await esperar();
    telaSemDiagnostico(pai, 'falhou às');
    // O horário (HH:MM) sai antes da busca por números, para o relógio não fazer o teste oscilar.
    const sobra = textos(pai).join(' ').replace(/\d{1,2}:\d{2}/g, '');
    assert.equal(/\b(24|999)\b/.test(sobra), false, 'o corte de 24 e o teto de 999 não deveriam aparecer na tela');
  });
});

describe('diag fora da tela (só log)', () => {
  beforeEach(prepararGlobais);

  it('o diag não aparece na tela, mesmo com diag no snapshot', async () => {
    const pai = montar(snap(quatro({ 0: { ultimo: detalheCompleto('sem-botao'), diag: { resumo: true, botaoPontos: true, botoesNoResumo: 1, saldoSeletor: 1, saldoTamanho: 12, saldoLido: true, centroSeletor: 2, botoesResumo: [{ dts: 'a', alvo: 'b', aria: 'c' }] } } })));
    await esperar();
    telaSemDiagnostico(pai, 'falhou às');
  });
});

describe('mountLiveBonus', () => {
  beforeEach(prepararGlobais);

  it('push com ok novo liga o interruptor só da baía 0, salva uma vez e mostra a frase longa', async () => {
    montar(snap(quatro()));
    await esperar();
    assert.equal(estado.salvos, 0);

    const em = Date.now() + 1000;
    estado.liveStatus(snap(quatro({ 0: { navegador: ok(em) } })));

    assert.equal(cfg.bays[0].twitchAuto, true);
    assert.deepEqual(cfg.bays[1], {});
    assert.deepEqual(cfg.bays[2], {});
    assert.deepEqual(cfg.bays[3], {});
    assert.equal(estado.salvos, 1);
    assert.equal(porClasse('toggle-sm')[0].checked, true);
    assert.equal(porClasse('toggle-sm')[1].checked, false);
    assert.equal(porClasse('live-bonus-hint')[0].textContent, 'Login copiado do navegador. «Assistir e resgatar sozinho» ficou ligado nesta baía.');
  });

  it('depois de desligar, o mesmo ok não religa e a dica volta ao texto curto', async () => {
    montar(snap(quatro()));
    await esperar();
    const em = Date.now() + 1000;
    estado.liveStatus(snap(quatro({ 0: { navegador: ok(em) } })));

    const sw = porClasse('toggle-sm')[0];
    sw.checked = false;
    sw.disparar('change');
    assert.equal(cfg.bays[0].twitchAuto, false);

    estado.liveStatus(snap(quatro({ 0: { navegador: ok(em) } })));
    assert.equal(cfg.bays[0].twitchAuto, false);
    assert.equal(sw.checked, false);
    assert.equal(porClasse('live-bonus-hint')[0].textContent, 'Login copiado do navegador.');
  });

  it('ok de antes da montagem não liga e save não é chamado; ok novo depois liga', async () => {
    const emAntes = Date.now() - 5000;
    montar(snap(quatro({ 0: { navegador: ok(emAntes) } })));
    await esperar();
    assert.equal(cfg.bays[0].twitchAuto, undefined);
    assert.equal(estado.salvos, 0);
    assert.equal(porClasse('toggle-sm')[0].checked, false);

    estado.liveStatus(snap(quatro({ 0: { navegador: ok(emAntes) } })));
    assert.equal(cfg.bays[0].twitchAuto, undefined);
    assert.equal(estado.salvos, 0);

    estado.liveStatus(snap(quatro({ 0: { navegador: ok(Date.now() + 1000) } })));
    assert.equal(cfg.bays[0].twitchAuto, true);
    assert.equal(estado.salvos, 1);
  });

  it('resposta de Já entrei sem .twitch mantém a frase da baía, preserva o Kick e liga com ok novo', async () => {
    const fraseEsperada = 'Entre na Twitch nesta baía, pelo navegador ou na janela do app.';
    const bloco = {
      enviadoEm: Date.now(),
      custos: { xp: 300, captura: 500, shiny: 1000 },
      bays: quatro({ 0: { navegador: ok(Date.now() + 1000) } }),
    };
    montar(snap(quatro()), { twitchJaEntrei() { return Promise.resolve(bloco); } });
    await esperar();

    const status = porClasse('live-bonus-status')[0];
    assert.equal(status.textContent, fraseEsperada);

    porClasse('btn-ja-entrou')[0].disparar('click');
    await esperar();

    assert.equal(status.textContent, fraseEsperada);
    assert.notEqual(status.textContent, 'Aguardando o app.');
    assert.equal(cfg.bays[0].twitchAuto, true);
    assert.equal(porClasse('toggle-sm')[0].checked, true);
    const kick = porClasse('live-bonus-kick')[0];
    assert.ok(textos(kick).includes('Exemplo Kick (120)'));
  });
});

describe('percurso e botões em branco no painel do resgate', () => {
  beforeEach(prepararGlobais);

  it('sem-recompensa sem percurso no resultado: a linha não traz a palavra Percurso', async () => {
    const em = Date.now() - 1000;
    montar(snap(quatro({ 0: { ultimo: { tipo: 'xp', em, estado: 'falhou', motivo: 'sem-recompensa', vistos: [] } } })));
    await esperar();
    const dd = criados.find((n) => n.tag === 'dd' && n.textContent.includes('não achei a recompensa'));
    assert.ok(dd, 'linha do sem-recompensa');
    assert.equal(dd.textContent.includes('Percurso'), false);
  });
});

describe('bloqueio e sem atributo só para botão comum (rodada 1)', () => {
  beforeEach(prepararGlobais);

  it('sem atributo=N não agrupa botão com tab nem desabilitado', async () => {
    const em = Date.now() - 1000;
    const branco = { dts: '', alvo: '', aria: '', tab: false, custo: false, desab: false };
    const botoesCentro = [
      { dts: '', alvo: '', aria: '', tab: true, custo: false, desab: false },
      { dts: '', alvo: '', aria: '', tab: false, custo: false, desab: true },
      branco,
    ];
    const ultimo = { tipo: 'xp', em, estado: 'falhou', motivo: 'sem-botao', fase: 'confirmar', trava: 'sem-dedicado', dialogos: [], botoesCentro, totalBotoesCentro: 3, cardClicado: null };
    montar(snap(quatro({ 0: { ultimo } })));
    await esperar();
    const dd = criados.find((n) => n.tag === 'dd' && n.textContent.includes('não achei o botão de resgatar'));
    assert.ok(dd, 'linha do sem-botao');
    for (const termo of ['Botões do centro', 'sem atributo', 'Card clicado']) assert.equal(dd.textContent.includes(termo), false, termo);
  });
});

describe('Redeem por texto e frase sem-confirmacao no painel (rodada redeem)', () => {
  beforeEach(prepararGlobais);

  it('clicado com via texto aparece como aguardando confirmação', async () => {
    const em = Date.now() - 1000;
    const ultimo = { tipo: 'xp', em, estado: 'clicado', motivo: 'clicado-texto', clicou: true, via: 'texto' };
    montar(snap(quatro({ 0: { ultimo } })));
    await esperar();
    assert.ok(criados.some((n) => n.textContent.includes('clicado às') && n.textContent.includes('aguardando confirmação')));
  });

  it('situação sem-confirmacao mostra a frase nova como texto', async () => {
    montar(snap(quatro({ 0: { situacao: 'sem-confirmacao' } })));
    await esperar();
    assert.ok(criados.some((n) => n.textContent.includes('Cliquei no resgate e a Twitch não confirmou')));
    assert.ok(criados.some((n) => n.textContent.includes('Reiniciar o app também libera, mas pode gerar um novo resgate.')));
  });
});

describe('painel do prazo: sem limiar e frase sem-leitura (rodada prazo)', () => {
  beforeEach(prepararGlobais);

  it('o painel não mostra "Resgatar quando faltar" e traz o texto de Recompensas novo', async () => {
    montar(snap(quatro()));
    await esperar();
    assert.equal(criados.some((n) => n.textContent.includes('Resgatar quando faltar')), false);
    assert.equal(criados.some((n) => n.textContent === 'Resgatar quando faltar'), false);
    assert.ok(criados.some((n) => n.textContent.includes('O app resgata de novo quando a anterior acabar.')));
  });

  it('situação sem-leitura mostra a frase como texto', async () => {
    montar(snap(quatro({ 0: { situacao: 'sem-leitura' } })));
    await esperar();
    assert.ok(criados.some((n) => n.textContent.includes('O jogo ainda não mandou o prazo dos bônus. Resgate parado.')));
  });
});

describe('multi-live: widget por baía (UI)', () => {
  beforeEach(prepararGlobais);

  const oficiais5 = [
    { login: 'c1', nome: 'Canal 1', espectadores: 500, aoVivo: true, ativo: true },
    { login: 'c2', nome: 'Canal 2', espectadores: 400, aoVivo: true, ativo: true },
    { login: 'c3', nome: 'Canal 3', espectadores: 300, aoVivo: true, ativo: true },
    { login: 'c4', nome: 'Canal 4', espectadores: 200, aoVivo: true, ativo: true },
    { login: 'c5', nome: 'Canal 5', espectadores: 100, aoVivo: true, ativo: true },
  ];

  it('limite de 4: com 4 marcados, os demais ficam desabilitados e a nota aparece', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'c2', 'c3', 'c4'], twitchStreams: 4 };
    const pai = montar(snap(quatro({ 0: { oficiais: oficiais5, loginTwitch: 'treinador', situacao: 'assistindo' } })));
    await esperar();
    const labels = porClasse('live-bonus-canal');
    assert.equal(labels.length, 5);
    assert.equal(labels[0].children[0].disabled, false);
    assert.equal(labels[4].children[0].disabled, true);
    assert.equal(labels[4].children[0].checked, false);
    assert.ok(textos(pai).some((t) => t.includes('Limite de 4 canais')));
  });

  it('marcar um canal grava twitchCanais na baía e salva', async () => {
    cfg.bays[0] = { twitchCanais: ['c1'], twitchStreams: 4 };
    montar(snap(quatro({ 0: { oficiais: oficiais5, loginTwitch: 'treinador', situacao: 'assistindo' } })));
    await esperar();
    const input = porClasse('live-bonus-canal')[4].children[0];
    input.checked = true;
    input.disparar('change');
    assert.deepEqual(cfg.bays[0].twitchCanais, ['c1', 'c5']);
    assert.ok(estado.salvos >= 1);
  });

  it('clicar no 2 grava twitchStreams 2 e marca o botão', async () => {
    cfg.bays[0] = { twitchStreams: 4 };
    montar(snap(quatro({ 0: { oficiais: oficiais5, loginTwitch: 'treinador', situacao: 'assistindo' } })));
    await esperar();
    const botao2 = criados.find((no) => no.tag === 'button' && no.textContent === '2' && no.attrs['aria-pressed'] !== undefined);
    botao2.disparar('click');
    assert.equal(cfg.bays[0].twitchStreams, 2);
    assert.equal(botao2.attrs['aria-pressed'], 'true');
  });

  it('repintura reaproveita os nós (sem recriar a lista de canais)', async () => {
    cfg.bays[0] = { twitchCanais: ['c2'], twitchStreams: 4 };
    montar(snap(quatro({ 0: { oficiais: oficiais5, loginTwitch: 'treinador', situacao: 'assistindo' } })));
    await esperar();
    const antes = porClasse('live-bonus-canal');
    estado.liveStatus(snap(quatro({ 0: { oficiais: oficiais5, loginTwitch: 'treinador', situacao: 'assistindo' } })));
    const depois = porClasse('live-bonus-canal');
    assert.equal(depois.length, antes.length);
    assert.ok(depois.every((no, i) => no === antes[i]));
  });

  it('um único role="status" por widget (um por baía)', () => {
    montar(snap(quatro()));
    assert.equal(criados.filter((no) => no.attrs.role === 'status').length, 4);
  });

  it('texto hostil de canal e de situação vai como texto, nunca como elemento', async () => {
    const hostil = '<img src=x onerror=alert(1)>';
    montar(snap(quatro({ 0: { oficiais: [{ login: 'c1', nome: hostil, espectadores: 1, aoVivo: true, ativo: true }], loginTwitch: 'treinador', situacao: 'assistindo' } })));
    await esperar();
    assert.ok(porClasse('live-bonus-canal-texto').some((no) => no.textContent.includes(hostil)));
    assert.equal(criados.filter((no) => no.tag === 'img').length, 0);
  });
});

describe('rodada 3: escolha fantasma, limite e fora do ar (UI)', () => {
  beforeEach(prepararGlobais);

  const of5 = [
    { login: 'c1', nome: 'Canal 1', espectadores: 500, aoVivo: true, ativo: true },
    { login: 'c2', nome: 'Canal 2', espectadores: 400, aoVivo: true, ativo: true },
    { login: 'c3', nome: 'Canal 3', espectadores: 300, aoVivo: true, ativo: true },
    { login: 'c4', nome: 'Canal 4', espectadores: 200, aoVivo: true, ativo: true },
    { login: 'c5', nome: 'Canal 5', espectadores: 100, aoVivo: true, ativo: true },
  ];
  const montarBaia0 = () => montar(snap(quatro({ 0: { oficiais: of5, loginTwitch: 'treinador', situacao: 'assistindo' } })));

  it('login salvo que saiu das oficiais não conta, não aparece marcado e não trava o limite', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'fantasma', 'c2'], twitchStreams: 4 };
    const pai = montarBaia0();
    await esperar();
    assert.ok(textos(pai).some((t) => t === 'Escolher canais (2 de 4 · 1 fora do ar)'));
    const labels = porClasse('live-bonus-canal');
    assert.equal(labels.length, 5);
    assert.equal(labels[2].children[0].checked, false);
    assert.equal(labels[2].children[0].disabled, false);
    assert.equal(labels[1].children[0].checked, true);
    assert.ok(textos(pai).some((t) => t === '1 escolhida fora do ar'));
    assert.deepEqual(cfg.bays[0].twitchCanais, ['c1', 'fantasma', 'c2']);
  });

  it('o limite segue o número de lives da baía: com 2 lives, duas escolhas travam as demais', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'c2'], twitchStreams: 2 };
    const pai = montarBaia0();
    await esperar();
    const labels = porClasse('live-bonus-canal');
    assert.equal(labels[2].children[0].disabled, true);
    assert.ok(textos(pai).some((t) => t === 'Escolher canais (2 de 2)'));
    assert.ok(textos(pai).some((t) => t.includes('Limite de 2 canais')));
  });

  it('marcar depois de um login fantasma é aceito enquanto há vaga efetiva; o fantasma continua salvo', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'fantasma'], twitchStreams: 2 };
    montarBaia0();
    await esperar();
    const input = porClasse('live-bonus-canal')[1].children[0];
    input.checked = true;
    input.disparar('change');
    assert.ok(cfg.bays[0].twitchCanais.includes('c2'));
    assert.ok(cfg.bays[0].twitchCanais.includes('fantasma'));
  });

  it('Limpar fora do ar tira só os logins fora do ar', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'fantasma'], twitchStreams: 4 };
    montarBaia0();
    await esperar();
    assert.deepEqual(cfg.bays[0].twitchCanais, ['c1', 'fantasma']);
    const botao = criados.find((no) => no.tag === 'button' && no.textContent === 'Limpar fora do ar');
    botao.disparar('click');
    assert.deepEqual(cfg.bays[0].twitchCanais, ['c1']);
  });
});

describe('rodada 4: fora do ar com a regra do backend, resumo e concordância (UI)', () => {
  beforeEach(prepararGlobais);

  const base = [
    { login: 'c1', nome: 'Canal 1', espectadores: 500, aoVivo: true, ativo: true },
    { login: 'c2', nome: 'Canal 2', espectadores: 400, aoVivo: true, ativo: true },
    { login: 'c3', nome: 'Canal 3', espectadores: 300, aoVivo: true, ativo: true },
  ];
  const montarOf = (oficiais) => montar(snap(quatro({ 0: { oficiais, loginTwitch: 'treinador', situacao: 'assistindo' } })));

  it('presente mas offline: segue escolhida (marcada) e também aparece como fora do ar', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'c2'], twitchStreams: 4 };
    const off = base.map((o) => (o.login === 'c2' ? { ...o, aoVivo: false } : o));
    const pai = montarOf(off);
    await esperar();
    assert.ok(textos(pai).some((t) => t === 'Escolher canais (1 de 4 · 1 fora do ar)'));
    assert.ok(textos(pai).some((t) => t === '1 escolhida fora do ar'));
    const labels = porClasse('live-bonus-canal');
    assert.equal(labels[1].children[0].checked, true);
    assert.equal(labels[1].hidden, false);
  });

  it('ativo false conta como fora do ar, como no backend (aoVivo && ativo)', async () => {
    cfg.bays[0] = { twitchCanais: ['c3'], twitchStreams: 4 };
    const inativo = base.map((o) => (o.login === 'c3' ? { ...o, ativo: false } : o));
    const pai = montarOf(inativo);
    await esperar();
    assert.ok(textos(pai).some((t) => t === 'Escolher canais (0 de 4 · 1 fora do ar)'));
  });

  it('duas fora do ar: concordância no plural e resumo com o total', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'fantasma', 'outro'], twitchStreams: 4 };
    const pai = montarOf(base);
    await esperar();
    assert.ok(textos(pai).some((t) => t === '2 escolhidas fora do ar'));
    assert.ok(textos(pai).some((t) => t === 'Escolher canais (1 de 4 · 2 fora do ar)'));
  });

  it('lista de oficiais vazia (jogo desconectado): não calcula fora do ar e não mostra Limpar fora do ar', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'fantasma'], twitchStreams: 4 };
    const pai = montarOf([]);
    await esperar();
    assert.equal(textos(pai).some((t) => /escolhidas? fora do ar/.test(t)), false);
    const botao = criados.find((no) => no.tag === 'button' && no.textContent === 'Limpar fora do ar');
    assert.equal(botao.hidden, true);
    assert.deepEqual(cfg.bays[0].twitchCanais, ['c1', 'fantasma']);
  });
});

describe('rodada 5: marcada offline não ocupa vaga (UI)', () => {
  beforeEach(prepararGlobais);
  const of = [
    { login: 'c1', nome: 'Canal 1', espectadores: 500, aoVivo: true, ativo: true },
    { login: 'c2', nome: 'Canal 2', espectadores: 400, aoVivo: false, ativo: true },
    { login: 'c3', nome: 'Canal 3', espectadores: 300, aoVivo: true, ativo: true },
  ];
  const montarOf = (oficiais, streams) => montar(snap(quatro({ 0: { oficiais, loginTwitch: 'treinador', situacao: 'assistindo', streams } })));

  it('marcada offline não conta no limite: com 2 lives e 1 elegível marcada, a outra ainda pode ser marcada', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'c2'], twitchStreams: 2 };
    montarOf(of);
    await esperar();
    const labels = porClasse('live-bonus-canal');
    assert.equal(labels[2].children[0].disabled, false);
    assert.equal(labels[1].children[0].checked, true);
    assert.equal(labels[1].children[0].disabled, false);
  });

  it('a marcada offline pode ser desmarcada e sai do salvo', async () => {
    cfg.bays[0] = { twitchCanais: ['c1', 'c2'], twitchStreams: 4 };
    montarOf(of);
    await esperar();
    const input = porClasse('live-bonus-canal')[1].children[0];
    input.checked = false;
    input.disparar('change');
    assert.deepEqual(cfg.bays[0].twitchCanais, ['c1']);
  });
});

describe('rodada 6: login com maiúscula e corte pelo limite (UI)', () => {
  beforeEach(prepararGlobais);
  const montarOf = (oficiais, cfgBay) => {
    cfg.bays[0] = cfgBay;
    return montar(snap(quatro({ 0: { oficiais, loginTwitch: 'treinador', situacao: 'assistindo' } })));
  };

  it('login oficial com maiúscula é o mesmo canal salvo em minúsculas: aparece marcado e conta', async () => {
    const oficiais = [{ login: 'Canal1', nome: 'Canal 1', espectadores: 5, aoVivo: true, ativo: true }];
    const pai = montarOf(oficiais, { twitchCanais: ['canal1'], twitchStreams: 4 });
    await esperar();
    assert.equal(porClasse('live-bonus-canal')[0].children[0].checked, true);
    assert.ok(textos(pai).some((x) => x === 'Escolher canais (1 de 4)'));
  });

  it('reduzir de 4 para 2 lives com 3 salvos: mostra 2 de 2, o terceiro fica salvo e não vira fora do ar', async () => {
    const oficiais = [
      { login: 'c1', nome: 'Canal 1', espectadores: 5, aoVivo: true, ativo: true },
      { login: 'c2', nome: 'Canal 2', espectadores: 4, aoVivo: true, ativo: true },
      { login: 'c3', nome: 'Canal 3', espectadores: 3, aoVivo: true, ativo: true },
    ];
    const pai = montarOf(oficiais, { twitchCanais: ['c1', 'c2', 'c3'], twitchStreams: 2 });
    await esperar();
    assert.ok(textos(pai).some((x) => x === 'Escolher canais (2 de 2)'));
    assert.equal(textos(pai).some((x) => /fora do ar/.test(x) && !/Limpar/.test(x)), false);
    const labels = porClasse('live-bonus-canal');
    assert.equal(labels[2].children[0].checked, false);
    assert.equal(labels[2].children[0].disabled, true);
    assert.deepEqual(cfg.bays[0].twitchCanais, ['c1', 'c2', 'c3']);
  });
});

describe('foco por live: seletor, aviso do Shiny e repintura (UI)', () => {
  beforeEach(prepararGlobais);

  const ofic = [
    { login: 'c1', nome: 'Canal 1', espectadores: 500, aoVivo: true, ativo: true },
    { login: 'c2', nome: 'Canal 2', espectadores: 400, aoVivo: true, ativo: true },
  ];
  const vagas = [
    { k: 0, s: 0, canal: { login: 'c1', nome: 'Canal 1' }, escolhido: true, substitui: null, janela: 'fechada', modo: 'oculta', video: '', pontos: null, ganhoHora: null, baus: 0, aproximado: false, medindo: true, semGanho: false, pausadoAte: 0, situacao: 'assistindo' },
    { k: 4, s: 1, canal: { login: 'c2', nome: 'Canal 2' }, escolhido: false, substitui: null, janela: 'fechada', modo: 'oculta', video: '', pontos: null, ganhoHora: null, baus: 0, aproximado: false, medindo: true, semGanho: false, pausadoAte: 0, situacao: 'juntando' },
  ];
  const bayCom = () => quatro({ 0: { oficiais: ofic, loginTwitch: 'treinador', situacao: 'assistindo', alvo: 2, streams: vagas } });
  const selects = () => porClasse('live-bonus-foco-select');

  it('cada linha tem Automático, XP, Captura e Shiny, com o valor salvo do canal', async () => {
    cfg.bays[0] = { twitchFoco: { c1: 'captura' }, twitchStreams: 4 };
    montar(snap(bayCom()));
    await esperar();
    const s0 = selects()[0];
    assert.deepEqual(s0.children.map((o) => o.value), ['', 'xp', 'captura', 'shiny']);
    assert.deepEqual(s0.children.map((o) => o.textContent), ['Automático', 'XP (desligado)', 'Captura (desligado)', 'Shiny (desligado)']);
    assert.equal(s0.value, 'captura');
    assert.equal(s0.attrs['aria-label'], 'Foco da live de Canal 1');
    assert.equal(s0.disabled, false);
    assert.equal(selects()[1].value, '');
  });

  it('mudar o select grava twitchFoco e salva; Automático apaga a chave do canal', async () => {
    cfg.bays[0] = { twitchFoco: { c2: 'xp' }, twitchStreams: 4 };
    montar(snap(bayCom()));
    await esperar();
    const s0 = selects()[0];
    s0.value = 'xp';
    s0.disparar('change');
    assert.deepEqual(cfg.bays[0].twitchFoco, { c2: 'xp', c1: 'xp' });
    assert.ok(estado.salvos >= 1);
    s0.value = '';
    s0.disparar('change');
    assert.deepEqual(cfg.bays[0].twitchFoco, { c2: 'xp' });
    assert.equal(Object.hasOwn(cfg.bays[0].twitchFoco, 'c1'), false);
  });

  it('sem canal, o select fica desabilitado', async () => {
    const semCanal = [Object.assign({}, vagas[0], { canal: null, escolhido: false })];
    montar(snap(quatro({ 0: { oficiais: ofic, loginTwitch: 'treinador', situacao: 'juntando', alvo: 1, streams: semCanal } })));
    await esperar();
    assert.equal(selects()[0].disabled, true);
  });

  it('Shiny desligado com foco nele: aviso ligado por aria-describedby, e "Ligar Shiny" liga o tipo e repinta', async () => {
    cfg.bays[0] = { twitchFoco: { c1: 'shiny' }, twitchStreams: 4 };
    montar(snap(bayCom()));
    await esperar();
    const s0 = selects()[0];
    const aviso = porClasse('live-bonus-foco-aviso')[0];
    const ligar = porClasse('live-bonus-foco-ligar')[0];
    assert.equal(aviso.hidden, false);
    assert.equal(aviso.textContent, 'Shiny está desligado em Recompensas. Esta live só junta pontos.');
    assert.equal(s0.attrs['aria-describedby'], aviso.id);
    assert.equal(ligar.hidden, false);
    assert.equal(ligar.textContent, 'Ligar Shiny');
    ligar.disparar('click');
    assert.equal(cfg.twitch.tipos.shiny, true);
    assert.ok(estado.salvos >= 1);
    assert.equal(aviso.hidden, true);
    assert.equal(ligar.hidden, true);
    assert.equal(s0.children[3].textContent, 'Shiny');
  });

  it('Captura desligada com foco nela: aviso próprio, "Ligar Captura" liga só Captura e repinta', async () => {
    cfg.bays[0] = { twitchFoco: { c1: 'captura' }, twitchStreams: 4 };
    montar(snap(bayCom()));
    await esperar();
    const s0 = selects()[0];
    const aviso = porClasse('live-bonus-foco-aviso')[0];
    const ligar = porClasse('live-bonus-foco-ligar')[0];
    assert.equal(aviso.hidden, false);
    assert.equal(aviso.textContent, 'Captura está desligado em Recompensas. Esta live só junta pontos.');
    assert.equal(s0.attrs['aria-describedby'], aviso.id);
    assert.equal(ligar.textContent, 'Ligar Captura');
    ligar.disparar('click');
    assert.deepEqual(cfg.twitch.tipos, { captura: true });
    assert.ok(estado.salvos >= 1);
    assert.equal(aviso.hidden, true);
    assert.equal(ligar.hidden, true);
    assert.equal(Object.hasOwn(s0.attrs, 'aria-describedby'), false);
    assert.equal(s0.children[2].textContent, 'Captura');
  });

  it('XP desligado com foco nele: aviso próprio, "Ligar XP" liga só XP e repinta', async () => {
    cfg.bays[0] = { twitchFoco: { c1: 'xp' }, twitchStreams: 4 };
    montar(snap(bayCom()));
    await esperar();
    const s0 = selects()[0];
    const aviso = porClasse('live-bonus-foco-aviso')[0];
    const ligar = porClasse('live-bonus-foco-ligar')[0];
    assert.equal(aviso.hidden, false);
    assert.equal(aviso.textContent, 'XP está desligado em Recompensas. Esta live só junta pontos.');
    assert.equal(ligar.textContent, 'Ligar XP');
    ligar.disparar('click');
    assert.deepEqual(cfg.twitch.tipos, { xp: true });
    assert.equal(aviso.hidden, true);
    assert.equal(s0.children[1].textContent, 'XP');
  });

  it('repintura não recria o select nem troca o valor com foco nele; sem foco, atualiza', async () => {
    cfg.bays[0] = { twitchFoco: { c1: 'xp' }, twitchStreams: 4 };
    montar(snap(bayCom()));
    await esperar();
    const antes = selects();
    const s0 = antes[0];
    globalThis.document = { activeElement: s0 };
    try {
      s0.value = 'captura';
      estado.liveStatus(snap(bayCom()));
      assert.equal(selects()[0], s0);
      assert.equal(s0.value, 'captura');
      globalThis.document.activeElement = null;
      estado.liveStatus(snap(bayCom()));
      assert.equal(s0.value, 'xp');
      assert.equal(selects().length, antes.length);
    } finally {
      delete globalThis.document;
    }
  });

  it('pré-visualização sem window.mesa monta o seletor sem erro', () => {
    globalThis.window = { mesa: null };
    const intervaloReal = globalThis.setInterval;
    globalThis.setInterval = () => 0;
    try {
      LB.mountLiveBonus(criarEl('div'));
    } finally {
      globalThis.setInterval = intervaloReal;
    }
    assert.ok(selects().length > 0);
    assert.equal(selects()[0].children.length, 4);
  });
});

// Detalhe completo do último resgate (percurso, diálogos, botões, card, cabeçalho, classes, diag): o painel só pode mostrar a frase curta.
function detalheCompleto(motivo) {
  return {
    tipo: 'xp', em: Date.now() - 1000, estado: 'falhou', motivo, trava: 'fora-do-centro', fase: 'confirmar', clicou: true,
    vistos: ['Hidratar 300'], pistas: ['div[dialog]'], pistasAntes: ['div[dialog]'], dialogoAntes: true,
    dialogos: [{ botoes: 1, abas: 0, titulo: true, itens: [{ dts: 'a', alvo: 'b', aria: 'c', tab: true }], dts: ['x'] }],
    botoesCentro: [{ dts: 'btn', alvo: 'x', aria: 'y', tab: true, custo: true, desab: false }], totalBotoesCentro: 3,
    cabecalho: { achado: true, cadeia: [{ no: 'div', botoes: 1, titulo: true, resumo: false, dialogo: false }] },
    classes: ['rc:div.a'],
    cardClicado: { dts: 'card', alvo: 'x', aria: 'y', custo: true, desab: false },
    percurso: { caminho: 'custo', clique: { tag: 'button', role: 'button', emBotao: true }, bloqueio: 'fora-do-centro', foraDoCentro: 2 },
  };
}

const TERMOS_FORA_DA_TELA = ['Percurso', 'Diálogo#', 'Botões do centro', 'Card clicado', 'Diag:', 'trava=', 'Vi:', 'Vi no DOM', 'Cabeçalho', 'Antes do clique', 'caminho=', 'clique=', 'redeem=', 'bloqueio=', 'recusado=', 'folhas=', 'candidatos:', 'fora do centro=', 'sem atributo=', 'botões=', 'cadeia', 'Classes', 'fase=', 'clicou='];

// A tela mostra a frase curta do último resgate e nenhum termo do detalhe, qualquer que seja o detalhe no snapshot.
function telaSemDiagnostico(pai, frase) {
  const tela = textos(pai).join(' ');
  assert.ok(tela.includes(frase), 'frase curta do último resgate');
  for (const termo of TERMOS_FORA_DA_TELA) assert.equal(tela.includes(termo), false, `'${termo}' não deveria aparecer na tela`);
}

describe('outra-live na tela: Na fila e a frase de espera', () => {
  beforeEach(prepararGlobais);

  it('baía e vaga em outra-live mostram a frase de espera e Na fila, sem erro', async () => {
    const vaga = { k: 0, s: 0, canal: { login: 'c1', nome: 'Canal 1' }, escolhido: true, substitui: null, janela: 'fechada', modo: 'oculta', video: '', pontos: null, ganhoHora: null, baus: 0, aproximado: false, medindo: true, semGanho: false, pausadoAte: 0, situacao: 'outra-live' };
    const pai = montar(snap(quatro({ 0: { oficiais: [{ login: 'c1', nome: 'Canal 1', espectadores: 5, aoVivo: true, ativo: true }], loginTwitch: 'treinador', situacao: 'outra-live', alvo: 1, streams: [vaga] } })));
    await esperar();
    assert.ok(textos(pai).some((t) => t.includes('Outra live está resgatando. Este resgate vem depois.')));
    assert.ok(textos(pai).some((t) => t === 'Na fila'));
  });
});

// Controlador único: Configurações e Espera dividem a mesma inscrição, o mesmo liveGet e o mesmo setInterval.
function comIntervaloFalso(fn) {
  const intervaloReal = globalThis.setInterval;
  globalThis.setInterval = () => 0;
  try {
    return fn();
  } finally {
    globalThis.setInterval = intervaloReal;
  }
}

function descendentes(no) {
  return [no, ...no.children.flatMap((filho) => descendentes(filho))];
}

function comClasse(no, classe) {
  return descendentes(no).filter((n) => (n.className || '').split(' ').includes(classe));
}

// Monta as duas vistas com um só window.mesa. Devolve a página de Configurações e as partes da Espera.
function montarDuas(snapInicial, sobrescrever) {
  const mesa = Object.assign({
    onLiveStatus(fn) { estado.liveStatus = fn; },
    liveGet() { return Promise.resolve(snapInicial); },
  }, sobrescrever || {});
  globalThis.window = { mesa };
  const pai = criarEl('div');
  let parte = null;
  comIntervaloFalso(() => {
    LB.mountLiveBonus(pai);
    parte = LB.mountLiveBonusStandby();
  });
  return { pai, parte };
}

describe('controlador único: Configurações e Espera na mesma inscrição (UI)', () => {
  beforeEach(prepararGlobais);

  it('onLiveStatus, liveGet e o setInterval acontecem uma vez mesmo com duas vistas', async () => {
    const contagem = { inscricoes: 0, leituras: 0, intervalos: 0 };
    globalThis.window = {
      mesa: {
        onLiveStatus(fn) { contagem.inscricoes += 1; estado.liveStatus = fn; },
        liveGet() { contagem.leituras += 1; return Promise.resolve(snap(quatro())); },
      },
    };
    const intervaloReal = globalThis.setInterval;
    globalThis.setInterval = () => { contagem.intervalos += 1; return 0; };
    try {
      LB.mountLiveBonus(criarEl('div'));
      LB.mountLiveBonusStandby();
    } finally {
      globalThis.setInterval = intervaloReal;
    }
    await esperar();
    assert.deepEqual(contagem, { inscricoes: 1, leituras: 1, intervalos: 1 });
  });

  it('ids são únicos entre as vistas e cada uma aponta o aria-describedby para o próprio aviso', async () => {
    cfg.bays[0] = { twitchFoco: { c1: 'shiny' }, twitchStreams: 4 };
    const oficiais = [{ login: 'c1', nome: 'Canal 1', espectadores: 5, aoVivo: true, ativo: true }];
    const vaga = { k: 0, s: 0, canal: { login: 'c1', nome: 'Canal 1' }, escolhido: true, substitui: null, janela: 'fechada', modo: 'oculta', video: '', pontos: null, ganhoHora: null, baus: 0, aproximado: false, medindo: true, semGanho: false, pausadoAte: 0, situacao: 'assistindo' };
    const { pai, parte } = montarDuas(snap(quatro({ 0: { oficiais, loginTwitch: 'treinador', situacao: 'assistindo', alvo: 1, streams: [vaga] } })));
    await esperar();
    const ids = criados.map((no) => no.id).filter(Boolean);
    assert.ok(ids.length > 0);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes('live-bonus-foco-aviso-0-0'));
    assert.ok(ids.includes('live-bonus-espera-foco-aviso-0-0'));

    const avisoAjustes = comClasse(pai, 'live-bonus-foco-aviso')[0];
    assert.equal(avisoAjustes.id, 'live-bonus-foco-aviso-0-0');
    assert.equal(comClasse(pai, 'live-bonus-foco-select')[0].attrs['aria-describedby'], 'live-bonus-foco-aviso-0-0');
    const avisoEspera = comClasse(parte.bays[0], 'live-bonus-foco-aviso')[0];
    assert.equal(avisoEspera.id, 'live-bonus-espera-foco-aviso-0-0');
    assert.equal(comClasse(parte.bays[0], 'live-bonus-foco-select')[0].attrs['aria-describedby'], 'live-bonus-espera-foco-aviso-0-0');
  });

  it('mudança numa vista aparece na outra depois de paint', async () => {
    const { pai, parte } = montarDuas(snap(quatro()));
    await esperar();
    const tiposAjustes = comClasse(pai, 'live-bonus-tipo').map((label) => label.children[0]);
    const tiposEspera = comClasse(parte.geral, 'live-bonus-tipo').map((label) => label.children[0]);
    assert.equal(tiposAjustes.length, 3);
    assert.equal(tiposEspera.length, 3);
    // Ligar XP na Espera: o próprio controlador repinta as duas vistas.
    tiposEspera[0].checked = true;
    tiposEspera[0].disparar('change');
    assert.equal(cfg.twitch.tipos.xp, true);
    assert.equal(tiposAjustes[0].checked, true);
    // Mudança direta no estado: a outra vista só mostra depois de paintLiveBonus().
    cfg.twitch.tipos.captura = true;
    LB.paintLiveBonus();
    assert.equal(tiposAjustes[1].checked, true);
    assert.equal(tiposEspera[1].checked, true);
  });

  it('mountLiveBonusStandby sem window.mesa usa a prévia', () => {
    globalThis.window = { mesa: null };
    const parte = comIntervaloFalso(() => LB.mountLiveBonusStandby());
    assert.equal(parte.bays.length, 4);
    assert.ok(textos(parte.bays[0]).includes('Assistindo Canal X.'));
    assert.ok(textos(parte.geral).includes('Recompensas'));
  });

  it('erro de ação na Espera vai para o erro da baía; nas Configurações segue no erro do topo', async () => {
    const falha = { twitchNavegador() { return Promise.reject(new Error('falhou na baía')); } };
    const { pai, parte } = montarDuas(snap(quatro()), falha);
    await esperar();
    const botaoEspera = descendentes(parte.bays[0]).find((n) => n.tag === 'button' && n.textContent === 'Entrar pelo navegador');
    botaoEspera.disparar('click');
    await esperar();
    const erroBaia = comClasse(parte.bays[0], 'live-bonus-erro')[0];
    assert.equal(erroBaia.hidden, false);
    assert.equal(erroBaia.textContent, 'falhou na baía');
    assert.equal(erroBaia.attrs['aria-live'], 'polite');
    assert.equal(erroBaia.attrs.role, undefined);
    assert.equal(comClasse(parte.bays[1], 'live-bonus-erro')[0].hidden, true);
    assert.equal(comClasse(parte.geral, 'live-bonus-erro')[0].hidden, true);

    const botaoAjustes = descendentes(pai).find((n) => n.tag === 'button' && n.textContent === 'Entrar pelo navegador');
    botaoAjustes.disparar('click');
    await esperar();
    const erroTopo = comClasse(pai, 'live-bonus-erro')[0];
    assert.equal(erroTopo.hidden, false);
    assert.equal(erroTopo.textContent, 'falhou na baía');
  });

  it('erro de ação da baía some quando a ação seguinte dá certo (Espera)', async () => {
    let tentativa = 0;
    const falhaDepois = {
      twitchNavegador() {
        tentativa += 1;
        return tentativa === 1 ? Promise.reject(new Error('falhou na baía')) : Promise.resolve(snap(quatro()));
      },
    };
    const { parte } = montarDuas(snap(quatro()), falhaDepois);
    await esperar();
    const botao = descendentes(parte.bays[0]).find((n) => n.tag === 'button' && n.textContent === 'Entrar pelo navegador');
    botao.disparar('click');
    await esperar();
    const erroBaia = comClasse(parte.bays[0], 'live-bonus-erro')[0];
    assert.equal(erroBaia.hidden, false);
    botao.disparar('click');
    await esperar();
    assert.equal(erroBaia.hidden, true);
  });

  it('falha da leitura inicial aparece no erro geral da Espera e some no próximo snapshot; Configurações segue sem mensagem', async () => {
    const semLeitura = { liveGet() { return Promise.reject(new Error('sem leitura')); } };
    const { pai, parte } = montarDuas(snap(quatro()), semLeitura);
    await esperar();
    const erroGeral = comClasse(parte.geral, 'live-bonus-erro')[0];
    assert.equal(erroGeral.hidden, false);
    assert.equal(erroGeral.textContent, 'sem leitura');
    assert.equal(erroGeral.attrs['aria-live'], 'polite');
    assert.equal(comClasse(pai, 'live-bonus-erro')[0].hidden, true);
    estado.liveStatus(snap(quatro()));
    assert.equal(erroGeral.hidden, true);
  });

  it('falha ao abrir a live da Kick aparece no erro geral da Espera e some no Abrir seguinte que der certo', async () => {
    let tentativa = 0;
    const kick = {
      liveKickOpen() {
        tentativa += 1;
        return tentativa === 1 ? Promise.reject(new Error('kick fora')) : Promise.resolve(snap(quatro()));
      },
    };
    const { pai, parte } = montarDuas(snap(quatro()), kick);
    await esperar();
    const botao = descendentes(parte.geral).find((n) => n.tag === 'button' && n.textContent === 'Abrir');
    botao.disparar('click');
    await esperar();
    const erroGeral = comClasse(parte.geral, 'live-bonus-erro')[0];
    assert.equal(erroGeral.hidden, false);
    assert.equal(erroGeral.textContent, 'kick fora');
    assert.equal(comClasse(pai, 'live-bonus-erro')[0].hidden, true);
    botao.disparar('click');
    await esperar();
    assert.equal(erroGeral.hidden, true);
  });
});

describe('classes e erros por baía no painel (UI)', () => {
  beforeEach(prepararGlobais);

  it('o botão de lives marcado recebe btn-active, e só ele, quando o número muda', async () => {
    cfg.bays[0] = { twitchStreams: 2 };
    montar(snap(quatro()));
    await esperar();
    const botoes = criados.filter((no) => no.tag === 'button' && no.attrs['aria-pressed'] !== undefined).slice(0, 4);
    assert.deepEqual(botoes.map((b) => b.textContent), ['1', '2', '3', '4']);
    assert.deepEqual(botoes.map((b) => b.classList.contains('btn-active')), [false, true, false, false]);
    botoes[3].disparar('click');
    assert.deepEqual(botoes.map((b) => b.classList.contains('btn-active')), [false, false, false, true]);
    assert.equal(botoes[3].attrs['aria-pressed'], 'true');
  });

  it('is-parado marca a luz, o status e a célula de estado quando a situação para; a baía ativa não', async () => {
    const oficiais = [{ login: 'c1', nome: 'Canal 1', espectadores: 5, aoVivo: true, ativo: true }];
    const vaga = { k: 0, s: 0, canal: { login: 'c1', nome: 'Canal 1' }, escolhido: true, substitui: null, janela: 'fechada', modo: 'oculta', video: '', pontos: null, ganhoHora: null, baus: 0, aproximado: false, medindo: true, semGanho: false, pausadoAte: 0, situacao: 'sem-leitura' };
    montar(snap(quatro({
      0: { situacao: 'sem-confirmacao', loginTwitch: 'treinador', oficiais, alvo: 1, streams: [vaga] },
      1: { situacao: 'assistindo', loginTwitch: 'treinador' },
    })));
    await esperar();
    const luz = porClasse('live-bonus-lamp');
    assert.equal(luz[0].textContent, '○ Parado');
    assert.equal(luz[0].classList.contains('is-parado'), true);
    assert.equal(luz[1].textContent, '● Ativo');
    assert.equal(luz[1].classList.contains('is-parado'), false);
    const status = porClasse('live-bonus-status');
    assert.equal(status[0].classList.contains('is-parado'), true);
    assert.equal(status[1].classList.contains('is-parado'), false);
    const celulas = porClasse('live-bonus-estado');
    assert.equal(celulas[0].textContent, 'Sem leitura');
    assert.equal(celulas[0].classList.contains('is-parado'), true);
  });
});
