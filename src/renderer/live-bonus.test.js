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
    classList: { toggle() {}, remove() {} },
    attrs: {},
    children: [],
    setAttribute(nome, valor) { no.attrs[nome] = String(valor); },
    append(...filhos) { no.children.push(...filhos); },
    replaceChildren(...filhos) { no.children = filhos; },
    addEventListener(tipo, fn) { (handlers[tipo] = handlers[tipo] || []).push(fn); },
    disparar(tipo) { (handlers[tipo] || []).forEach((fn) => fn({ type: tipo, target: no })); },
  };
  criados.push(no);
  return no;
}

globalThis.el = criarEl;
globalThis.cfg = { twitch: { tipos: {}, limiarMin: 5 }, bays: [{}, {}, {}, {}] };
globalThis.save = () => { estado.salvos += 1; };
globalThis.window = { mesa: null };

const LB = require('./live-bonus.js');

function prepararGlobais() {
  criados.length = 0;
  estado.salvos = 0;
  estado.liveStatus = null;
  globalThis.cfg = { twitch: { tipos: {}, limiarMin: 5 }, bays: [{}, {}, {}, {}] };
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
    const esperado = 'O login no navegador ainda não terminou. Entre na Twitch, feche o navegador e clique em «Já entrei».';
    const comAuto = LB.liveBonusDica(nav, agora, true);
    const semAuto = LB.liveBonusDica(nav, agora, false);
    assert.equal(comAuto.texto, esperado);
    assert.equal(semAuto.texto, esperado);
    assert.equal(comAuto.texto.includes('sozinho'), false);
    assert.equal(comAuto.texto.includes('ligado'), false);
    assert.equal(comAuto.parado, false);
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
    const fraseEsperada = 'Entre na Twitch nesta baía, pelo navegador ou na janela da Mesa.';
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
    assert.notEqual(status.textContent, 'Aguardando a Mesa.');
    assert.equal(cfg.bays[0].twitchAuto, true);
    assert.equal(porClasse('toggle-sm')[0].checked, true);
    const kick = porClasse('live-bonus-kick')[0];
    assert.ok(textos(kick).includes('Exemplo Kick (120)'));
  });
});
