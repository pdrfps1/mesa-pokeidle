'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createTwitchController, TICK_MS, HOME } = require('./controller');

// Janelas falsas: registram cada chamada. setUrl troca a URL sem registrar (simula raid ou redirect).
function fakeJanelas() {
  const log = [];
  const existentes = new Set();
  const urls = new Map();
  return {
    log,
    setUrl(i, url) { urls.set(i, url); },
    existe: (i) => existentes.has(i),
    url: (i) => urls.get(i) || '',
    abrir(i, url, opts) {
      existentes.add(i);
      urls.set(i, url);
      log.push(['abrir', i, url, opts]);
    },
    navegar(i, url) {
      urls.set(i, url);
      log.push(['navegar', i, url]);
    },
    recarregar(i) { log.push(['recarregar', i]); },
    mostrar(i) { log.push(['mostrar', i]); },
    esconder(i, modo) { log.push(['esconder', i, modo]); },
    fechar(i) {
      existentes.delete(i);
      log.push(['fechar', i]);
    },
    enviar(i, cmd) { log.push(['enviar', i, cmd]); },
    limpar(i) {
      log.push(['limpar', i]);
      return Promise.resolve();
    },
  };
}

function montar() {
  const janelas = fakeJanelas();
  const ctx = {
    janelas,
    estado: { t: 1000000, auto: [true, false, false, false], tipos: { xp: true, captura: false, shiny: false }, limiarMin: 5 },
    mudancas: 0,
  };
  ctx.c = createTwitchController({
    janelas,
    prefs: () => ({ tipos: ctx.estado.tipos, limiarMin: ctx.estado.limiarMin, auto: ctx.estado.auto }),
    agora: () => ctx.estado.t,
    onChange: () => { ctx.mudancas += 1; },
  });
  return ctx;
}

function bloco(extra) {
  return Object.assign({
    vinculado: true,
    login: 'fulano',
    bonus: { xp: 0, captura: 0, shiny: 0 },
    pct: 15,
    minutos: 60,
    recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }],
    pacotes: [],
    oficiais: [{ login: 'canala', nome: 'Canal A', aoVivo: true, ativo: true, espectadores: 50 }],
  }, extra);
}

function fatos(extra) {
  return Object.assign({
    canal: 'canala',
    logado: true,
    deslogado: false,
    portao: false,
    pausado: false,
    rodando: true,
    bau: false,
    saldoTexto: '450',
  }, extra);
}

function preparar(ctx, { blocoExtra, login = 'Fulano' } = {}) {
  ctx.c.setJogo(0, { ativo: true, twitch: bloco(blocoExtra), offsetMs: 0 });
  ctx.c.setLoginTwitch(0, login);
}

// Avança o relógio em passos de TICK_MS. Com extra, manda a página a cada passo; com null, não manda.
function correr(ctx, ms, extra) {
  const passos = Math.max(1, Math.round(ms / TICK_MS));
  for (let k = 0; k < passos; k += 1) {
    ctx.estado.t += TICK_MS;
    if (extra !== null) ctx.c.pagina(0, fatos(extra));
    ctx.c.tick();
  }
}

// Prepara a baía e deixa a janela abrir (o primeiro tick só abre).
function abrir(ctx, opcoes) {
  preparar(ctx, opcoes);
  correr(ctx, TICK_MS, {});
}

function enviados(ctx, tipo) {
  return ctx.janelas.log.filter((e) => e[0] === 'enviar' && e[2].tipo === tipo);
}

function resgates(ctx) {
  return enviados(ctx, 'resgatar');
}

function navegacoes(ctx) {
  return ctx.janelas.log.filter((e) => e[0] === 'navegar');
}

function aberturas(ctx, modo) {
  return ctx.janelas.log.filter((e) => e[0] === 'abrir' && e[3] && e[3].modo === modo);
}

describe('controller: pré-requisitos', () => {
  it('automação desligada nunca abre e fecha a janela oculta que sobrou', () => {
    const ctx = montar();
    preparar(ctx);
    ctx.estado.auto[0] = false;
    correr(ctx, TICK_MS, {});
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'abrir').length, 0);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'desligado');
    ctx.estado.auto[0] = true;
    correr(ctx, TICK_MS, {});
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'abrir').length, 1);
    ctx.estado.auto[0] = false;
    ctx.c.tick();
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'fechar' && e[1] === 0));
  });

  it('sem jogo, sem bloco e com bloco, a situação muda e só o último abre', () => {
    const ctx = montar();
    ctx.c.setJogo(0, { ativo: false, twitch: null, offsetMs: 0 });
    ctx.c.setLoginTwitch(0, 'fulano');
    ctx.c.tick();
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-jogo');
    ctx.c.setJogo(0, { ativo: true, twitch: null, offsetMs: 0 });
    ctx.c.tick();
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-bloco');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco(), offsetMs: 0 });
    ctx.c.tick();
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'abrindo');
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'abrir').length, 1);
  });

  it('sem login da Twitch, a situação é sem-login e nada abre', () => {
    const ctx = montar();
    ctx.c.setJogo(0, { ativo: true, twitch: bloco(), offsetMs: 0 });
    ctx.c.tick();
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-login');
    assert.equal(ctx.janelas.log.length, 0);
  });

  it('tudo certo: abre oculta no canal oficial', () => {
    const ctx = montar();
    preparar(ctx);
    ctx.c.tick();
    assert.deepEqual(ctx.janelas.log[0], ['abrir', 0, 'https://www.twitch.tv/canala', { modo: 'oculta', visivel: false }]);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'abrindo');
    assert.ok(HOME.endsWith('/'));
  });
});

describe('controller: canal e navegação', () => {
  it('quando o canal cai, navega para outro elegível; sem elegível, fecha', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.c.setJogo(0, {
      ativo: true,
      twitch: bloco({
        oficiais: [
          { login: 'canala', nome: 'A', aoVivo: false, ativo: true, espectadores: 50 },
          { login: 'canalb', nome: 'B', aoVivo: true, ativo: true, espectadores: 10 },
        ],
      }),
      offsetMs: 0,
    });
    // Depois da abertura (S3), a navegação para o novo canal espera os 15 s.
    correr(ctx, 16000, {});
    assert.ok(navegacoes(ctx).some((e) => e[2] === 'https://www.twitch.tv/canalb'));
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ oficiais: [{ login: 'canalb', aoVivo: false, ativo: true }] }), offsetMs: 0 });
    ctx.c.tick();
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-canal');
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'fechar' && e[1] === 0));
  });

  it('raid: navega de volta só depois de 15 s desde a última navegação', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.janelas.setUrl(0, 'https://www.twitch.tv/outro');
    // Abrir conta como navegação (S3): a primeira só vem 15 s depois da abertura.
    correr(ctx, 16000, {});
    assert.equal(navegacoes(ctx).length, 1);
    ctx.janelas.setUrl(0, 'https://www.twitch.tv/outro');
    correr(ctx, 6000, {});
    assert.equal(navegacoes(ctx).length, 1);
    ctx.janelas.setUrl(0, 'https://www.twitch.tv/outro');
    correr(ctx, 10000, {});
    assert.equal(navegacoes(ctx).length, 2);
  });
});

describe('controller: comandos da página', () => {
  it('portão: no máximo um a cada 10 s', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, { portao: true });
    assert.equal(enviados(ctx, 'portao').length, 1);
    correr(ctx, 8000, { portao: true });
    assert.equal(enviados(ctx, 'portao').length, 1);
    correr(ctx, TICK_MS, { portao: true });
    assert.equal(enviados(ctx, 'portao').length, 2);
  });

  it('baú: um a cada 20 s', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, { bau: true });
    assert.equal(enviados(ctx, 'bau').length, 1);
    correr(ctx, 18000, { bau: true });
    assert.equal(enviados(ctx, 'bau').length, 1);
    correr(ctx, TICK_MS, { bau: true });
    assert.equal(enviados(ctx, 'bau').length, 2);
  });

  it('play: sai quando pausado, e espera 15 s entre comandos', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, { pausado: true, rodando: false });
    assert.equal(enviados(ctx, 'play').length, 1);
    correr(ctx, 14000, { pausado: true, rodando: false });
    assert.equal(enviados(ctx, 'play').length, 1);
    correr(ctx, TICK_MS, { pausado: true, rodando: false });
    assert.equal(enviados(ctx, 'play').length, 2);
  });

  it('página velha (mais de 15 s) não manda comando', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, { bau: true });
    assert.equal(enviados(ctx, 'bau').length, 1);
    const antes = ctx.janelas.log.length;
    correr(ctx, 16000, null);
    assert.equal(ctx.janelas.log.slice(antes).filter((e) => e[0] === 'enviar').length, 0);
  });

  it('sem página depois de 45 s recarrega; de novo só depois de 5 min', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, 46000, null);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar').length, 1);
    correr(ctx, 60000, null);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar').length, 1);
    correr(ctx, 300000, null);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar').length, 2);
  });
});

describe('controller: trava e situações', () => {
  it('conta diferente nunca resgata; a situação diz o motivo', () => {
    const ctx = montar();
    abrir(ctx, { login: 'outra' });
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 0);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'conta-diferente');
    assert.equal(ctx.c.snapshot().bays[0].contaBate, false);
  });

  it('vinculado false vira nao-vinculado', () => {
    const ctx = montar();
    abrir(ctx, { blocoExtra: { vinculado: false } });
    correr(ctx, TICK_MS, {});
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'nao-vinculado');
    assert.equal(resgates(ctx).length, 0);
  });

  it('página deslogada vira sem-login-pagina', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, { logado: false, deslogado: true, saldoTexto: '' });
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-login-pagina');
    assert.equal(resgates(ctx).length, 0);
  });

  it('querJanela só é verdadeira com automação, jogo, login e canal', () => {
    const ctx = montar();
    assert.equal(ctx.c.querJanela(0), false);
    preparar(ctx);
    ctx.c.tick();
    assert.equal(ctx.c.querJanela(0), true);
    ctx.estado.auto[0] = false;
    assert.equal(ctx.c.querJanela(0), false);
  });

  it('precisaLoginRapido vale por 10 min depois de entrar', () => {
    const ctx = montar();
    preparar(ctx);
    assert.equal(ctx.c.precisaLoginRapido(0), false);
    ctx.c.entrar(0);
    assert.equal(ctx.c.precisaLoginRapido(0), true);
    ctx.c.janelaEscondida(0);
    ctx.estado.t += 10 * 60000;
    assert.equal(ctx.c.precisaLoginRapido(0), false);
  });
});

describe('controller: resgate', () => {
  it('fluxo feliz: um resgate com título e custo, sem repetir antes da confirmação', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    assert.deepEqual(resgates(ctx).map((e) => e[2]), [{ tipo: 'resgatar', id: 1, titulo: 'Bônus XP', custo: 300 }]);
    correr(ctx, 20000, {});
    assert.equal(resgates(ctx).length, 1);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'resgatando');
  });

  it('confirmação do jogo fecha o pendente; o próximo resgate só depois de 20 s', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ bonus: { xp: ctx.estado.t + 3600000, captura: 0, shiny: 0 } }), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'ok');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ bonus: { xp: 0, captura: 0, shiny: 0 } }), offsetMs: 0 });
    correr(ctx, 18000, {});
    assert.equal(resgates(ctx).length, 1);
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 2);
    assert.equal(resgates(ctx)[1][2].id, 2);
  });

  it('sem confirmação em 3 min vira sem-confirmacao; três falhas pausam por 60 min', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    correr(ctx, 200000, {});
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'sem-confirmacao');
    correr(ctx, 1000000, {});
    assert.equal(resgates(ctx).length, 3);
    const snap = ctx.c.snapshot().bays[0];
    assert.equal(snap.situacao, 'pausado');
    const restante = snap.pausadoAte - ctx.estado.t;
    assert.ok(restante > 3000000 && restante <= 3600000, `pausa restante ${restante}`);
  });

  it('falha informada pela página fecha o pendente na hora', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.resultado(0, { id: 999, estado: 'falhou', motivo: 'tempo' });
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'resgatando');
    ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'indisponivel' });
    const snap = ctx.c.snapshot().bays[0];
    assert.equal(snap.ultimo.estado, 'falhou');
    assert.equal(snap.ultimo.motivo, 'indisponivel');
  });

  it('dialogoAntes e dialogos do resultado de falha vão para o último resgate', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    const dialogos = [{ botoes: 1, abas: 0, itens: [], dts: [], titulo: false, campoTexto: false }];
    ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'sem-centro', dialogoAntes: true, dialogos });
    const u = ctx.c.snapshot().bays[0].ultimo;
    assert.equal(u.dialogoAntes, true);
    assert.deepEqual(u.dialogos, dialogos);
  });

  it('pistasAntes, cabecalho e classes do resultado de falha vão para o último resgate; sem eles, defaults', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    const cabecalho = { achado: true, cadeia: [{ no: 'div#x', botoes: 2, titulo: false, resumo: true, dialogo: false }] };
    ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'sem-centro', pistasAntes: ['div[dialog]'], cabecalho, classes: ['rc:div.a'] });
    const u = ctx.c.snapshot().bays[0].ultimo;
    assert.deepEqual(u.pistasAntes, ['div[dialog]']);
    assert.deepEqual(u.cabecalho, cabecalho);
    assert.deepEqual(u.classes, ['rc:div.a']);
  });

  it('pistasAntes e cabecalho ausentes viram null (sem default); classes ausente vira []', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'sem-centro' });
    const u = ctx.c.snapshot().bays[0].ultimo;
    assert.equal(u.pistasAntes, null);
    assert.equal(u.cabecalho, null);
    assert.deepEqual(u.classes, []);
  });

  it('vistos do resultado de falha vão para o último resgate', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'sem-recompensa', vistos: ['Hidratar 300'] });
    assert.deepEqual(ctx.c.snapshot().bays[0].ultimo.vistos, ['Hidratar 300']);
    assert.equal(ctx.c.snapshot().bays[0].ultimo.motivo, 'sem-recompensa');
  });

  it('o resultado de clique ("clicado") não confirma o bônus', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.resultado(0, { id: 1, estado: 'clicado', motivo: '' });
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'resgatando');
    assert.equal(ctx.c.snapshot().bays[0].ultimo, null);
  });
});

describe('controller: janela aberta pelo usuário', () => {
  it('janela visível: só o baú, nada de navegar nem resgatar', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.c.mostrar(0, true);
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'mostrar' && e[1] === 0));
    const antes = ctx.janelas.log.length;
    correr(ctx, TICK_MS, { bau: true });
    const depois = ctx.janelas.log.slice(antes);
    assert.equal(depois.filter((e) => e[0] === 'navegar').length, 0);
    assert.equal(resgates(ctx).length, 0);
    assert.equal(enviados(ctx, 'bau').length, 1);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'janela-aberta');
  });

  it('esconder com automação valendo esconde; sem automação fecha de vez', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.c.mostrar(0, true);
    ctx.c.mostrar(0, false);
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'esconder' && e[1] === 0 && e[2] === 'oculta'));
    ctx.estado.auto[0] = false;
    ctx.c.mostrar(0, true);
    ctx.c.mostrar(0, false);
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'fechar' && e[1] === 0));
  });

  it('o jogo sumir com a janela do usuário visível não fecha a janela', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.c.mostrar(0, true);
    ctx.c.setJogo(0, { ativo: false, twitch: null, offsetMs: 0 });
    const antes = ctx.janelas.log.length;
    ctx.c.tick();
    assert.equal(ctx.janelas.log.slice(antes).filter((e) => e[0] === 'fechar').length, 0);
  });

  it('janelaFechada solta o modo visível', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.c.mostrar(0, true);
    ctx.c.janelaFechada(0);
    assert.equal(ctx.c.precisaLoginRapido(0), false);
  });
});

describe('controller: sair e login', () => {
  it('sair fecha, limpa a partição e zera a conta', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.c.sair(0);
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'fechar' && e[1] === 0));
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'limpar' && e[1] === 0));
    assert.equal(ctx.c.snapshot().bays[0].loginTwitch, '');
  });

  it('trocar de conta zera o pendente; a mesma conta não zera', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
    ctx.c.setLoginTwitch(0, 'Fulano');
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
    ctx.c.setLoginTwitch(0, 'Beltrano');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ login: 'beltrano' }), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 2);
  });
});

describe('controller: leitura de login (null, vazio)', () => {
  it('setLoginTwitch com null (leitura falhou) mantém o login anterior e não avisa', () => {
    const ctx = montar();
    ctx.c.setLoginTwitch(0, 'Fulano');
    const antes = ctx.mudancas;
    ctx.c.setLoginTwitch(0, null);
    assert.equal(ctx.c.snapshot().bays[0].loginTwitch, 'fulano');
    assert.equal(ctx.mudancas, antes);
  });

  it('setLoginTwitch com string vazia zera a conta', () => {
    const ctx = montar();
    ctx.c.setLoginTwitch(0, 'Fulano');
    ctx.c.setLoginTwitch(0, '');
    assert.equal(ctx.c.snapshot().bays[0].loginTwitch, '');
  });
});

describe('controller: vigia de ganho', () => {
  it('25 min sem ganho no modo oculto troca para fora-da-tela, uma vez', () => {
    const ctx = montar();
    preparar(ctx, { blocoExtra: { bonus: { xp: 9000000000000, captura: 0, shiny: 0 } } });
    correr(ctx, 1520000, {});
    assert.equal(aberturas(ctx, 'fora-da-tela').length, 1);
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'fechar' && e[1] === 0));
    correr(ctx, 1520000, {});
    assert.equal(aberturas(ctx, 'fora-da-tela').length, 1);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-ganho');
  });

  it('um baú no meio zera a contagem', () => {
    const ctx = montar();
    preparar(ctx, { blocoExtra: { bonus: { xp: 9000000000000, captura: 0, shiny: 0 } } });
    correr(ctx, 1200000, {});
    correr(ctx, 4000, { bau: true });
    correr(ctx, 1200000, {});
    assert.equal(aberturas(ctx, 'fora-da-tela').length, 0);
    correr(ctx, 600000, {});
    assert.equal(aberturas(ctx, 'fora-da-tela').length, 1);
  });
});

describe('controller: snapshot e onChange', () => {
  it('onChange só dispara quando o estado muda', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    correr(ctx, TICK_MS, {});
    const depois = ctx.mudancas;
    correr(ctx, 4000, {});
    assert.equal(ctx.mudancas, depois);
  });

  it('o snapshot não leva token nem cookie, e os custos vêm das recompensas', () => {
    const ctx = montar();
    abrir(ctx, { blocoExtra: { recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 250 }] } });
    const snap = ctx.c.snapshot();
    assert.equal(/token|cookie|auth/i.test(JSON.stringify(snap)), false);
    assert.equal(snap.custos.xp, 250);
    assert.equal(snap.custos.captura, 500);
  });
});

describe('controller: login pelo navegador', () => {
  it('navegadorEstado ok com login atualiza a conta e recarrega só se a janela existe', () => {
    const ctx = montar();
    ctx.c.setJogo(0, { ativo: true, twitch: bloco(), offsetMs: 0 });
    ctx.c.navegadorEstado(0, { estado: 'ok', login: 'Beltrano' });
    assert.equal(ctx.c.snapshot().bays[0].loginTwitch, 'beltrano');
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar').length, 0);
    ctx.c.tick();
    ctx.c.navegadorEstado(0, { estado: 'ok', login: 'Beltrano' });
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar').length, 1);
  });

  it('o snapshot traz o estado do navegador da baía', () => {
    const ctx = montar();
    ctx.c.navegadorEstado(0, { estado: 'aberto' });
    const nav = ctx.c.snapshot().bays[0].navegador;
    assert.equal(nav.estado, 'aberto');
    assert.equal(nav.motivo, '');
    assert.equal(typeof nav.em, 'number');
  });

  it('sair zera o estado do navegador', () => {
    const ctx = montar();
    ctx.c.navegadorEstado(0, { estado: 'falhou', motivo: 'perfil-em-uso' });
    ctx.c.sair(0);
    assert.deepEqual(ctx.c.snapshot().bays[0].navegador, { estado: '', motivo: '', em: 0 });
  });
});

describe('controller: isolamento, login, vigia e erro de página (correção 1)', () => {
  it('A3: uma baía que lança não derruba as outras', () => {
    const ctx = montar();
    ctx.estado.auto[1] = true;
    const original = ctx.janelas.abrir;
    ctx.janelas.abrir = (i, url, opcoes) => {
      if (i === 0) throw new Error('falha simulada');
      return original(i, url, opcoes);
    };
    ctx.c.setJogo(0, { ativo: true, twitch: bloco(), offsetMs: 0 });
    ctx.c.setLoginTwitch(0, 'fulano');
    ctx.c.setJogo(1, { ativo: true, twitch: bloco(), offsetMs: 0 });
    ctx.c.setLoginTwitch(1, 'fulano');
    ctx.estado.auto[0] = true;
    ctx.c.tick();
    const snap = ctx.c.snapshot();
    assert.equal(snap.bays[0].situacao, 'erro-baia');
    assert.equal(snap.bays[1].situacao, 'abrindo');
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'abrir' && e[1] === 1));
  });

  it('O-2: A -> vazio -> A com resgate pendente: nenhum resgate novo antes de confirmar', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
    ctx.c.setLoginTwitch(0, '');
    correr(ctx, TICK_MS, {});
    ctx.c.setLoginTwitch(0, 'Fulano');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco(), offsetMs: 0 });
    correr(ctx, 40000, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('O-2: A -> vazio -> B zera o pendente e B pode resgatar', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
    ctx.c.setLoginTwitch(0, '');
    ctx.c.setLoginTwitch(0, 'Beltrano');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ login: 'beltrano' }), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 2);
  });

  it('O-2: "Fulano" -> "fulano" não zera o pendente', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.setLoginTwitch(0, 'fulano');
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('T1: tela de login rodando por 25 min não conta como ganho de pontos', () => {
    const ctx = montar();
    preparar(ctx, { blocoExtra: { bonus: { xp: 9000000000000, captura: 0, shiny: 0 } } });
    correr(ctx, 1600000, { logado: false, deslogado: true, rodando: true });
    assert.equal(aberturas(ctx, 'fora-da-tela').length, 0);
  });

  it('A8: erro de carga aparece na baía por um minuto e some sozinho', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.c.erroPagina(0);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'erro-pagina');
    correr(ctx, 61000, {});
    assert.notEqual(ctx.c.snapshot().bays[0].situacao, 'erro-pagina');
  });
});
