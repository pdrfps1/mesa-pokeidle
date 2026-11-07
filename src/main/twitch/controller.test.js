'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createTwitchController, TICK_MS, HOME } = require('./controller');
const { montarLinha } = require('./erros-log');

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
    estado: { t: 1000000, auto: [true, false, false, false], tipos: { xp: true, captura: false, shiny: false } },
    mudancas: 0,
    registrados: [],
  };
  ctx.c = createTwitchController({
    janelas,
    prefs: () => ({ tipos: ctx.estado.tipos, auto: ctx.estado.auto }),
    agora: () => ctx.estado.t,
    onChange: () => { ctx.mudancas += 1; },
    // Mesma conversão do log real (pausado vira ISO), para o teste ler o que de fato seria gravado.
    registrarErro: (entrada) => { ctx.registrados.push(montarLinha(entrada, () => Date.UTC(2026, 10, 6))); },
  });
  return ctx;
}

function bloco(extra) {
  return Object.assign({
    vinculado: true,
    login: 'fulano',
    bonusLido: true,
    relogioLido: true,
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

describe('log de erros do resgate', () => {
  it('falha informada pela página grava uma linha com motivo e trava', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'indisponivel', trava: 'login', fase: 'clique', clicou: true, vistos: ['Hidratar 300'] });
    const falha = ctx.registrados.find((e) => e.motivo === 'indisponivel');
    assert.ok(falha, 'falha deveria gravar uma linha');
    assert.equal(falha.baia, 0);
    assert.equal(falha.tipo, 'xp');
    assert.equal(falha.trava, 'login');
    assert.equal(falha.fase, 'clique');
    assert.equal(falha.clicou, true);
    assert.deepEqual(falha.detalhe.vistos, ['Hidratar 300']);
  });

  it('três falhas seguidas gravam uma pausa com a hora de volta', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    correr(ctx, 200000, {});
    correr(ctx, 1000000, {});
    const pausas = ctx.registrados.filter((e) => e.tipo === 'pausa');
    assert.equal(pausas.length, 1);
    assert.equal(pausas[0].motivo, 'falhas-repetidas');
    const volta = Date.parse(pausas[0].pausado) - ctx.estado.t;
    assert.ok(volta > 3000000 && volta <= 3600000, `volta restante ${volta}`);
  });

  it('relógio NaN: o resgate segue sem exceção e nenhuma pausa grava hora inválida', () => {
    const ctx = montar();
    abrir(ctx);
    ctx.estado.t = NaN;
    assert.doesNotThrow(() => correr(ctx, 1000000, {}));
    assert.doesNotThrow(() => ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'indisponivel' }));
    assert.doesNotThrow(() => ctx.c.snapshot());
    for (const e of ctx.registrados.filter((r) => r.tipo === 'pausa')) {
      assert.equal(Object.prototype.hasOwnProperty.call(e, 'pausado') ? e.pausado : null, null);
    }
    assert.equal(ctx.registrados.some((r) => typeof r.pausado === 'string' && r.pausado.includes('Invalid')), false);
  });
});

describe('controller: percurso e card clicado no registro do resgate', () => {
  it('percurso, cardClicado e totalBotoesCentro vão para o último resgate e para o detalhe do registro', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    const percurso = { caminho: 'custo', clique: { tag: 'button', role: '', emBotao: true }, rejeitado: null, lista: null, pos: null, folhas: null, escopo: null, candidatos: [], foraDoCentro: 0 };
    const cardClicado = { dts: 'RewardCard#', alvo: '', aria: '', custo: true, desab: false };
    ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'sem-recompensa', percurso, cardClicado, totalBotoesCentro: 4 });
    const u = ctx.c.snapshot().bays[0].ultimo;
    assert.deepEqual(u.percurso, percurso);
    assert.deepEqual(u.cardClicado, cardClicado);
    const registro = ctx.registrados.find((e) => e.motivo === 'sem-recompensa');
    assert.ok(registro, 'falha deveria gravar uma linha');
    assert.deepEqual(registro.detalhe.percurso, percurso);
    assert.deepEqual(registro.detalhe.cardClicado, cardClicado);
    assert.equal(registro.detalhe.totalBotoesCentro, 4);
  });

  it('sem percurso no resultado, o último resgate traz null', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.resultado(0, { id: 1, estado: 'falhou', motivo: 'sem-recompensa' });
    assert.equal(ctx.c.snapshot().bays[0].ultimo.percurso, null);
  });
});

describe('controller: trava contra gasto duplo (clique sem confirmação)', () => {
  const POS = { centro: true, botao: false, desab: false, titulo: true, novos: 0, folhas: null };

  // Clique feito pelo texto: a página manda o aviso antes do clique e o resultado depois.
  function clicadoTexto(ctx, id) {
    ctx.c.resultado(0, { id, estado: 'clicado', motivo: '' });
    ctx.c.resultado(0, { id, estado: 'clicado', motivo: '', via: 'texto', redeem: { trava: '' }, posClique: POS });
  }

  function primeiroId(ctx) {
    return resgates(ctx)[0][2].id;
  }

  it('clicado + expiração não reenvia em 2 h simuladas; situação sem-confirmacao', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
    clicadoTexto(ctx, primeiroId(ctx));
    correr(ctx, 7200000, {});
    assert.equal(resgates(ctx).length, 1);
    const snap = ctx.c.snapshot().bays[0];
    assert.equal(snap.situacao, 'sem-confirmacao');
    assert.equal(snap.ultimo.estado, 'sem-confirmacao');
    assert.equal(snap.ultimo.clicou, true);
  });

  it('expiração com clique não conta falha: três ciclos clicado+expiração não pausam a baía', () => {
    const { PRAZO_TRAVA_MS: PRAZO } = require('./controller');
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    for (let k = 0; k < 3; k += 1) {
      ctx.c.resultado(0, { id: resgates(ctx)[k][2].id, estado: 'clicado', motivo: '', via: 'dedicado' });
      correr(ctx, 200000, {});
      // A trava do clique expirado segura o tipo pelo prazo PRAZO_TRAVA_MS. Com a página rodando, espera até a trava vencer e o tipo sair de novo, e clica nesse resgate logo.
      let guarda = 0;
      while (resgates(ctx).length === k + 1 && guarda < Math.ceil((PRAZO + 60000) / TICK_MS)) {
        correr(ctx, TICK_MS, {});
        guarda += 1;
      }
    }
    assert.ok(resgates(ctx).length >= 3, 'três ciclos de resgate');
    assert.equal(ctx.registrados.some((e) => e.tipo === 'pausa'), false);
    assert.notEqual(ctx.c.snapshot().bays[0].situacao, 'pausado');
  });

  it('log de sem-confirmacao presente, com via e posClique no detalhe', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clicadoTexto(ctx, primeiroId(ctx));
    correr(ctx, 200000, {});
    const e = ctx.registrados.find((r) => r.motivo === 'sem-confirmacao');
    assert.ok(e, 'linha de sem-confirmacao');
    assert.equal(e.clicou, true);
    assert.equal(e.detalhe.via, 'texto');
    assert.ok(e.detalhe.posClique);
  });

  it('clicado com posClique grava motivo clicado-texto', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clicadoTexto(ctx, primeiroId(ctx));
    assert.equal(ctx.c.snapshot().bays[0].ultimo.motivo, 'clicado-texto');
  });

  it('confirmado com via texto grava motivo confirmado', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clicadoTexto(ctx, primeiroId(ctx));
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ bonus: { xp: ctx.estado.t + 3600000, captura: 0, shiny: 0 } }), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    assert.equal(ctx.c.snapshot().bays[0].ultimo.motivo, 'confirmado');
  });

  it('bônus tardio destrava: confirmado-tardio e último resultado ok', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clicadoTexto(ctx, primeiroId(ctx));
    correr(ctx, 200000, {});
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ bonus: { xp: ctx.estado.t + 3600000, captura: 0, shiny: 0 } }), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    assert.ok(ctx.registrados.some((e) => e.motivo === 'confirmado-tardio'));
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'ok');
  });

  it('automático desligado não apaga a trava: ao religar, o tipo segue travado até o bônus subir', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clicadoTexto(ctx, primeiroId(ctx));
    correr(ctx, 200000, {});
    assert.equal(resgates(ctx).length, 1);
    ctx.estado.auto[0] = false;
    correr(ctx, TICK_MS, {});
    ctx.estado.auto[0] = true;
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('falha depois do clique é ignorada: sem ultimo de falha, pendente segue e o log registra falha-depois-do-clique', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    const id = primeiroId(ctx);
    clicadoTexto(ctx, id);
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'indisponivel' });
    const snap = ctx.c.snapshot().bays[0];
    assert.notEqual(snap.ultimo && snap.ultimo.estado, 'falhou');
    assert.equal(snap.situacao, 'resgatando');
    assert.ok(ctx.registrados.some((e) => e.motivo === 'falha-depois-do-clique'));
  });

  it('troca de conta não apaga a trava: conta diferente resgata; voltar à conta que clicou reencontra a trava', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clicadoTexto(ctx, primeiroId(ctx));
    correr(ctx, 200000, {});
    assert.equal(resgates(ctx).length, 1);
    ctx.c.setLoginTwitch(0, 'outra');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ login: 'outra' }), offsetMs: 0 });
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 2);
    ctx.c.setLoginTwitch(0, 'fulano');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ login: 'fulano' }), offsetMs: 0 });
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 2);
  });

  it('sair com clique sem confirmação converte em trava: ao entrar de novo, não resgata', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clicadoTexto(ctx, primeiroId(ctx));
    ctx.c.sair(0);
    ctx.c.setLoginTwitch(0, 'fulano');
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 1);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-confirmacao');
  });

  it('outro tipo segue resgatando enquanto um está travado', () => {
    const ctx = montar();
    ctx.estado.tipos.captura = true;
    abrir(ctx, { blocoExtra: { recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }, { tipo: 'captura', titulo: 'Captura', custo: 300 }] } });
    correr(ctx, TICK_MS, {});
    clicadoTexto(ctx, primeiroId(ctx));
    correr(ctx, 200000, {});
    const titulos = resgates(ctx).map((e) => e[2].titulo);
    assert.equal(titulos[0], 'Bônus XP');
    assert.ok(titulos.includes('Captura'), 'captura deveria resgatar: ' + titulos.join(','));
    assert.equal(titulos.filter((x) => x === 'Bônus XP').length, 1);
  });

  it('sem clique, a expiração segue o backoff atual e volta a resgatar', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    correr(ctx, 200000, {});
    correr(ctx, 7200000, {});
    assert.ok(resgates(ctx).length > 1);
  });
});

describe('controller: aviso do clique dedicado (via dedicado)', () => {
  function clicadoDedicado(ctx, id) {
    ctx.c.resultado(0, { id, estado: 'clicado', motivo: '', via: 'dedicado' });
  }

  it('falha depois do clique dedicado não reenvia em 2 h e registra falha-depois-do-clique', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    const id = resgates(ctx)[0][2].id;
    clicadoDedicado(ctx, id);
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'indisponivel' });
    correr(ctx, 7200000, {});
    assert.equal(resgates(ctx).length, 1);
    assert.ok(ctx.registrados.some((e) => e.motivo === 'falha-depois-do-clique'));
  });

  it('sair no meio do clique dedicado cria trava: ao entrar de novo não resgata', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clicadoDedicado(ctx, resgates(ctx)[0][2].id);
    ctx.c.sair(0);
    ctx.c.setLoginTwitch(0, 'fulano');
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 1);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-confirmacao');
  });
});

describe('controller: frame real com só xp (rodada prazo)', () => {
  const L = require('../../shared/live-catalog');

  // Frame do jogo passa pelo catálogo: só xp no prazo futuro, relógio lido. Completo: chave ausente quer dizer sem bônus.
  function frameSoXp(ctx, bonus, completo = true) {
    const patch = L.sanitizeLivePatch({ completo, twitch: Object.assign({ vinculado: true, login: 'fulano' }, bonus ? { bonus } : {}), servidorAgora: ctx.estado.t });
    const bay = L.applyBayPatch(L.emptyBayLive(), patch, ctx.estado.t);
    return Object.assign({}, bay.twitch, {
      recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }, { tipo: 'captura', titulo: 'Captura', custo: 300 }],
      oficiais: bloco().oficiais,
      pct: 15,
      minutos: 60,
    });
  }

  it('frame completo com bonus { xp: prazo futuro } e relógio lido: captura é resgatada e xp não', () => {
    const ctx = montar();
    ctx.estado.tipos.captura = true;
    ctx.c.setLoginTwitch(0, 'fulano');
    ctx.c.setJogo(0, { ativo: true, twitch: frameSoXp(ctx, { xp: ctx.estado.t + 3600000 }), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    correr(ctx, TICK_MS, {});
    const titulos = resgates(ctx).map((e) => e[2].titulo);
    assert.deepEqual(titulos, ['Captura']);
  });

  it('frame parcial com bonus { xp: prazo futuro }: captura não é resgatada, sem-leitura', () => {
    const ctx = montar();
    ctx.estado.tipos.captura = true;
    ctx.c.setLoginTwitch(0, 'fulano');
    ctx.c.setJogo(0, { ativo: true, twitch: frameSoXp(ctx, { xp: ctx.estado.t + 3600000 }, false), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 0);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-leitura');
  });

  it('frame sem bonus: bonusLido falso e sem-leitura, mesmo com os zeros', () => {
    const ctx = montar();
    ctx.c.setLoginTwitch(0, 'fulano');
    ctx.c.setJogo(0, { ativo: true, twitch: frameSoXp(ctx, null), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 0);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-leitura');
  });
});

describe('controller: prazo do bônus e leitura válida (rodada prazo)', () => {
  function setJogoBloco(ctx, extra, offsetMs = 0) {
    ctx.c.setJogo(0, { ativo: true, twitch: bloco(extra), offsetMs });
  }

  it('bonusLido falso: situação sem-leitura, nenhum resgate; depois da leitura resgata', () => {
    const ctx = montar();
    preparar(ctx, { blocoExtra: { bonusLido: false } });
    correr(ctx, TICK_MS, {});
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 0);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-leitura');
    setJogoBloco(ctx, { bonusLido: true });
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('relogioLido falso: nenhum resgate; depois da leitura resgata', () => {
    const ctx = montar();
    preparar(ctx, { blocoExtra: { relogioLido: false } });
    correr(ctx, TICK_MS, {});
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 0);
    setJogoBloco(ctx, { relogioLido: true });
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('prefs sem limiar: 1 min restante não resgata', () => {
    const ctx = montar();
    preparar(ctx, { blocoExtra: { bonus: { xp: ctx.estado.t + 60000, captura: 0, shiny: 0 } } });
    correr(ctx, TICK_MS, {});
    correr(ctx, 30000, {});
    assert.equal(resgates(ctx).length, 0);
  });

  it('offsetMs negativo: o prazo passou no local mas não no servidor, então não resgata', () => {
    const ctx = montar();
    setJogoBloco(ctx, { bonus: { xp: ctx.estado.t - 30000, captura: 0, shiny: 0 } }, -60000);
    correr(ctx, TICK_MS, {});
    correr(ctx, 30000, {});
    assert.equal(resgates(ctx).length, 0);
  });

  it('1 s restante não resgata; depois do prazo resgata uma vez só', () => {
    const ctx = montar();
    preparar(ctx, { blocoExtra: { bonus: { xp: ctx.estado.t + 1000, captura: 0, shiny: 0 } } });
    correr(ctx, TICK_MS, {});
    assert.equal(resgates(ctx).length, 0);
    correr(ctx, 2000, {});
    assert.equal(resgates(ctx).length, 1);
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('dois tipos acabados, um por vez: o segundo sai só depois da confirmação do primeiro, com intervalo de 20 s', () => {
    const ctx = montar();
    ctx.estado.tipos.captura = true;
    preparar(ctx, { blocoExtra: { recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }, { tipo: 'captura', titulo: 'Captura', custo: 300 }] } });
    correr(ctx, TICK_MS, {});
    correr(ctx, TICK_MS, {});
    assert.deepEqual(resgates(ctx).map((e) => e[2].titulo), ['Bônus XP']);
    correr(ctx, 5000, {});
    assert.equal(resgates(ctx).length, 1, 'não resgata o segundo com um pendente aberto');
    setJogoBloco(ctx, { bonus: { xp: ctx.estado.t + 3600000, captura: 0, shiny: 0 }, recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }, { tipo: 'captura', titulo: 'Captura', custo: 300 }] });
    correr(ctx, TICK_MS, {});
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'ok');
    correr(ctx, 25000, {});
    assert.deepEqual(resgates(ctx).map((e) => e[2].titulo), ['Bônus XP', 'Captura']);
  });
});

// ---- Multi-live (até 4 vagas por baía). Helpers próprios; os de cima seguem iguais.

function montarVagas() {
  const janelas = fakeJanelas();
  const ctx = {
    janelas,
    estado: {
      t: 1000000,
      auto: [true, false, false, false],
      tipos: { xp: true, captura: false, shiny: false },
      streams: [4, 1, 1, 1],
      canais: [[], [], [], []],
    },
    registrados: [],
  };
  ctx.c = createTwitchController({
    janelas,
    prefs: () => ({ tipos: ctx.estado.tipos, auto: ctx.estado.auto, streams: ctx.estado.streams, canais: ctx.estado.canais }),
    agora: () => ctx.estado.t,
    onChange: () => {},
    registrarErro: (entrada) => { ctx.registrados.push(montarLinha(entrada, () => Date.UTC(2026, 10, 6))); },
  });
  return ctx;
}

const OF = (login, espectadores = 10) => ({ login, nome: login, espectadores, aoVivo: true, ativo: true });
const REC = [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }];

function prepararVagas(ctx, { oficiais, streams, canais, recompensas = REC, bonus, login = 'Fulano' }) {
  ctx.estado.streams = streams;
  ctx.estado.canais = canais;
  const extra = { oficiais, recompensas };
  if (bonus) extra.bonus = bonus;
  ctx.c.setJogo(0, { ativo: true, twitch: bloco(extra), offsetMs: 0 });
  ctx.c.setLoginTwitch(0, login);
}

// Uma passada por tick: manda a página das janelas abertas (paginas: { k: { canal, saldoTexto, ... } }) e roda o tick.
function passarVagas(ctx, ms, paginas) {
  const passos = Math.max(1, Math.round(ms / TICK_MS));
  for (let n = 0; n < passos; n += 1) {
    ctx.estado.t += TICK_MS;
    for (const k of Object.keys(paginas)) {
      const kk = Number(k);
      if (ctx.janelas.existe(kk)) ctx.c.pagina(kk, fatos(paginas[k]));
    }
    ctx.c.tick();
  }
}

function resgatesDe(ctx) {
  return resgates(ctx).map((e) => e[1]);
}

describe('multi-live: abertura escalonada', () => {
  it('k 0, depois 4, 8, 12: uma abertura por tick, só com a vaga 0 logada', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b'), OF('c'), OF('d')], streams: [4, 1, 1, 1], canais: [['a', 'b', 'c', 'd'], [], [], []] });
    const paginas = { 0: { canal: 'a', saldoTexto: '100' }, 4: { canal: 'b', saldoTexto: '100' }, 8: { canal: 'c', saldoTexto: '100' }, 12: { canal: 'd', saldoTexto: '100' } };
    const abertos = [];
    for (let tk = 0; tk < 5; tk += 1) {
      const antes = ctx.janelas.log.length;
      passarVagas(ctx, TICK_MS, paginas);
      for (const e of ctx.janelas.log.slice(antes)) if (e[0] === 'abrir') abertos.push([tk, e[1]]);
    }
    assert.deepEqual(abertos, [[0, 0], [1, 4], [2, 8], [3, 12]]);
  });

  it('sem a vaga 0 logada, as outras não abrem', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
    passarVagas(ctx, 10 * TICK_MS, { 0: { canal: 'a', logado: false, saldoTexto: '100' } });
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'abrir' && e[1] === 4).length, 0);
  });
});

describe('multi-live: resgate entre lives', () => {
  const quatro = () => ({
    oficiais: [OF('a'), OF('b'), OF('c'), OF('d')],
    streams: [4, 1, 1, 1],
    canais: [['a', 'b', 'c', 'd'], [], [], []],
  });
  const paginasSaldo = (a, b, c, d) => ({
    0: { canal: 'a', saldoTexto: a },
    4: { canal: 'b', saldoTexto: b },
    8: { canal: 'c', saldoTexto: c },
    12: { canal: 'd', saldoTexto: d },
  });

  it('saldos 100, 350, 610 e 900: exatamente 1 resgate, no canal de 350', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, quatro());
    passarVagas(ctx, 16 * TICK_MS, paginasSaldo('100', '350', '610', '900'));
    assert.deepEqual(resgatesDe(ctx), [4]);
  });

  it('durante o pendente, mais lives com saldo não geram novo resgate (170 s de ticks)', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, quatro());
    passarVagas(ctx, 16 * TICK_MS, paginasSaldo('100', '350', '610', '900'));
    passarVagas(ctx, 170000, paginasSaldo('100', '350', '610', '900'));
    assert.equal(resgates(ctx).length, 1);
  });

  it('expirado com clique: 0 novos resgates em 300 ticks, mesmo trocando canais e quantidade', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, quatro());
    passarVagas(ctx, 16 * TICK_MS, paginasSaldo('100', '350', '610', '900'));
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(4, { id, estado: 'clicado', motivo: '', via: 'dedicado' });
    passarVagas(ctx, 185000, paginasSaldo('100', '350', '610', '900'));
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'sem-confirmacao');
    ctx.estado.streams = [2, 1, 1, 1];
    ctx.estado.canais = [['c', 'd'], [], [], []];
    passarVagas(ctx, 300 * TICK_MS, paginasSaldo('100', '350', '610', '900'));
    assert.equal(resgates(ctx).length, 1);
  });

  it('confirmação tardia destrava e conta 1 sucesso', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, quatro());
    passarVagas(ctx, 16 * TICK_MS, paginasSaldo('100', '350', '610', '900'));
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(4, { id, estado: 'clicado', motivo: '', via: 'dedicado' });
    passarVagas(ctx, 185000, paginasSaldo('100', '350', '610', '900'));
    prepararVagas(ctx, { ...quatro(), bonus: { xp: 9999999, captura: 0, shiny: 0 } });
    passarVagas(ctx, 2 * TICK_MS, paginasSaldo('100', '350', '610', '900'));
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'ok');
    assert.equal(ctx.registrados.filter((r) => r.motivo === 'confirmado-tardio').length, 1);
    assert.equal(resgates(ctx).length, 1);
  });

  it('resultado com k diferente é ignorado; repetido não duplica', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, quatro());
    passarVagas(ctx, 16 * TICK_MS, paginasSaldo('100', '350', '610', '900'));
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'tempo' });
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'resgatando');
    ctx.c.resultado(4, { id, estado: 'falhou', motivo: 'tempo' });
    ctx.c.resultado(4, { id, estado: 'falhou', motivo: 'tempo' });
    assert.equal(ctx.registrados.filter((r) => r.motivo === 'tempo').length, 1);
  });

  it('sem-recompensa no canal A: A pausa, B tenta depois de 20 s, a baía não pausa', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
    const pag = { 0: { canal: 'a', saldoTexto: '500' }, 4: { canal: 'b', saldoTexto: '500' } };
    passarVagas(ctx, 2 * TICK_MS, pag);
    passarVagas(ctx, 4 * TICK_MS, pag);
    assert.deepEqual(resgatesDe(ctx), [0]);
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'sem-recompensa' });
    passarVagas(ctx, 40000, pag);
    assert.ok(resgatesDe(ctx).includes(4));
    assert.equal(ctx.c.snapshot().bays[0].pausadoAte, 0);
  });

  it('falha de tempo pausa a baía: nenhuma outra live tenta', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
    const pag = { 0: { canal: 'a', saldoTexto: '500' }, 4: { canal: 'b', saldoTexto: '500' } };
    passarVagas(ctx, 2 * TICK_MS, pag);
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'tempo' });
    passarVagas(ctx, 60000, pag);
    assert.equal(resgates(ctx).length, 1);
  });

  it('remover o canal do pendente: a janela fica aberta e o resultado ainda vale', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [1, 1, 1, 1], canais: [['a'], [], [], []] });
    passarVagas(ctx, 2 * TICK_MS, { 0: { canal: 'a', saldoTexto: '500' } });
    assert.equal(resgates(ctx).length, 1);
    ctx.estado.canais = [['b'], [], [], []];
    passarVagas(ctx, 10 * TICK_MS, { 0: { canal: 'a', saldoTexto: '500' } });
    assert.ok(ctx.janelas.existe(0));
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'fechar' && e[1] === 0).length, 0);
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'tempo' });
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'falhou');
  });

  it('janela visível em uma live: 0 resgates na baía', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
    passarVagas(ctx, 6 * TICK_MS, { 0: { canal: 'a', saldoTexto: '100' }, 4: { canal: 'b', saldoTexto: '100' } });
    ctx.c.mostrar(4, true);
    passarVagas(ctx, 60000, { 0: { canal: 'a', saldoTexto: '900' }, 4: { canal: 'b', saldoTexto: '900' } });
    assert.equal(resgates(ctx).length, 0);
  });
});

describe('multi-live: vigia de ganho por live', () => {
  it('sem-ganho em uma live: só ela sai da tela, uma vez; a baía não vira sem-ganho', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []], recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 100000 }] });
    for (let tk = 0; tk < 800; tk += 1) {
      ctx.estado.t += TICK_MS;
      if (ctx.janelas.existe(0)) ctx.c.pagina(0, fatos({ canal: 'a', rodando: true, saldoTexto: String(100 + tk) }));
      if (ctx.janelas.existe(4)) ctx.c.pagina(4, fatos({ canal: 'b', rodando: true, saldoTexto: '500' }));
      ctx.c.tick();
    }
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'fechar' && e[1] === 4).length, 1);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'fechar' && e[1] === 0).length, 0);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'abrir' && e[1] === 4 && e[3].modo === 'fora-da-tela').length, 1);
    const snap = ctx.c.snapshot().bays[0];
    assert.notEqual(snap.situacao, 'sem-ganho');
    assert.equal(snap.streams[1].modo, 'fora-da-tela');
    assert.equal(snap.streams[0].semGanho, false);
  });
});

describe('multi-live: sair e registro', () => {
  it('sair fecha as 4 janelas da baía e chama limpar uma vez', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b'), OF('c'), OF('d')], streams: [4, 1, 1, 1], canais: [['a', 'b', 'c', 'd'], [], [], []] });
    passarVagas(ctx, 8 * TICK_MS, { 0: { canal: 'a', saldoTexto: '100' }, 4: { canal: 'b', saldoTexto: '100' }, 8: { canal: 'c', saldoTexto: '100' }, 12: { canal: 'd', saldoTexto: '100' } });
    ctx.janelas.log.length = 0;
    ctx.c.sair(0);
    const fechados = ctx.janelas.log.filter((e) => e[0] === 'fechar').map((e) => e[1]).sort((x, y) => x - y);
    assert.deepEqual(fechados, [0, 4, 8, 12]);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'limpar').length, 1);
  });

  it('o registro leva canal e vaga; texto de página não vira canal', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
    passarVagas(ctx, 2 * TICK_MS, { 0: { canal: 'a', saldoTexto: '500' }, 4: { canal: 'b', saldoTexto: '500' } });
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'sem-botao', vistos: ['<img src=x onerror=alert(1)>'] });
    const linha = ctx.registrados[ctx.registrados.length - 1];
    assert.equal(linha.canal, 'a');
    assert.equal(linha.stream, 0);
    assert.equal(linha.motivo, 'sem-botao');
  });
});

// ---- Rodada 2: pendente protegido, semConfirmacao com canal e vaga, orçamento global, medição e canais congelados.

// Setup comum: a só tem saldo baixo; b tem saldo alto. O resgate sai na vaga 4 (canal b).
function cenarioB(ctx) {
  prepararVagas(ctx, { oficiais: [OF('a'), OF('b'), OF('c')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
  const pag = { 0: { canal: 'a', saldoTexto: '100' }, 4: { canal: 'b', saldoTexto: '900' } };
  passarVagas(ctx, 8 * TICK_MS, pag);
  return pag;
}

function confirmarBonus(ctx, streams, canais) {
  prepararVagas(ctx, {
    oficiais: [OF('a'), OF('b'), OF('c')],
    streams,
    canais,
    bonus: { xp: 9999999, captura: 0, shiny: 0 },
  });
}

describe('rodada 2: pendente protegido e canais congelados', () => {
  it('motivo de pré-requisito (automático desligado) não fecha a janela do pendente clicado; a confirmação segue valendo', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    assert.deepEqual(resgatesDe(ctx), [4]);
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(4, { id, estado: 'clicado', motivo: '', via: 'dedicado' });
    ctx.estado.auto[0] = false;
    passarVagas(ctx, 5 * TICK_MS, pag);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'fechar' && e[1] === 4).length, 0);
    confirmarBonus(ctx, [2, 1, 1, 1], [['a', 'b'], [], [], []]);
    passarVagas(ctx, TICK_MS, pag);
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'ok');
  });

  it('navegadorEstado ok não recarrega a janela do pendente, mas recarrega as outras', () => {
    const ctx = montarVagas();
    cenarioB(ctx);
    ctx.janelas.log.length = 0;
    ctx.c.navegadorEstado(0, { estado: 'ok', login: 'fulano' });
    assert.ok(ctx.janelas.log.some((e) => e[0] === 'recarregar' && e[1] === 0));
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar' && e[1] === 4).length, 0);
  });

  it('trocar canais com pendente não navega a janela do pendente (canais congelados)', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b'), OF('c')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
    const pag = { 0: { canal: 'a', saldoTexto: '100' }, 4: { canal: 'b', saldoTexto: '900' } };
    passarVagas(ctx, 8 * TICK_MS, pag);
    assert.deepEqual(resgatesDe(ctx), [4]);
    ctx.janelas.log.length = 0;
    ctx.estado.canais = [['c'], [], [], []];
    passarVagas(ctx, 10 * TICK_MS, pag);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'navegar' && e[1] === 4).length, 0);
  });
});

describe('rodada 2: semConfirmacao, confirmação e falha por canal', () => {
  it('trocar canal ou quantidade não apaga semConfirmacao: nenhum resgate novo do tipo', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(4, { id, estado: 'clicado', motivo: '', via: 'dedicado' });
    passarVagas(ctx, 185000, pag);
    ctx.estado.streams = [1, 1, 1, 1];
    ctx.estado.canais = [['c'], [], [], []];
    const pag2 = { 0: { canal: 'c', saldoTexto: '900' } };
    passarVagas(ctx, 300 * TICK_MS, pag2);
    assert.equal(resgates(ctx).length, 1);
  });

  it('confirmado-tardio leva canal e vaga para o último resultado e para o log', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(4, { id, estado: 'clicado', motivo: '', via: 'dedicado' });
    passarVagas(ctx, 185000, pag);
    confirmarBonus(ctx, [2, 1, 1, 1], [['a', 'b'], [], [], []]);
    passarVagas(ctx, TICK_MS, pag);
    const tardio = ctx.registrados.find((r) => r.motivo === 'confirmado-tardio');
    assert.ok(tardio);
    assert.equal(tardio.canal, 'b');
    assert.equal(tardio.stream, 1);
    assert.equal(ctx.c.snapshot().bays[0].ultimo.canal, 'b');
  });

  it('confirmação limpa a falha do canal: a próxima falha volta a pausar por 120 s, não por 300 s', () => {
    const ctx = montarVagas();
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
    const pag = { 0: { canal: 'a', saldoTexto: '500' }, 4: { canal: 'b', saldoTexto: '100' } };
    passarVagas(ctx, 4 * TICK_MS, pag);
    const id1 = resgates(ctx)[0][2].id;
    ctx.c.resultado(0, { id: id1, estado: 'falhou', motivo: 'sem-recompensa' });
    passarVagas(ctx, 125000, pag);
    assert.equal(resgates(ctx).length, 2);
    confirmarBonus(ctx, [2, 1, 1, 1], [['a', 'b'], [], [], []]);
    passarVagas(ctx, TICK_MS, pag);
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []] });
    passarVagas(ctx, 25 * TICK_MS, pag);
    const ultimo = resgates(ctx)[resgates(ctx).length - 1];
    assert.equal(ultimo[1], 0);
    ctx.c.resultado(0, { id: ultimo[2].id, estado: 'falhou', motivo: 'sem-recompensa' });
    const s0 = ctx.c.snapshot().bays[0].streams[0];
    assert.equal(s0.pausadoAte - ctx.estado.t, 120000);
  });
});

describe('rodada 2: resultado com k errado e orçamento global', () => {
  it('falhou com k errado não conta falha; o do k certo depois conclui', () => {
    const ctx = montarVagas();
    cenarioB(ctx);
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'tempo' });
    assert.equal(ctx.registrados.filter((r) => r.motivo === 'tempo').length, 0);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'resgatando');
    ctx.c.resultado(4, { id, estado: 'falhou', motivo: 'tempo' });
    assert.equal(ctx.registrados.filter((r) => r.motivo === 'tempo').length, 1);
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'falhou');
  });

  it('uma janela de vídeo por tick no total: a vaga 0 de baías diferentes abre em ticks seguidos', () => {
    const ctx = montarVagas();
    ctx.estado.auto = [true, true, false, false];
    ctx.estado.streams = [1, 1, 1, 1];
    ctx.estado.canais = [['a'], ['x'], [], []];
    prepararVagas(ctx, { oficiais: [OF('a')], streams: [1, 1, 1, 1], canais: [['a'], ['x'], [], []] });
    ctx.c.setJogo(1, { ativo: true, twitch: bloco({ oficiais: [OF('x')] }), offsetMs: 0 });
    ctx.c.setLoginTwitch(1, 'fulano');
    ctx.c.tick();
    assert.deepEqual(ctx.janelas.log.filter((e) => e[0] === 'abrir').map((e) => e[1]), [0]);
    ctx.estado.t += TICK_MS;
    ctx.c.tick();
    assert.deepEqual(ctx.janelas.log.filter((e) => e[0] === 'abrir').map((e) => e[1]), [0, 1]);
  });
});

// ---- Rodada 3: recargas protegidas, expiração sem clique, vaga sem canal, sair com guarda e orçamento 4x4.

describe('rodada 3: recarga do pendente e fluxo antigo', () => {
  it('sem página fresca por 60 s, a janela do pendente não é recarregada (passo 5)', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    ctx.janelas.log.length = 0;
    passarVagas(ctx, 60000, { 0: pag[0] });
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar' && e[1] === 4).length, 0);
  });

  it('vídeo parado por 100 s não recarrega a janela do pendente (passo 6)', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    ctx.janelas.log.length = 0;
    passarVagas(ctx, 100000, { 0: pag[0], 4: { canal: 'b', saldoTexto: '900', rodando: false } });
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar' && e[1] === 4).length, 0);
  });

  it('pendente expirado sem clique: a janela é recarregada antes do próximo resgate; o resultado tardio é ignorado', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    const id1 = resgates(ctx)[0][2].id;
    ctx.janelas.log.length = 0;
    passarVagas(ctx, 330000, pag);
    const idxRecarga = ctx.janelas.log.findIndex((e) => e[0] === 'recarregar' && e[1] === 4);
    const idxResgate = ctx.janelas.log.findIndex((e) => e[0] === 'enviar' && e[2].tipo === 'resgatar');
    assert.ok(idxRecarga >= 0);
    assert.ok(idxResgate > idxRecarga);
    const antes = ctx.registrados.filter((r) => r.motivo === 'tempo').length;
    ctx.c.resultado(4, { id: id1, estado: 'falhou', motivo: 'tempo' });
    assert.equal(ctx.registrados.filter((r) => r.motivo === 'tempo').length, antes);
  });
});

describe('rodada 3: vaga sem canal, troca de canal e sair', () => {
  it('canal sai da vaga e volta: a medição recomeça e mostra Medindo', () => {
    const ctx = montarVagas();
    const rec = [{ tipo: 'xp', titulo: 'Bônus XP', custo: 100000 }];
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []], recompensas: rec });
    for (let tk = 0; tk < 480; tk += 1) {
      ctx.estado.t += TICK_MS;
      if (ctx.janelas.existe(0)) ctx.c.pagina(0, fatos({ canal: 'a', saldoTexto: '100' }));
      if (ctx.janelas.existe(4)) ctx.c.pagina(4, fatos({ canal: 'b', saldoTexto: String(100 + tk) }));
      ctx.c.tick();
    }
    const medido = ctx.c.snapshot().bays[0].streams[1];
    assert.equal(medido.medindo, false);
    assert.notEqual(medido.ganhoHora, null);
    prepararVagas(ctx, { oficiais: [OF('a')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []], recompensas: rec });
    passarVagas(ctx, 3 * TICK_MS, { 0: { canal: 'a', saldoTexto: '100' } });
    assert.equal(ctx.c.snapshot().bays[0].streams[1].canal, null);
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []], recompensas: rec });
    passarVagas(ctx, 6 * TICK_MS, { 0: { canal: 'a', saldoTexto: '100' }, 4: { canal: 'b', saldoTexto: '500' } });
    const volta = ctx.c.snapshot().bays[0].streams[1];
    assert.equal(volta.canal.login, 'b');
    assert.equal(volta.medindo, true);
    assert.equal(volta.ganhoHora, null);
  });

  it('trocar o canal da vaga recomeça a medição: o canal novo não herda o tempo do antigo', () => {
    const ctx = montarVagas();
    const rec = [{ tipo: 'xp', titulo: 'Bônus XP', custo: 100000 }];
    prepararVagas(ctx, { oficiais: [OF('a'), OF('c')], streams: [1, 1, 1, 1], canais: [['a'], [], [], []], recompensas: rec });
    for (let tk = 0; tk < 480; tk += 1) {
      ctx.estado.t += TICK_MS;
      if (ctx.janelas.existe(0)) ctx.c.pagina(0, fatos({ canal: 'a', saldoTexto: String(100 + tk) }));
      ctx.c.tick();
    }
    assert.equal(ctx.c.snapshot().bays[0].streams[0].medindo, false);
    prepararVagas(ctx, { oficiais: [OF('a'), OF('c')], streams: [1, 1, 1, 1], canais: [['c'], [], [], []], recompensas: rec });
    passarVagas(ctx, 10 * TICK_MS, { 0: { canal: 'c', saldoTexto: '100' } });
    const s0 = ctx.c.snapshot().bays[0].streams[0];
    assert.equal(s0.canal.login, 'c');
    assert.equal(s0.medindo, true);
    assert.equal(s0.ganhoHora, null);
  });

  it('sair no meio do pendente clicado guarda canal e vaga na trava: o confirmado tardio leva os dois', () => {
    const ctx = montarVagas();
    cenarioB(ctx);
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(4, { id, estado: 'clicado', motivo: '', via: 'dedicado' });
    ctx.c.sair(0);
    ctx.registrados.length = 0;
    prepararVagas(ctx, { oficiais: [OF('a'), OF('b'), OF('c')], streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []], bonus: { xp: 9999999, captura: 0, shiny: 0 } });
    passarVagas(ctx, TICK_MS, {});
    const tardio = ctx.registrados.find((r) => r.motivo === 'confirmado-tardio');
    assert.ok(tardio);
    assert.equal(tardio.canal, 'b');
    assert.equal(tardio.stream, 1);
  });
});

describe('rodada 3: orçamento global 4x4', () => {
  it('4 baías × 4 vagas: 16 janelas em 16 ticks, no máximo uma por tick, sem vaga ficar para trás', () => {
    const ctx = montarVagas();
    ctx.estado.auto = [true, true, true, true];
    ctx.estado.streams = [4, 4, 4, 4];
    for (let i = 0; i < 4; i += 1) {
      const logins = [0, 1, 2, 3].map((j) => `x${i}${j}`);
      ctx.c.setJogo(i, { ativo: true, twitch: bloco({ oficiais: logins.map((l) => OF(l)), recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 100000 }] }), offsetMs: 0 });
      ctx.c.setLoginTwitch(i, 'fulano');
      ctx.estado.canais[i] = logins;
    }
    const porTick = [];
    for (let tk = 0; tk < 16; tk += 1) {
      ctx.estado.t += TICK_MS;
      for (let k = 0; k < 16; k += 1) {
        if (!ctx.janelas.existe(k)) continue;
        const bay = k % 4;
        const s = Math.floor(k / 4);
        ctx.c.pagina(k, fatos({ canal: `x${bay}${s}`, saldoTexto: '100' }));
      }
      const antes = ctx.janelas.log.length;
      ctx.c.tick();
      porTick.push(ctx.janelas.log.slice(antes).filter((e) => e[0] === 'abrir').length);
    }
    assert.ok(porTick.every((n) => n <= 1));
    const abertos = ctx.janelas.log.filter((e) => e[0] === 'abrir').map((e) => e[1]);
    assert.equal(abertos.length, 16);
    assert.equal(new Set(abertos).size, 16);
  });
});


// ---- Prazo da trava (PRAZO_TRAVA_MS contados de em).
describe('trava com prazo de 3 h', () => {
  const clica = (ctx, id) => ctx.c.resultado(0, { id, estado: 'clicado', motivo: '', via: 'dedicado' });

  it('trava vencida: o tipo volta a resgatar e o log registra tipo, canal e conta', () => {
    const { PRAZO_TRAVA_MS: PRAZO } = require('./controller');
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clica(ctx, resgates(ctx)[0][2].id);
    correr(ctx, 200000, {});
    assert.equal(resgates(ctx).length, 1);
    let guarda = 0;
    while (resgates(ctx).length < 2 && guarda < Math.ceil((PRAZO + 60000) / TICK_MS)) {
      correr(ctx, TICK_MS, {});
      guarda += 1;
    }
    assert.equal(resgates(ctx).length, 2);
    const vencida = ctx.registrados.find((r) => r.motivo === 'trava-vencida');
    assert.ok(vencida);
    assert.equal(vencida.tipo, 'xp');
    assert.equal(vencida.canal, 'canala');
    assert.equal(vencida.detalhe.conta, 'fulano');
  });

  it('1 min antes do prazo ainda segura o tipo', () => {
    const { PRAZO_TRAVA_MS: PRAZO } = require('./controller');
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clica(ctx, resgates(ctx)[0][2].id);
    correr(ctx, 200000, {});
    correr(ctx, PRAZO - 80000, {});
    assert.equal(resgates(ctx).length, 1);
    assert.equal(ctx.registrados.some((r) => r.motivo === 'trava-vencida'), false);
  });
});

// ---- Rodada 4: trava por conta, gasto duplo na troca de login e guardas do pendente.
describe('rodada 4: trava por conta e guardas do pendente', () => {
  const POS = { centro: true, botao: false, desab: false, titulo: true, novos: 0, folhas: null };
  const clica = (ctx, id) => ctx.c.resultado(0, { id, estado: 'clicado', motivo: '', via: 'dedicado' });

  it('clique que vira trava na troca de conta: a trava fica com quem clicou; voltar a ela segue travado', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clica(ctx, resgates(ctx)[0][2].id);
    ctx.c.setLoginTwitch(0, 'outra');
    ctx.c.setLoginTwitch(0, 'fulano');
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('login lido vazio depois do clique: o clique segue com a conta que clicou e vira trava dela', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clica(ctx, resgates(ctx)[0][2].id);
    ctx.c.setLoginTwitch(0, '');
    correr(ctx, 200000, {});
    ctx.c.setLoginTwitch(0, 'Fulano');
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('bônus de outra conta não confirma o pendente; a mesma conta confirma depois', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    assert.deepEqual(resgatesDe(ctx), [4]);
    const subiu = { xp: 9999999, captura: 0, shiny: 0 };
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ oficiais: [OF('a'), OF('b'), OF('c')], login: 'outra', bonus: subiu }), offsetMs: 0 });
    passarVagas(ctx, 4 * TICK_MS, pag);
    assert.equal(ctx.registrados.some((r) => r.motivo === 'confirmado'), false);
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ oficiais: [OF('a'), OF('b'), OF('c')], login: 'fulano', bonus: subiu }), offsetMs: 0 });
    passarVagas(ctx, TICK_MS, pag);
    assert.equal(ctx.registrados.some((r) => r.motivo === 'confirmado'), true);
  });

  it('bônus de outra conta não solta a trava; a conta que clicou solta quando o bônus sobe', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    clica(ctx, resgates(ctx)[0][2].id);
    correr(ctx, 200000, {});
    const subiu = { xp: 9999999, captura: 0, shiny: 0 };
    ctx.c.setLoginTwitch(0, 'outra');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ login: 'outra', bonus: subiu }), offsetMs: 0 });
    correr(ctx, 4 * TICK_MS, {});
    assert.equal(ctx.registrados.some((r) => r.motivo === 'confirmado-tardio'), false);
    ctx.c.setLoginTwitch(0, 'fulano');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ login: 'fulano', bonus: subiu }), offsetMs: 0 });
    correr(ctx, TICK_MS, {});
    assert.equal(ctx.registrados.some((r) => r.motivo === 'confirmado-tardio'), true);
  });

  it('login alternando por 1 h, cada clique vira trava de quem clicou: resgates ficam travados', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    let atual = 'fulano';
    const clicados = new Set();
    for (let tk = 0; tk < 1800; tk += 1) {
      ctx.estado.t += TICK_MS;
      if (ctx.janelas.existe(0)) ctx.c.pagina(0, fatos({}));
      if (tk % 5 === 4) {
        const lista = resgates(ctx);
        const ultimo = lista.length ? lista[lista.length - 1][2].id : null;
        if (ultimo !== null && !clicados.has(ultimo)) {
          clicados.add(ultimo);
          ctx.c.resultado(0, { id: ultimo, estado: 'clicado', motivo: '', via: 'dedicado' });
        }
        atual = atual === 'fulano' ? 'outra' : 'fulano';
        ctx.c.setLoginTwitch(0, atual);
        ctx.c.setJogo(0, { ativo: true, twitch: bloco({ login: atual }), offsetMs: 0 });
      }
      ctx.c.tick();
    }
    assert.ok(resgates(ctx).length <= 2, `resgates: ${resgates(ctx).length}`);
  });

  it('expiração sem clique com janela visível do usuário: não recarrega a janela do pendente', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    ctx.c.mostrar(4, true);
    ctx.janelas.log.length = 0;
    passarVagas(ctx, 200000, pag);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'recarregar' && e[1] === 4).length, 0);
  });

  it('a janela do pendente não navega, mesmo com a URL fora do canal', () => {
    const ctx = montarVagas();
    const pag = cenarioB(ctx);
    ctx.janelas.setUrl(4, 'https://www.twitch.tv/zz');
    ctx.janelas.log.length = 0;
    passarVagas(ctx, 20000, pag);
    assert.equal(ctx.janelas.log.filter((e) => e[0] === 'navegar' && e[1] === 4).length, 0);
  });

  it('expiração com clique via texto e posClique: a trava segura o tipo, sem pausa da baía', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.resultado(0, { id: resgates(ctx)[0][2].id, estado: 'clicado', motivo: '', via: 'texto', redeem: { trava: '' }, posClique: POS });
    correr(ctx, 200000, {});
    assert.equal(ctx.registrados.some((r) => r.tipo === 'pausa'), false);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-confirmacao');
    assert.equal(resgates(ctx).length, 1);
  });
});

// ---- Rodada 5: pedido órfão (pendente não clicado solto por troca de login), reconhecido por k e id.
describe('rodada 5: pedido órfão por troca de login', () => {
  it('reprodução: A clica, troca para B antes do resultado; o clique chega depois e A não resgata de novo em 3 h', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    const id1 = resgates(ctx)[0][2].id;
    ctx.c.setLoginTwitch(0, 'outra');
    ctx.c.resultado(0, { id: id1, estado: 'clicado', motivo: '', via: 'dedicado' });
    ctx.c.setLoginTwitch(0, 'fulano');
    correr(ctx, 3 * 3600000 - 60000, {});
    assert.equal(resgates(ctx).length, 1);
  });

  it('órfão vencido não trava: clique que chega depois do prazo não segura A', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    const id1 = resgates(ctx)[0][2].id;
    ctx.c.setLoginTwitch(0, 'outra');
    correr(ctx, 200000, {});
    ctx.c.resultado(0, { id: id1, estado: 'clicado', motivo: '', via: 'dedicado' });
    ctx.c.setLoginTwitch(0, 'fulano');
    correr(ctx, 60000, {});
    assert.equal(resgates(ctx).length, 2);
  });

  it('resultado do órfão não altera o pendente novo do mesmo k', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    const id1 = resgates(ctx)[0][2].id;
    ctx.c.setLoginTwitch(0, 'outra');
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ login: 'outra' }), offsetMs: 0 });
    correr(ctx, 2 * TICK_MS, {});
    assert.equal(resgates(ctx).length, 2);
    const id2 = resgates(ctx)[1][2].id;
    assert.notEqual(id1, id2);
    ctx.c.resultado(0, { id: id1, estado: 'falhou', motivo: 'tempo' });
    ctx.c.resultado(0, { id: id1, estado: 'clicado', motivo: '', via: 'dedicado' });
    assert.equal(ctx.c.snapshot().bays[0].ultimo, null);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'resgatando');
    ctx.c.resultado(0, { id: id2, estado: 'falhou', motivo: 'tempo' });
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'falhou');
  });
});

describe('rodada 6: clique que vira trava na troca de login', () => {
  it('trocar de login depois do clique: ultimo vira sem-confirmacao e o log registra a trava criada, com a conta', () => {
    const ctx = montar();
    abrir(ctx);
    correr(ctx, TICK_MS, {});
    ctx.c.resultado(0, { id: resgates(ctx)[0][2].id, estado: 'clicado', motivo: '', via: 'dedicado' });
    ctx.c.setLoginTwitch(0, 'outra');
    const ultimo = ctx.c.snapshot().bays[0].ultimo;
    assert.equal(ultimo.estado, 'sem-confirmacao');
    assert.equal(ultimo.canal, 'canala');
    const trava = ctx.registrados.find((r) => r.motivo === 'trava-por-troca-de-login');
    assert.ok(trava);
    assert.equal(trava.detalhe.conta, 'fulano');
    assert.equal(trava.tipo, 'xp');
  });
});

// ---- Foco por live (controller). Prefs com foco por baía; helpers próprios.

function montarFoco() {
  const janelas = fakeJanelas();
  const ctx = {
    janelas,
    estado: {
      t: 1000000,
      auto: [true, false, false, false],
      tipos: { xp: true, captura: true, shiny: false },
      streams: [4, 1, 1, 1],
      canais: [[], [], [], []],
      foco: [{}, {}, {}, {}],
    },
    registrados: [],
  };
  ctx.c = createTwitchController({
    janelas,
    prefs: () => ({ tipos: ctx.estado.tipos, auto: ctx.estado.auto, streams: ctx.estado.streams, canais: ctx.estado.canais, foco: ctx.estado.foco }),
    agora: () => ctx.estado.t,
    onChange: () => {},
    registrarErro: (entrada) => { ctx.registrados.push(montarLinha(entrada, () => Date.UTC(2026, 10, 6))); },
  });
  return ctx;
}

describe('foco por live: controller', () => {
  const REC2 = [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }, { tipo: 'captura', titulo: 'Captura', custo: 500 }];
  const preparar2 = (ctx, { streams, canais, oficiais }) => {
    ctx.estado.streams = streams;
    ctx.estado.canais = canais;
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ oficiais, recompensas: REC2 }), offsetMs: 0 });
    ctx.c.setLoginTwitch(0, 'Fulano');
  };

  it('a live focada em Captura paga Captura; a Automática sem saldo para XP não paga', () => {
    const ctx = montarFoco();
    ctx.estado.foco = [{ b: 'captura' }, {}, {}, {}];
    preparar2(ctx, { streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []], oficiais: [OF('a'), OF('b')] });
    passarVagas(ctx, 16 * TICK_MS, { 0: { canal: 'a', saldoTexto: '100' }, 4: { canal: 'b', saldoTexto: '900' } });
    assert.deepEqual(resgatesDe(ctx), [4]);
    assert.equal(resgates(ctx)[0][2].titulo, 'Captura');
  });

  it('foco acompanha o canal de vaga: trocar a ordem das vagas mantém o foco no canal', () => {
    const ctx = montarFoco();
    ctx.estado.foco = [{ b: 'captura' }, {}, {}, {}];
    preparar2(ctx, { streams: [2, 1, 1, 1], canais: [['b', 'a'], [], [], []], oficiais: [OF('a'), OF('b')] });
    passarVagas(ctx, 16 * TICK_MS, { 0: { canal: 'b', saldoTexto: '900' }, 4: { canal: 'a', saldoTexto: '100' } });
    assert.deepEqual(resgatesDe(ctx), [0]);
    assert.equal(resgates(ctx)[0][2].titulo, 'Captura');
  });

  it('canal novo sem chave é Automático: paga XP (ordem padrão), não o tipo que o canal antigo focava', () => {
    const ctx = montarFoco();
    ctx.estado.foco = [{ a: 'captura' }, {}, {}, {}];
    preparar2(ctx, { streams: [1, 1, 1, 1], canais: [['c'], [], [], []], oficiais: [OF('c')] });
    passarVagas(ctx, 8 * TICK_MS, { 0: { canal: 'c', saldoTexto: '900' } });
    assert.deepEqual(resgatesDe(ctx), [0]);
    assert.equal(resgates(ctx)[0][2].titulo, 'Bônus XP');
  });

  it('foco com valor fora de P.TIPOS vira Automático', () => {
    const ctx = montarFoco();
    ctx.estado.foco = [{ a: 'bogus' }, {}, {}, {}];
    preparar2(ctx, { streams: [1, 1, 1, 1], canais: [['a'], [], [], []], oficiais: [OF('a')] });
    passarVagas(ctx, 8 * TICK_MS, { 0: { canal: 'a', saldoTexto: '900' } });
    assert.equal(resgates(ctx)[0][2].titulo, 'Bônus XP');
  });

  it('foco em tipo desligado: a live espera (assistindo) e a Automática com XP segue e paga', () => {
    const ctx = montarFoco();
    ctx.estado.tipos = { xp: true, captura: false, shiny: false };
    ctx.estado.foco = [{ a: 'captura' }, {}, {}, {}];
    preparar2(ctx, { streams: [2, 1, 1, 1], canais: [['a', 'b'], [], [], []], oficiais: [OF('a'), OF('b')] });
    passarVagas(ctx, 16 * TICK_MS, { 0: { canal: 'a', saldoTexto: '900' }, 4: { canal: 'b', saldoTexto: '900' } });
    assert.deepEqual(resgatesDe(ctx), [4]);
    assert.equal(resgates(ctx)[0][2].titulo, 'Bônus XP');
  });

  it('só live focada em tipo desligado: não resgata e a baía fica assistindo', () => {
    const ctx = montarFoco();
    ctx.estado.tipos = { xp: true, captura: false, shiny: false };
    ctx.estado.foco = [{ a: 'captura' }, {}, {}, {}];
    preparar2(ctx, { streams: [1, 1, 1, 1], canais: [['a'], [], [], []], oficiais: [OF('a')] });
    passarVagas(ctx, 16 * TICK_MS, { 0: { canal: 'a', saldoTexto: '900' } });
    assert.equal(resgates(ctx).length, 0);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'assistindo');
  });

  it('mudar foco com pendente mantém id, tipo e canal, e o resultado confirma', () => {
    const ctx = montarFoco();
    preparar2(ctx, { streams: [1, 1, 1, 1], canais: [['a'], [], [], []], oficiais: [OF('a')] });
    const pag = { 0: { canal: 'a', saldoTexto: '900' } };
    passarVagas(ctx, 4 * TICK_MS, pag);
    assert.equal(resgates(ctx).length, 1);
    const antes = resgates(ctx)[0][2];
    assert.equal(antes.titulo, 'Bônus XP');
    ctx.estado.foco = [{ a: 'captura' }, {}, {}, {}];
    passarVagas(ctx, 5 * TICK_MS, pag);
    assert.equal(resgates(ctx).length, 1);
    ctx.c.resultado(0, { id: antes.id, estado: 'clicado', motivo: '' });
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ oficiais: [OF('a')], recompensas: REC2, bonus: { xp: 9999999, captura: 0, shiny: 0 } }), offsetMs: 0 });
    passarVagas(ctx, TICK_MS, pag);
    const ultimo = ctx.c.snapshot().bays[0].ultimo;
    assert.equal(ultimo.estado, 'ok');
    assert.equal(ultimo.tipo, 'xp');
    assert.equal(ultimo.canal, 'a');
  });
});

// ---- Diagnóstico da falha vai para o log (detalhe), não para a tela.
describe('diag no log de resgates (controller)', () => {
  const DIAG = { resumo: true, botaoPontos: false, botoesNoResumo: 1, saldoSeletor: 1, saldoTamanho: 12, saldoLido: true, centroSeletor: 2, botoesResumo: [{ dts: 'a', alvo: 'b', aria: 'c' }] };

  // Uma falha de resgate com a página da live trazendo o diag (ou nenhum), e devolve a última linha registrada.
  function falhaComDiag(diag, resultadoExtra = {}) {
    const ctx = montarFoco();
    ctx.estado.streams = [1, 1, 1, 1];
    ctx.estado.canais = [['a'], [], [], []];
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ oficiais: [OF('a')] }), offsetMs: 0 });
    ctx.c.setLoginTwitch(0, 'Fulano');
    passarVagas(ctx, 4 * TICK_MS, { 0: { canal: 'a', saldoTexto: '900', diag } });
    const id = resgates(ctx)[0][2].id;
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'indisponivel', ...resultadoExtra });
    return ctx.registrados[ctx.registrados.length - 1];
  }

  it('falha com diag na página grava detalhe.diag no log', () => {
    const linha = falhaComDiag(DIAG);
    assert.equal(linha.motivo, 'indisponivel');
    assert.deepEqual(linha.detalhe.diag, DIAG);
  });

  it('sem diag na página, o detalhe não traz a chave diag', () => {
    const linha = falhaComDiag(null);
    assert.equal(Object.hasOwn(linha.detalhe, 'diag'), false);
  });

  it('falha grava pistasAntes e dialogoAntes no detalhe do log', () => {
    const linha = falhaComDiag(null, { motivo: 'sem-centro', pistasAntes: ['div[dialog]'], dialogoAntes: true });
    assert.deepEqual(linha.detalhe.pistasAntes, ['div[dialog]']);
    assert.equal(linha.detalhe.dialogoAntes, true);
  });
});

// ---- Trava global entre baías (controller): uma resgata por vez, intervalo entre baías, travas e órfãos entre baías.

function montarTrava() {
  const janelas = fakeJanelas();
  const ctx = {
    janelas,
    estado: {
      t: 1000000,
      auto: [true, true, true, true],
      tipos: { xp: true, captura: false, shiny: false },
      streams: [1, 1, 1, 1],
      canais: [[], [], [], []],
      foco: [{}, {}, {}, {}],
    },
    registrados: [],
  };
  ctx.c = createTwitchController({
    janelas,
    prefs: () => ({ tipos: ctx.estado.tipos, auto: ctx.estado.auto, streams: ctx.estado.streams, canais: ctx.estado.canais, foco: ctx.estado.foco }),
    agora: () => ctx.estado.t,
    onChange: () => {},
    registrarErro: (entrada) => { ctx.registrados.push(montarLinha(entrada, () => Date.UTC(2026, 10, 6))); },
  });
  return ctx;
}

// Baía i (vaga 0 no canal, k = i), uma conta e o bloco do jogo. Trocar a conta pela mesma função é o caminho real.
function baiaT(ctx, i, { canal, conta = 'fulano', bonus, recompensas }) {
  ctx.estado.canais[i] = [canal];
  const extra = { oficiais: [OF(canal)], login: conta };
  if (bonus) extra.bonus = bonus;
  if (recompensas) extra.recompensas = recompensas;
  ctx.c.setJogo(i, { ativo: true, twitch: bloco(extra), offsetMs: 0 });
  ctx.c.setLoginTwitch(i, conta);
}

// Página saldo 900 em cada canal, por k (slot 0 de cada baía é k = i).
function pagT(canais, saldo = '900') {
  return Object.fromEntries(canais.map((c, i) => [i, { canal: c, saldoTexto: saldo }]));
}

// Avança tick a tick até haver n resgates. Devolve se chegou.
function ateResgates(ctx, n, pags, max = 300) {
  for (let k = 0; k < max && resgatesDe(ctx).length < n; k += 1) passarVagas(ctx, TICK_MS, pags);
  return resgatesDe(ctx).length >= n;
}

const RECT = [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }, { tipo: 'captura', titulo: 'Captura', custo: 500 }];

describe('trava global: uma live por vez entre baías', () => {
  it('duas baías prontas no mesmo tick: uma resgata e a outra espera em outra-live (mesma conta ou contas diferentes)', () => {
    for (const contas of [['fulano', 'fulano'], ['fulano', 'ciclano']]) {
      const ctx = montarTrava();
      baiaT(ctx, 0, { canal: 'a', conta: contas[0] });
      baiaT(ctx, 1, { canal: 'b', conta: contas[1] });
      passarVagas(ctx, 20 * TICK_MS, pagT(['a', 'b']));
      assert.deepEqual(resgatesDe(ctx), [0]);
      assert.equal(ctx.c.snapshot().bays[1].situacao, 'outra-live');
    }
  });

  it('segundo resgate só 20 s depois do fim do primeiro (confirmação e falha)', () => {
    for (const modo of ['confirmacao', 'falha']) {
      const ctx = montarTrava();
      baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
      baiaT(ctx, 1, { canal: 'b', conta: 'ciclano' });
      const pags = pagT(['a', 'b']);
      assert.ok(ateResgates(ctx, 1, pags));
      if (modo === 'confirmacao') {
        baiaT(ctx, 0, { canal: 'a', conta: 'fulano', bonus: { xp: ctx.estado.t + 3600000, captura: 0, shiny: 0 } });
      } else {
        ctx.c.resultado(0, { id: resgates(ctx)[0][2].id, estado: 'falhou', motivo: 'indisponivel' });
      }
      passarVagas(ctx, 10000, pags);
      assert.equal(resgatesDe(ctx).length, 1, modo);
      passarVagas(ctx, 15000, pags);
      assert.deepEqual(resgatesDe(ctx), [0, 1], modo);
    }
  });

  it('pendente preso em A (sem clique): B resgata 180 s + 20 s depois do pendente', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'ciclano' });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    passarVagas(ctx, 179000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    passarVagas(ctx, 31000, pags);
    assert.deepEqual(resgatesDe(ctx), [0, 1]);
  });

  it('recarregar lançando na expiração não prende a baía: o pendente sai e B resgata depois', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'ciclano' });
    const pags = pagT(['a', 'b']);
    ctx.janelas.recarregar = () => { throw new Error('falha de janela'); };
    assert.ok(ateResgates(ctx, 1, pags));
    passarVagas(ctx, 210000, pags);
    assert.deepEqual(resgatesDe(ctx), [0, 1]);
  });

  it('sair solta o pendente: a outra baía espera 20 s', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'ciclano' });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    ctx.c.sair(0);
    passarVagas(ctx, 15000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    passarVagas(ctx, 10000, pags);
    assert.deepEqual(resgatesDe(ctx), [0, 1]);
  });

  it('troca de conta solta o pendente: a outra baía espera 20 s', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'ciclano' });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    ctx.c.setLoginTwitch(0, 'outra');
    passarVagas(ctx, 15000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    passarVagas(ctx, 10000, pags);
    assert.deepEqual(resgatesDe(ctx), [0, 1]);
  });

  it('automático desligado não apaga a trava: a baía da mesma conta segue travada até o prazo de 3 h', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano', recompensas: RECT });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    ctx.c.resultado(0, { id: resgates(ctx)[0][2].id, estado: 'clicado', motivo: '' });
    passarVagas(ctx, 185000, pags);
    ctx.estado.auto[0] = false;
    baiaT(ctx, 1, { canal: 'b', conta: 'fulano', recompensas: RECT });
    passarVagas(ctx, 60000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    assert.equal(ctx.c.snapshot().bays[1].situacao, 'sem-confirmacao');
    passarVagas(ctx, 3 * 3600000, pags);
    assert.equal(resgatesDe(ctx).length, 2);
  });

  it('trava de A bloqueia o tipo em B e o outro tipo segue; bônus subir em B solta e atualiza o ultimo de A', () => {
    const ctx = montarTrava();
    ctx.estado.tipos = { xp: true, captura: true, shiny: false };
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano', recompensas: RECT });
    baiaT(ctx, 1, { canal: 'b', conta: 'fulano', recompensas: RECT });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    assert.equal(resgates(ctx)[0][2].titulo, 'Bônus XP');
    ctx.c.resultado(0, { id: resgates(ctx)[0][2].id, estado: 'clicado', motivo: '' });
    passarVagas(ctx, 185000, pags);
    passarVagas(ctx, 25000, pags);
    assert.deepEqual(resgatesDe(ctx), [0, 1]);
    assert.equal(resgates(ctx)[1][2].titulo, 'Captura');
    baiaT(ctx, 1, { canal: 'b', conta: 'fulano', recompensas: RECT, bonus: { xp: ctx.estado.t + 3600000, captura: 0, shiny: 0 } });
    passarVagas(ctx, 2 * TICK_MS, pags);
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'ok');
    assert.equal(ctx.c.snapshot().bays[0].ultimo.tipo, 'xp');
  });

  it('confirmação com bloco velho em outra baía não solta a trava: 0 resgates na outra baía', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'fulano' });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    ctx.c.resultado(0, { id: resgates(ctx)[0][2].id, estado: 'clicado', motivo: '' });
    passarVagas(ctx, 185000, pags);
    passarVagas(ctx, 60000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    assert.equal(ctx.c.snapshot().bays[1].situacao, 'sem-confirmacao');
    assert.equal(ctx.c.snapshot().bays[0].ultimo.estado, 'sem-confirmacao');
  });

  it('órfão bloqueia conta e tipo em outra baía, não outra conta', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'fulano' });
    baiaT(ctx, 2, { canal: 'c', conta: 'ciclano' });
    const pags = pagT(['a', 'b', 'c']);
    assert.ok(ateResgates(ctx, 1, pags));
    ctx.c.setLoginTwitch(0, 'novo');
    passarVagas(ctx, 25000, pags);
    assert.ok(resgatesDe(ctx).includes(2));
    assert.equal(resgatesDe(ctx).includes(1), false);
  });

  it('órfão libera depois do prazo (ate) e 20 s de intervalo', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'fulano' });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    ctx.c.setLoginTwitch(0, 'novo');
    passarVagas(ctx, 170000, pags);
    assert.equal(resgatesDe(ctx).includes(1), false);
    passarVagas(ctx, 15000, pags);
    assert.ok(resgatesDe(ctx).includes(1));
  });

  it('A→B→A sem clique: sem resgate na conta até o órfão vencer', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    const pags = pagT(['a']);
    assert.ok(ateResgates(ctx, 1, pags));
    ctx.c.setLoginTwitch(0, 'novo');
    ctx.c.setLoginTwitch(0, 'fulano');
    passarVagas(ctx, 170000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    passarVagas(ctx, 30000, pags);
    assert.equal(resgatesDe(ctx).length, 2);
  });

  it('sem fome: baías 0 e 1 prontas se alternam nos resgates', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'ciclano' });
    const pags = pagT(['a', 'b']);
    // Cada resgate é confirmado logo (bônus sobe para um prazo já vencido): sem falha nem backoff, a baía segue elegível.
    // Só a vez decide quem vai primeiro quando as duas estão prontas.
    for (let n = 0; n < 3; n += 1) {
      assert.ok(ateResgates(ctx, n + 1, pags, 200), 'resgate ' + (n + 1));
      const k = resgatesDe(ctx)[n];
      baiaT(ctx, k, { canal: k === 0 ? 'a' : 'b', conta: k === 0 ? 'fulano' : 'ciclano', bonus: { xp: n + 1, captura: 0, shiny: 0 } });
      passarVagas(ctx, 2 * TICK_MS, pags);
    }
    assert.deepEqual(resgatesDe(ctx).slice(0, 3), [0, 1, 0]);
  });
  it('outra-live não mexe no log nem na situação própria: juntando e pausado seguem', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'ciclano' });
    baiaT(ctx, 2, { canal: 'c', conta: 'terceiro' });
    const pags = { 0: { canal: 'a', saldoTexto: '900' }, 1: { canal: 'b', saldoTexto: '900' }, 2: { canal: 'c', saldoTexto: '100' } };
    assert.ok(ateResgates(ctx, 1, pags));
    const antes = ctx.registrados.length;
    passarVagas(ctx, 10000, pags);
    assert.equal(ctx.c.snapshot().bays[1].situacao, 'outra-live');
    assert.equal(ctx.c.snapshot().bays[2].situacao, 'juntando');
    assert.equal(ctx.registrados.length, antes);
  });

  it('pausado segue pausado mesmo com outra baía resgatando', () => {
    const ctx = montarTrava();
    ctx.estado.auto = [false, false, true, false];
    baiaT(ctx, 2, { canal: 'c', conta: 'terceiro' });
    const pags2 = { 2: { canal: 'c', saldoTexto: '900' } };
    for (let n = 0; n < 3; n += 1) {
      assert.ok(ateResgates(ctx, n + 1, pags2));
      ctx.c.resultado(2, { id: resgates(ctx)[n][2].id, estado: 'falhou', motivo: 'indisponivel' });
      passarVagas(ctx, 25000, pags2);
    }
    assert.equal(ctx.c.snapshot().bays[2].situacao, 'pausado');
    ctx.estado.auto[0] = true;
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    const pags = { 0: { canal: 'a', saldoTexto: '900' }, 2: { canal: 'c', saldoTexto: '900' } };
    passarVagas(ctx, 25000, pags);
    assert.equal(ctx.c.snapshot().bays[2].situacao, 'pausado');
  });

  it('bônus da conta: a baía B vê o prazo maior de A (mesma conta) e não paga o tipo já resgatado', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'fulano' });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano', bonus: { xp: ctx.estado.t + 3600000, captura: 0, shiny: 0 } });
    passarVagas(ctx, 60000, pags);
    assert.deepEqual(resgatesDe(ctx), [0]);
  });
});

describe('diag no log: falha depois do clique e sem confirmação', () => {
  const DIAG = { resumo: true, botaoPontos: false, botoesNoResumo: 1, saldoSeletor: 1, saldoTamanho: 12, saldoLido: true, centroSeletor: 2, botoesResumo: [{ dts: 'a', alvo: 'b', aria: 'c' }] };

  function comPendente() {
    const ctx = montarFoco();
    ctx.estado.streams = [1, 1, 1, 1];
    ctx.estado.canais = [['a'], [], [], []];
    ctx.c.setJogo(0, { ativo: true, twitch: bloco({ oficiais: [OF('a')] }), offsetMs: 0 });
    ctx.c.setLoginTwitch(0, 'Fulano');
    const pags = { 0: { canal: 'a', saldoTexto: '900', diag: DIAG } };
    passarVagas(ctx, 4 * TICK_MS, pags);
    return { ctx, pags, id: resgates(ctx)[0][2].id };
  }

  it('falha depois do clique grava detalhe.diag no log', () => {
    const { ctx, id } = comPendente();
    ctx.c.resultado(0, { id, estado: 'clicado', motivo: '' });
    ctx.c.resultado(0, { id, estado: 'falhou', motivo: 'indisponivel' });
    const linha = ctx.registrados[ctx.registrados.length - 1];
    assert.equal(linha.motivo, 'falha-depois-do-clique');
    assert.deepEqual(linha.detalhe.diag, DIAG);
  });

  it('sem confirmação (clicou e expirou) grava detalhe.diag no log', () => {
    const { ctx, pags, id } = comPendente();
    ctx.c.resultado(0, { id, estado: 'clicado', motivo: '' });
    passarVagas(ctx, 185000, pags);
    const linha = ctx.registrados.find((l) => l.motivo === 'sem-confirmacao');
    assert.ok(linha, 'linha sem-confirmacao');
    assert.deepEqual(linha.detalhe.diag, DIAG);
  });
});

describe('sair: pendente vira órfão ou trava, e a vez persiste', () => {
  // Uma baía só, com um pendente de XP criado (k = 0).
  function comPendente() {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    const pags = pagT(['a']);
    assert.ok(ateResgates(ctx, 1, pags));
    return { ctx, pags, id: resgates(ctx)[0][2].id };
  }

  it('sair sem clique vira órfão: o clicado que chega depois grava a trava e a conta não repete o tipo', () => {
    const { ctx, pags, id } = comPendente();
    ctx.c.sair(0);
    ctx.c.resultado(0, { id, estado: 'clicado', motivo: '' });
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    passarVagas(ctx, 60000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    assert.equal(ctx.c.snapshot().bays[0].situacao, 'sem-confirmacao');
  });

  it('sair com clicado grava a trava (baia, canal, k) e ela vale ao voltar a conta até o bônus subir', () => {
    const { ctx, pags, id } = comPendente();
    ctx.c.resultado(0, { id, estado: 'clicado', motivo: '' });
    ctx.c.sair(0);
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    passarVagas(ctx, 60000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano', bonus: { xp: ctx.estado.t + 3600000, captura: 0, shiny: 0 } });
    passarVagas(ctx, 2 * TICK_MS, pags);
    const linha = ctx.registrados.find((l) => l.motivo === 'confirmado-tardio');
    assert.ok(linha, 'confirmação tardia');
    assert.equal(linha.baia, 0);
    assert.equal(linha.canal, 'a');
    assert.equal(linha.stream, 0);
  });

  it('sair com clicado: a trava vale ao voltar a conta até o prazo de 3 h', () => {
    const { ctx, pags, id } = comPendente();
    ctx.c.resultado(0, { id, estado: 'clicado', motivo: '' });
    ctx.c.sair(0);
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    passarVagas(ctx, 3 * 3600000 - 60000, pags);
    assert.equal(resgatesDe(ctx).length, 1);
    passarVagas(ctx, 120000, pags);
    assert.equal(resgatesDe(ctx).length, 2);
  });

  it('a vez persiste entre ticks sem resgate: a baía seguinte ainda vai primeiro quando as duas ficam prontas', () => {
    const ctx = montarTrava();
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano' });
    baiaT(ctx, 1, { canal: 'b', conta: 'ciclano' });
    const pags = pagT(['a', 'b']);
    assert.ok(ateResgates(ctx, 1, pags));
    // Confirma a baía 0 e deixa o bônus vencido: ela volta a ficar elegível, e só a vez decide.
    baiaT(ctx, 0, { canal: 'a', conta: 'fulano', bonus: { xp: 1, captura: 0, shiny: 0 } });
    passarVagas(ctx, 30000, pags);
    assert.deepEqual(resgatesDe(ctx), [0, 1]);
  });
});
