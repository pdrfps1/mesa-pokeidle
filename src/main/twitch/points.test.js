'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const P = require('./points');

describe('parsePontos', () => {
  it('lê números exatos com separadores', () => {
    assert.deepEqual(P.parsePontos('0'), { valor: 0, minimo: 0, exato: true });
    assert.deepEqual(P.parsePontos('15'), { valor: 15, minimo: 15, exato: true });
    assert.deepEqual(P.parsePontos('999'), { valor: 999, minimo: 999, exato: true });
    assert.equal(P.parsePontos('1.234').valor, 1234);
    assert.equal(P.parsePontos('1,234').valor, 1234);
    assert.equal(P.parsePontos('12 345').valor, 12345);
    assert.equal(P.parsePontos('12 345').valor, 12345);
  });

  it('abreviado vale pelo limite inferior', () => {
    assert.deepEqual(P.parsePontos('1,2 mil'), { valor: 1200, minimo: 1150, exato: false });
    assert.deepEqual(P.parsePontos('1.2K'), { valor: 1200, minimo: 1150, exato: false });
    assert.deepEqual(P.parsePontos('1.2k'), { valor: 1200, minimo: 1150, exato: false });
    assert.deepEqual(P.parsePontos('15 mil'), { valor: 15000, minimo: 14500, exato: false });
    assert.equal(P.parsePontos('15K').minimo, 14500);
    assert.equal(P.parsePontos('1 mil').minimo, 950);
    assert.deepEqual(P.parsePontos('1,2 mi'), { valor: 1200000, minimo: 1150000, exato: false });
    assert.equal(P.parsePontos('1.2M').minimo, 1150000);
  });

  it('o ilegível vira null', () => {
    for (const texto of [null, '', 'abc', '1,23', '1.2', '-5', '12 pontos']) {
      assert.equal(P.parsePontos(texto), null, `esperava null para ${JSON.stringify(texto)}`);
    }
  });
});

describe('mesmoLogin', () => {
  it('ignora caixa e espaços nas bordas', () => {
    assert.equal(P.mesmoLogin('Fulano', 'fulano'), true);
    assert.equal(P.mesmoLogin(' fulano ', 'FULANO'), true);
  });

  it('recusa vazio, inválido, nulo e contas diferentes', () => {
    assert.equal(P.mesmoLogin('', ''), false);
    assert.equal(P.mesmoLogin('a-b', 'a-b'), false);
    assert.equal(P.mesmoLogin(null, 'fulano'), false);
    assert.equal(P.mesmoLogin('fulano', 'beltrano'), false);
  });
});

describe('canalElegivel e escolherCanal', () => {
  const canal = (login, extra = {}) => ({ login, nome: login, aoVivo: true, ativo: true, espectadores: 0, ...extra });

  it('mantém o canal atual enquanto ele for elegível', () => {
    const lista = [canal('alfa', { espectadores: 900 }), canal('beta', { espectadores: 10 })];
    assert.equal(P.escolherCanal(lista, 'beta'), 'beta');
  });

  it('troca quando o atual cai', () => {
    const lista = [canal('alfa', { espectadores: 900 }), canal('beta', { aoVivo: false })];
    assert.equal(P.escolherCanal(lista, 'beta'), 'alfa');
    const semAtivo = [canal('alfa', { espectadores: 900 }), canal('beta', { ativo: false })];
    assert.equal(P.escolherCanal(semAtivo, 'beta'), 'alfa');
  });

  it('ativo ausente não entra', () => {
    const lista = [{ login: 'alfa', aoVivo: true, espectadores: 5 }];
    assert.equal(P.escolherCanal(lista, ''), '');
  });

  it('escolhe o de mais espectadores; empate vai pelo login; ausente conta zero', () => {
    assert.equal(P.escolherCanal([canal('alfa', { espectadores: 5 }), canal('beta', { espectadores: 50 })], ''), 'beta');
    assert.equal(P.escolherCanal([canal('zeta', { espectadores: 5 }), canal('alfa', { espectadores: 5 })], ''), 'alfa');
    assert.equal(P.escolherCanal([{ login: 'zeta', aoVivo: true, ativo: true }, canal('alfa', { espectadores: 1 })], ''), 'alfa');
  });

  it('lista vazia ou não lista dá vazio; caixa do atual não importa', () => {
    assert.equal(P.escolherCanal([], 'alfa'), '');
    assert.equal(P.escolherCanal(null, 'alfa'), '');
    assert.equal(P.escolherCanal([canal('alfa')], 'ALFA'), 'alfa');
  });
});

describe('canalDaUrl', () => {
  it('lê o canal do caminho em https da Twitch', () => {
    assert.equal(P.canalDaUrl('https://www.twitch.tv/Fulano'), 'fulano');
    assert.equal(P.canalDaUrl('https://twitch.tv/Fulano/videos'), 'fulano');
  });

  it('/login devolve login, que não bate com canal', () => {
    assert.equal(P.canalDaUrl('https://www.twitch.tv/login'), 'login');
  });

  it('recusa outro protocolo, outro host e URL inválida', () => {
    assert.equal(P.canalDaUrl('http://www.twitch.tv/fulano'), '');
    assert.equal(P.canalDaUrl('https://example.com/fulano'), '');
    assert.equal(P.canalDaUrl('não é url'), '');
  });
});

describe('restanteMs', () => {
  it('ausente ou passado dá zero; futuro dá a diferença', () => {
    assert.equal(P.restanteMs(undefined, 1000), 0);
    assert.equal(P.restanteMs(500, 1000), 0);
    assert.equal(P.restanteMs(1500, 1000), 500);
  });
});

describe('travaSeguranca', () => {
  it('confere os motivos na ordem', () => {
    assert.deepEqual(P.travaSeguranca({ vinculado: false, loginJogo: 'a', loginTwitch: 'a' }), { ok: false, motivo: 'nao-vinculado' });
    assert.deepEqual(P.travaSeguranca({ vinculado: true, loginJogo: '', loginTwitch: 'a' }), { ok: false, motivo: 'sem-login-jogo' });
    assert.deepEqual(P.travaSeguranca({ vinculado: true, loginJogo: 'a', loginTwitch: '' }), { ok: false, motivo: 'sem-login' });
    assert.deepEqual(P.travaSeguranca({ vinculado: true, loginJogo: 'a', loginTwitch: 'b' }), { ok: false, motivo: 'conta-diferente' });
    assert.deepEqual(P.travaSeguranca({ vinculado: true, loginJogo: 'a', loginTwitch: 'a' }), { ok: true });
  });

  it('vinculado ausente dá nao-vinculado; caixa diferente passa', () => {
    assert.equal(P.travaSeguranca({ loginJogo: 'a', loginTwitch: 'a' }).motivo, 'nao-vinculado');
    assert.deepEqual(P.travaSeguranca({ vinculado: true, loginJogo: 'Fulano', loginTwitch: 'fulano' }), { ok: true });
  });
});

describe('escolherResgate', () => {
  const agoraServidor = 1000000;
  const base = (extra = {}) => ({
    tipos: ['xp'],
    leituraOk: true,
    bonus: { xp: 0, captura: 0, shiny: 0 },
    agoraServidor,
    saldo: P.parsePontos('450'),
    recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }],
    falhas: {},
    agora: agoraServidor,
    ...extra,
  });

  it('sem tipos não escolhe nada', () => {
    assert.deepEqual(P.escolherResgate(base({ tipos: [] })), { espera: 'sem-tipos' });
  });

  it('1 s restante não resgata; prazo exatamente agora resgata; prazo no passado resgata', () => {
    assert.deepEqual(P.escolherResgate(base({ bonus: { xp: agoraServidor + 1000 } })), { espera: 'em-dia' });
    assert.equal(P.escolherResgate(base({ bonus: { xp: agoraServidor } })).tipo, 'xp');
    assert.equal(P.escolherResgate(base({ bonus: { xp: agoraServidor - 60000 } })).tipo, 'xp');
  });

  it('zerado resgata (o jogo mandou zero e o prazo já passou)', () => {
    assert.deepEqual(P.escolherResgate(base()), { tipo: 'xp', titulo: 'Bônus XP', custo: 300 });
  });

  it('sem leitura válida do bônus ou do relógio dá sem-leitura, mesmo com bônus zero', () => {
    assert.deepEqual(P.escolherResgate(base({ leituraOk: false })), { espera: 'sem-leitura' });
    const semFlag = base();
    delete semFlag.leituraOk;
    assert.deepEqual(P.escolherResgate(semFlag), { espera: 'sem-leitura' });
  });

  it('agoraServidor NaN não resgata', () => {
    assert.deepEqual(P.escolherResgate(base({ agoraServidor: NaN, agora: NaN })), { espera: 'em-dia' });
  });

  it('bonus vazio não devolve tipo: chave ausente não é prazo passado', () => {
    assert.deepEqual(P.escolherResgate(base({ bonus: {} })), { espera: 'em-dia' });
  });

  it('limiarMin passado junto não muda nada: com 1 min restante não resgata', () => {
    assert.deepEqual(P.escolherResgate(base({ limiarMin: 15, bonus: { xp: agoraServidor + 60000 } })), { espera: 'em-dia' });
  });

  it('sem saldo lido, saldo insuficiente e saldo abreviado', () => {
    assert.deepEqual(P.escolherResgate(base({ saldo: null })), { espera: 'sem-saldo-lido' });
    assert.deepEqual(P.escolherResgate(base({ saldo: P.parsePontos('250') })), { espera: 'saldo' });
    const recompensa = [{ tipo: 'xp', titulo: 'Bônus XP', custo: 1000 }];
    assert.equal(P.escolherResgate(base({ recompensas: recompensa, saldo: P.parsePontos('1,2 mil') })).tipo, 'xp');
    assert.deepEqual(P.escolherResgate(base({ recompensas: recompensa, saldo: P.parsePontos('1 mil') })), { espera: 'saldo' });
  });

  it('recompensa ausente ou com custo zero não resgata', () => {
    assert.deepEqual(P.escolherResgate(base({ recompensas: [] })), { espera: 'sem-recompensa' });
    assert.deepEqual(P.escolherResgate(base({ recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 0 }] })), { espera: 'sem-recompensa' });
  });

  it('tipo pausado não resgata', () => {
    const falhas = { xp: { n: 1, ate: agoraServidor + 1000 } };
    assert.deepEqual(P.escolherResgate(base({ falhas })), { espera: 'pausado' });
  });

  it('dois tipos acabados empatam: vale a ordem de tipos (xp antes de captura)', () => {
    const recompensas = [
      { tipo: 'xp', titulo: 'XP', custo: 300 },
      { tipo: 'captura', titulo: 'Captura', custo: 300 },
    ];
    assert.equal(P.escolherResgate(base({ tipos: ['xp', 'captura'], recompensas })).tipo, 'xp');
  });

  it('o primeiro sem saldo cede ao segundo que tem saldo (xp custo 500, captura custo 300, saldo 450)', () => {
    const recompensas = [
      { tipo: 'xp', titulo: 'XP', custo: 500 },
      { tipo: 'captura', titulo: 'Captura', custo: 300 },
    ];
    assert.equal(P.escolherResgate(base({ tipos: ['xp', 'captura'], recompensas })).tipo, 'captura');
  });
});

describe('estadoPendente', () => {
  const pendente = { tipo: 'xp', bonusAntes: 100, em: 1000 };

  it('confirma quando o bônus avança', () => {
    assert.equal(P.estadoPendente(pendente, { xp: 200 }, 1500), 'confirmado');
  });

  it('aguarda antes do prazo, e expira em 180 s', () => {
    assert.equal(P.estadoPendente(pendente, { xp: 100 }, 1000 + 179999), 'aguardando');
    assert.equal(P.estadoPendente(pendente, { xp: 100 }, 1000 + 180000), 'expirado');
  });

  it('bônus nulo conta como sem confirmação', () => {
    assert.equal(P.estadoPendente(pendente, null, 2000), 'aguardando');
    assert.equal(P.estadoPendente(pendente, null, 1000 + 180000), 'expirado');
  });

  it('bônus menor que o de antes não confirma', () => {
    assert.equal(P.estadoPendente(pendente, { xp: 50 }, 2000), 'aguardando');
  });
});

describe('registrarFalha e registrarSucesso', () => {
  it('a espera cresce a cada falha e pausa na terceira', () => {
    let falhas = {};
    const esperas = [];
    for (let n = 0; n < 4; n += 1) {
      falhas = P.registrarFalha(falhas, 'xp', 0);
      esperas.push(falhas.xp.ate);
    }
    assert.deepEqual(esperas, [120000, 300000, 3600000, 3600000]);
    assert.equal(falhas.xp.n, 4);
  });

  it('não muda a entrada recebida', () => {
    const antes = {};
    P.registrarFalha(antes, 'xp', 0);
    assert.deepEqual(antes, {});
    const com = { xp: { n: 1, ate: 5 } };
    P.registrarSucesso(com, 'xp');
    assert.deepEqual(com, { xp: { n: 1, ate: 5 } });
  });

  it('sucesso limpa o tipo', () => {
    const limpo = P.registrarSucesso({ xp: { n: 2, ate: 9 }, captura: { n: 1, ate: 3 } }, 'xp');
    assert.deepEqual(limpo, { captura: { n: 1, ate: 3 } });
  });
});

describe('avaliarGanho', () => {
  it('sem rodar devolve null', () => {
    assert.deepEqual(P.avaliarGanho(null, { rodando: false, saldoMinimo: 10, bauEm: 0 }, 1000), { estado: null, semGanho: false });
  });

  it('cria a base na primeira leitura de vídeo rodando', () => {
    const g = P.avaliarGanho(null, { rodando: true, saldoMinimo: 100, bauEm: 0 }, 1000);
    assert.deepEqual(g.estado, { desde: 1000, saldo: 100, bauEm: 0 });
  });

  it('saldo que sobe refaz a base; baú também', () => {
    const e1 = P.avaliarGanho(null, { rodando: true, saldoMinimo: 100, bauEm: 0 }, 1000).estado;
    const subiu = P.avaliarGanho(e1, { rodando: true, saldoMinimo: 150, bauEm: 0 }, 5000);
    assert.equal(subiu.estado.desde, 5000);
    const bau = P.avaliarGanho(e1, { rodando: true, saldoMinimo: 100, bauEm: 3000 }, 6000);
    assert.equal(bau.estado.desde, 6000);
  });

  it('o limite é de 25 min, exato', () => {
    const e = P.avaliarGanho(null, { rodando: true, saldoMinimo: 100, bauEm: 0 }, 0).estado;
    assert.equal(P.avaliarGanho(e, { rodando: true, saldoMinimo: 100, bauEm: 0 }, 1500000 - 1).semGanho, false);
    assert.equal(P.avaliarGanho(e, { rodando: true, saldoMinimo: 100, bauEm: 0 }, 1500000).semGanho, true);
  });

  it('base sem saldo é preenchida na primeira leitura', () => {
    const e = { desde: 0, saldo: null, bauEm: 0 };
    const g = P.avaliarGanho(e, { rodando: true, saldoMinimo: 80, bauEm: 0 }, 1000);
    assert.equal(g.estado.saldo, 80);
    assert.equal(g.estado.desde, 0);
  });
});

describe('limparFatos e limparResultado', () => {
  it('tipos errados viram false ou vazio, e o canal inválido some', () => {
    const f = P.limparFatos({ canal: '../x', logado: 'sim', deslogado: 1, portao: true });
    assert.equal(f.canal, '');
    assert.equal(f.logado, false);
    assert.equal(f.deslogado, false);
    assert.equal(f.portao, true);
  });

  it('canal válido vem em minúsculas e o saldo é cortado em 24 caracteres', () => {
    const f = P.limparFatos({ canal: 'FULANO', saldoTexto: 'x'.repeat(40) });
    assert.equal(f.canal, 'fulano');
    assert.equal(f.saldoTexto.length, 24);
  });

  it('caracteres de controle saem do saldo', () => {
    assert.equal(P.limparFatos({ saldoTexto: '\u0007 abc  ' }).saldoTexto, 'abc');
  });

  it('diag: só as chaves fixas, número ou booleano; string e chave estranha somem', () => {
    const f = P.limparFatos({
      diag: { resumo: 'sim', botaoPontos: true, botoesNoResumo: 3, saldoSeletor: '0', saldoTamanho: 12, saldoLido: false, centroSeletor: -1, extra: 'segredo', texto: 'Saldo 1.234' },
    });
    assert.deepEqual(f.diag, { resumo: false, botaoPontos: true, botoesNoResumo: 3, saldoSeletor: -1, saldoTamanho: 12, saldoLido: false, centroSeletor: -1, botoesResumo: [] });
    assert.equal(Object.values(f.diag).some((v) => typeof v === 'string'), false);
  });

  it('diag ausente ou que não é objeto dá null', () => {
    assert.equal(P.limparFatos({}).diag, null);
    assert.equal(P.limparFatos({ diag: 'texto' }).diag, null);
  });

  it('fatos que não são objeto dão null', () => {
    assert.equal(P.limparFatos(null), null);
    assert.equal(P.limparFatos('x'), null);
  });

  it('resultado: id e estado precisam ser válidos; motivo desconhecido vira outro', () => {
    // trava: '' entrou no resultado de falha (campo novo); cardClicado: null também (campo novo); o resto do formato não muda.
    const base = { trava: '', vistos: [], fase: '', clicou: false, pistas: [], pistasAntes: null, dialogoAntes: false, dialogos: [], botoesCentro: [], totalBotoesCentro: 0, cabecalho: null, classes: [], cardClicado: null, percurso: null };
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'coisa' }), { id: 5, estado: 'falhou', motivo: 'outro', ...base });
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'indisponivel' }), { id: 5, estado: 'falhou', motivo: 'indisponivel', ...base });
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'clicado', motivo: 'x' }), { id: 5, estado: 'clicado', motivo: '' });
    assert.equal(P.limparResultado({ id: '5', estado: 'clicado' }), null);
    assert.equal(P.limparResultado({ id: 0, estado: 'clicado' }), null);
    assert.equal(P.limparResultado({ id: 5, estado: 'desconhecido' }), null);
  });

  it('trava: valor da lista fechada passa; valor fora da lista vira vazio', () => {
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', trava: 'fora-do-centro' }).trava, 'fora-do-centro');
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', trava: 'custo' }).trava, 'custo');
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', trava: 'texto livre da página' }).trava, '');
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', trava: 7 }).trava, '');
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao' }).trava, '');
    assert.ok(P.TRAVAS_PAGINA.includes('sem-dedicado'));
  });

  it('motivos novos do centro passam como estão', () => {
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro' }).motivo, 'sem-centro');
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'recompensa-ambigua' }).motivo, 'recompensa-ambigua');
  });

  it('botoesResumo: sanitizado, até 4, não-string vira vazio, dígito vira #', () => {
    const botoes = [
      { dts: 'pts-7\u0001', alvo: 42, aria: 'Abrir 12' },
      null,
      { dts: 'a', alvo: 'b', aria: 'c' },
      { dts: 'd', alvo: 'e', aria: 'f' },
      { dts: 'extra', alvo: 'x', aria: 'y' },
    ];
    const diag = P.limparFatos({ diag: { botoesResumo: botoes } }).diag;
    assert.equal(diag.botoesResumo.length, 4);
    assert.deepEqual(diag.botoesResumo[0], { dts: 'pts-#', alvo: '', aria: 'Abrir ##' });
    assert.deepEqual(diag.botoesResumo[1], { dts: '', alvo: '', aria: '' });
    assert.deepEqual(P.limparFatos({ diag: { botoesResumo: 'nao' } }).diag.botoesResumo, []);
  });

  it('botoesResumo: corta em 40 caracteres e descarta chaves estranhas', () => {
    const diag = P.limparFatos({ diag: { botoesResumo: [{ dts: 'x'.repeat(60), alvo: 'a', aria: 'b', texto: 'segredo' }] } }).diag;
    assert.equal(diag.botoesResumo[0].dts.length, 40);
    assert.deepEqual(Object.keys(diag.botoesResumo[0]).sort(), ['alvo', 'aria', 'dts']);
    assert.equal(JSON.stringify(diag).includes('segredo'), false);
  });

  it('fase: só abrir, buscar ou confirmar; clicou só com true; pistas limpas e até 8', () => {
    const lixo = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', fase: 'outra', clicou: 'sim', pistas: 'nao' });
    assert.equal(lixo.fase, '');
    assert.equal(lixo.clicou, false);
    assert.deepEqual(lixo.pistas, []);
    for (const fase of ['abrir', 'buscar', 'confirmar']) {
      assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', fase, clicou: true }).fase, fase);
    }
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', fase: 'abrir', clicou: true }).clicou, true);
    const pistas = P.limparResultado({
      id: 5,
      estado: 'falhou',
      motivo: 'sem-centro',
      pistas: ['div#a\u0007b[dialog]', 'div#a\u0007b[dialog]', 42, 'x'.repeat(60), ...Array.from({ length: 9 }, (_, i) => `span${'abcdefghi'[i]}`)],
    }).pistas;
    assert.equal(pistas[0], 'div#ab[dialog]');
    assert.equal(pistas[1], 'x'.repeat(40));
    assert.equal(pistas.length, 8);
    assert.equal(pistas.some((p) => /\d/.test(p)), false);
  });

  it('dialogoAntes só vale com true estrito', () => {
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', dialogoAntes: true }).dialogoAntes, true);
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', dialogoAntes: 'sim' }).dialogoAntes, false);
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro' }).dialogoAntes, false);
  });

  it('dialogos: 2 diálogos, 6 itens, 8 dts; dígito vira #, controle sai, corte em 40; contagens e booleanos limpos', () => {
    const itens = Array.from({ length: 9 }, (_, i) => ({
      dts: `dts-${i}\u0001`,
      alvo: 'a'.repeat(60),
      aria: 'Abrir 12',
      tab: i % 2 === 0,
    }));
    const dts = Array.from({ length: 12 }, (_, i) => `d${'abcdefghijkl'[i]}\u0007`);
    const raw = [
      { botoes: 3.7, abas: -2, itens, dts, titulo: 'sim', campoTexto: true },
      { botoes: Infinity, abas: NaN, itens: 'nao', dts: 'nao', titulo: true, campoTexto: 1 },
      { botoes: 1 },
    ];
    const r = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', dialogos: raw }).dialogos;
    assert.equal(r.length, 2);
    assert.equal(r[0].botoes, 3);
    assert.equal(r[0].abas, 0);
    assert.equal(r[0].itens.length, 6);
    assert.deepEqual(r[0].itens[0], { dts: 'dts-#', alvo: 'a'.repeat(40), aria: 'Abrir ##', tab: true });
    assert.equal(r[0].itens[1].tab, false);
    assert.equal(r[0].dts.length, 8);
    assert.equal(r[0].dts[0], 'da');
    assert.equal(r[0].titulo, false);
    assert.equal(r[0].campoTexto, true);
    assert.deepEqual(r[1], { botoes: 0, abas: 0, itens: [], dts: [], titulo: true, campoTexto: false, antes: null });
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', dialogos: 'nao' }).dialogos, []);
  });

  it('dialogos: antes é true ou false só com booleano; qualquer outra coisa, ou ausência, vira null', () => {
    const r = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', dialogos: [{ antes: true }, { antes: 'sim' }] }).dialogos;
    assert.deepEqual(r.map((d) => d.antes), [true, null]);
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', dialogos: [{}] }).dialogos[0].antes, null);
  });

  it('resultado antigo: dialogoAntes true e dialogos sem antes, o antes por diálogo sai null', () => {
    const r = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', dialogoAntes: true, dialogos: [{ botoes: 1 }] });
    assert.equal(r.dialogoAntes, true);
    assert.equal(r.dialogos[0].antes, null);
  });

  it('pistasAntes ausente ou que não é lista: null', () => {
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro' }).pistasAntes, null);
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', pistasAntes: 'nao' }).pistasAntes, null);
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', pistasAntes: [] }).pistasAntes, []);
  });

  it('pistasAntes e classes: sem texto de página, dígito vira #, controle sai, teto de 8', () => {
    const pistasAntes = ['div#reward-a[dialog]', 'div#reward-a[dialog]', 'span\u0001x', 42, ...Array.from({ length: 9 }, (_, i) => `p${'abcdefghi'[i]}`)];
    const classes = ['rc:div.col-1', ...Array.from({ length: 11 }, (_, i) => `rc:div.k${'abcdefghijk'[i]}`)];
    const r = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', pistasAntes, classes });
    assert.equal(r.pistasAntes.length, 8);
    assert.equal(r.pistasAntes[0], 'div#reward-a[dialog]');
    assert.equal(r.pistasAntes[1], 'spanx');
    assert.equal(r.classes.length, 8);
    assert.equal(r.classes[0], 'rc:div.col-#');
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', pistasAntes: 'nao', classes: 'nao' }).classes, []);
  });

  it('cabecalho ausente ou que não é objeto: null; objeto com lixo: achado false e cadeia vazia', () => {
    const vazio = { achado: false, cadeia: [] };
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro' }).cabecalho, null);
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', cabecalho: 'x' }).cabecalho, null);
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', cabecalho: { achado: 'sim', cadeia: 'x' } }).cabecalho, vazio);
  });

  it('botoesCentro: até 24, texto curto, booleanos estritos; total finito com teto 999', () => {
    const botoes = Array.from({ length: 25 }, (_, i) => ({ dts: 'A\u0007' + i, alvo: 'x'.repeat(60), aria: 'ok', tab: 'sim', custo: true, desab: 1 }));
    const r = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', botoesCentro: botoes, totalBotoesCentro: 5000 });
    assert.equal(r.botoesCentro.length, 24);
    assert.deepEqual(r.botoesCentro[0], { dts: 'A#', alvo: 'x'.repeat(40), aria: 'ok', tab: false, custo: true, desab: false });
    assert.equal(r.totalBotoesCentro, 999);
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao' }).botoesCentro, []);
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', totalBotoesCentro: NaN }).totalBotoesCentro, 0);
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', totalBotoesCentro: '7' }).totalBotoesCentro, 0);
  });

  it('cardClicado: dts, alvo, aria curtos e custo/desab booleanos estritos; ausente ou inválido vira null', () => {
    const r = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', cardClicado: { dts: 'R\u000712', alvo: 'x'.repeat(60), aria: 'ok', custo: 'sim', desab: 1 } });
    assert.deepEqual(r.cardClicado, { dts: 'R##', alvo: 'x'.repeat(40), aria: 'ok', custo: false, desab: false });
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', cardClicado: { dts: { x: 1 }, custo: true, desab: true } }).cardClicado,
      { dts: '', alvo: '', aria: '', custo: true, desab: true });
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao' }).cardClicado, null);
    assert.equal(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-botao', cardClicado: 'texto' }).cardClicado, null);
  });

  it('cabecalho: até 4 níveis, no curto, contagens com teto, booleanos só se true estrito', () => {
    const no = (i) => ({ no: `div#r${i}.${'c'.repeat(60)}`, botoes: i === 0 ? 5000 : 'x', titulo: i === 0 ? 'sim' : true, resumo: true, dialogo: 1 });
    const cadeia = [0, 1, 2, 3, 4, 5].map(no);
    const r = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', cabecalho: { achado: true, cadeia } }).cabecalho;
    assert.equal(r.achado, true);
    assert.equal(r.cadeia.length, 4);
    assert.equal(r.cadeia[0].no.length <= 40, true);
    assert.equal(r.cadeia[0].no.includes('#'), true);
    assert.equal(r.cadeia[0].botoes, 999);
    assert.equal(r.cadeia[1].botoes, 0);
    assert.equal(r.cadeia[0].titulo, false);
    assert.equal(r.cadeia[1].titulo, true);
    assert.equal(r.cadeia[1].dialogo, false);
    assert.deepEqual(Object.keys(r.cadeia[0]).sort(), ['botoes', 'dialogo', 'no', 'resumo', 'titulo']);
  });

  it('vistos: array de texto, controle removido, até 8 itens de 45 caracteres', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => `Cartão ${i}`);
    const r = P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-recompensa', vistos: ['A\u0007B', 42, null, '', 'x'.repeat(60), ...muitos] });
    assert.equal(r.vistos.length, 8);
    assert.equal(r.vistos[0], 'AB');
    assert.equal(r.vistos[1], 'x'.repeat(45));
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', vistos: 'nao' }).vistos, []);
  });
});

describe('limparPercurso: lista branca do diagnóstico do resgate', () => {
  const nivel = { no: 'section', botoes: 1, titulo: false, resumo: false, dialogo: false };
  const candidato = { dts: 'RewardCard12', alvo: 'reward-3', aria: 'Canal 2', no: 'div', anc: [nivel, nivel, nivel, nivel], novo: true, desab: false, trava: 'texto livre' };
  const bruto = {
    caminho: 'custo',
    clique: { tag: 'button', role: 'button', emBotao: true, extra: 'x' },
    rejeitado: { tag: 'span', role: '', emBotao: false, custo: 1, visivel: 1 },
    lista: { cards: -3, comCusto: 2 },
    pos: { centro: true, titulo: false, cardPresente: true, filtros: false, novos: 5000 },
    folhas: { total: 5, titulos: 1, custos: 2, resto: 2, saldo: true },
    escopo: { no: 'div.x', botoes: 2, trava: 'custo' },
    candidatos: [candidato, candidato, candidato, candidato],
    foraDoCentro: 2,
  };

  it('caminho fora da lista fechada vira vazio; titulo e custo passam', () => {
    assert.equal(P.limparPercurso({ caminho: 'outro' }).caminho, '');
    assert.equal(P.limparPercurso({ caminho: 'titulo' }).caminho, 'titulo');
    assert.equal(P.limparPercurso({ caminho: 'custo' }).caminho, 'custo');
  });

  it('strings passam por textoCurto: dígito vira #, controle sai, até 40 caracteres', () => {
    const p = P.limparPercurso({ clique: { tag: 'sp4n\u0007', role: 'x'.repeat(60), emBotao: true } });
    assert.equal(p.clique.tag, 'sp#n');
    assert.equal(p.clique.role.length, 40);
  });

  it('booleanos são estritos: 1 e texto viram false; clique e rejeitado mantêm só as chaves fixas', () => {
    const p = P.limparPercurso(bruto);
    assert.deepEqual(p.clique, { tag: 'button', role: 'button', emBotao: true });
    assert.deepEqual(p.rejeitado, { tag: 'span', role: '', emBotao: false, custo: false, visivel: false });
    assert.equal(P.limparPercurso({ folhas: { saldo: 'sim' } }).folhas.saldo, false);
  });

  it('contagens por contagemLimpa: negativo vira 0, acima de 999 vira 999, texto vira 0', () => {
    const p = P.limparPercurso(bruto);
    assert.equal(p.lista.cards, 0);
    assert.equal(p.lista.comCusto, 2);
    assert.equal(p.pos.novos, 999);
    assert.equal(P.limparPercurso({ foraDoCentro: '3' }).foraDoCentro, 0);
  });

  it('trava fora de TRAVAS_PAGINA vira null; ok e trava da lista passam', () => {
    const p = P.limparPercurso(bruto);
    assert.equal(p.candidatos[0].trava, null);
    assert.equal(p.escopo.trava, 'custo');
    assert.equal(P.limparPercurso({ escopo: { trava: 'ok' } }).escopo.trava, 'ok');
  });

  it('no máximo 3 candidatos e 3 ancestrais por candidato', () => {
    const p = P.limparPercurso(bruto);
    assert.equal(p.candidatos.length, 3);
    assert.equal(p.candidatos[0].anc.length, 3);
    assert.equal(p.candidatos[0].novo, true);
  });

  it('ausente ou não-objeto vira null; dentro do percurso, campo ausente vira null', () => {
    assert.equal(P.limparPercurso(undefined), null);
    assert.equal(P.limparPercurso('x'), null);
    const p = P.limparPercurso({});
    assert.equal(p.clique, null);
    assert.equal(p.rejeitado, null);
    assert.equal(p.lista, null);
    assert.equal(p.pos, null);
    assert.equal(p.folhas, null);
    assert.equal(p.escopo, null);
    assert.deepEqual(p.candidatos, []);
    assert.equal(p.foraDoCentro, 0);
  });

  it('limparResultado leva o percurso na falha; no clicado a chave não existe', () => {
    const falha = P.limparResultado({ id: 9, estado: 'falhou', motivo: 'sem-botao', percurso: { caminho: 'titulo' } });
    assert.equal(falha.percurso.caminho, 'titulo');
    const ok = P.limparResultado({ id: 9, estado: 'clicado', percurso: { caminho: 'titulo' } });
    assert.equal(Object.prototype.hasOwnProperty.call(ok, 'percurso'), false);
  });
});

describe('limparPercurso: array não é objeto e bloqueio na lista fechada (rodada 1)', () => {
  it('rejeitado, clique, lista e pos que são arrays viram null', () => {
    const p = P.limparPercurso({ rejeitado: [], clique: [], lista: [], pos: [], folhas: [], escopo: [] });
    assert.equal(p.rejeitado, null);
    assert.equal(p.clique, null);
    assert.equal(p.lista, null);
    assert.equal(p.pos, null);
    assert.equal(p.folhas, null);
    assert.equal(p.escopo, null);
  });

  it('bloqueio: dedicado e titulo-visivel passam; outro valor vira vazio', () => {
    assert.equal(P.limparPercurso({ bloqueio: 'dedicado' }).bloqueio, 'dedicado');
    assert.equal(P.limparPercurso({ bloqueio: 'titulo-visivel' }).bloqueio, 'titulo-visivel');
    assert.equal(P.limparPercurso({ bloqueio: 'outro' }).bloqueio, '');
    assert.equal(P.limparPercurso({}).bloqueio, '');
  });
});

describe('Redeem por texto e posClique: lista branca, travas e escolha travada (rodada redeem)', () => {
  it('limparRedeem: booleanos estritos, contagens, trava na lista fechada; texto livre some', () => {
    const r = P.limparRedeem({
      trava: 'redeem-texto', centro: 1, detalhe: true, lista: 'sim', unico: true, novo: true, visivel: true, texto: true, atributo: false,
      comCusto: 2, botao: { palavraRedeem: true, numerosQtd: 1, tamanho: 9, desab: 'x', temDts: true, texto: 'NAO PODE' }, desc: { n: 1, tamanho: 4, digito: true, falaCusto: false, frase: 'segredo' },
    });
    assert.equal(r.trava, 'redeem-texto');
    assert.equal(r.centro, false);
    assert.equal(r.detalhe, true);
    assert.equal(r.lista, false);
    assert.equal(r.botao.palavraRedeem, true);
    assert.equal(r.botao.desab, false);
    assert.equal(r.botao.numerosQtd, 1);
    assert.equal(r.desc.n, 1);
    assert.equal(r.desc.digito, true);
    assert.equal(JSON.stringify(r).includes('segredo'), false);
    assert.equal(JSON.stringify(r).includes('NAO PODE'), false);
  });

  it('limparRedeem: trava fora da lista vira null; lixo vira null', () => {
    assert.equal(P.limparRedeem({ trava: 'texto livre da página' }).trava, null);
    assert.equal(P.limparRedeem({ trava: 'redeem-varios' }).trava, 'redeem-varios');
    assert.equal(P.limparRedeem('x'), null);
    assert.equal(P.limparRedeem([]), null);
    assert.equal(P.limparRedeem({ comCusto: '3' }).comCusto, 0);
  });

  it('limparPosClique: só booleanos e contagens; lixo vira null', () => {
    const p = P.limparPosClique({ centro: true, botao: 1, desab: true, titulo: true, novos: 4, folhas: { total: 3, saldo: true, texto: 'x' }, texto: 'vaza' });
    assert.deepEqual(p, { centro: true, botao: false, desab: true, titulo: true, novos: 4, folhas: { total: 3, titulos: 0, custos: 0, resto: 0, saldo: true } });
    assert.equal(P.limparPosClique(null), null);
    assert.equal(P.limparPosClique(['x']), null);
  });

  it('limparResultado clicado com via texto leva o diagnóstico; via inválida é omitida', () => {
    const ok = P.limparResultado({ id: 3, estado: 'clicado', motivo: '', via: 'texto', redeem: { trava: '' }, posClique: { centro: true } });
    assert.equal(ok.via, 'texto');
    assert.equal(ok.redeem.trava, null);
    assert.equal(ok.posClique.centro, true);
    assert.deepEqual(P.limparResultado({ id: 3, estado: 'clicado', motivo: '', via: 'outra' }), { id: 3, estado: 'clicado', motivo: '' });
  });

  it('as travas do Redeem por texto são aceitas na lista fechada do percurso', () => {
    for (const t of ['redeem-centro', 'redeem-detalhe', 'redeem-lista', 'redeem-nenhum', 'redeem-varios', 'redeem-velho', 'redeem-oculto', 'redeem-texto', 'redeem-atributo']) {
      assert.equal(P.limparPercurso({ escopo: { trava: t } }).escopo.trava, t);
    }
  });

  it('percurso leva redeem só quando a página mandou um objeto', () => {
    assert.equal(Object.prototype.hasOwnProperty.call(P.limparPercurso({}), 'redeem'), false);
    assert.equal(P.limparPercurso({ redeem: { trava: 'redeem-lista' } }).redeem.trava, 'redeem-lista');
  });

  it('escolherResgate: tipo travado não resgata de novo; outro tipo segue', () => {
    const base = { tipos: ['xp', 'captura'], leituraOk: true, bonus: { xp: 0, captura: 0 }, agoraServidor: 1000, saldo: { minimo: 9999 }, falhas: {}, agora: 1000 };
    const recompensas = [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }, { tipo: 'captura', titulo: 'Captura', custo: 300 }];
    assert.deepEqual(P.escolherResgate({ ...base, recompensas, travados: ['xp', 'captura'] }), { espera: 'sem-confirmacao' });
    const outro = P.escolherResgate({ ...base, saldo: { minimo: 9999 }, recompensas, travados: ['xp'] });
    assert.equal(outro.tipo, 'captura');
  });
});

describe('limparResultado: via dedicado no aviso de clique (rodada redeem 1)', () => {
  it('clicado com via dedicado passa a via; o resto do aviso segue vazio', () => {
    const r = P.limparResultado({ id: 3, estado: 'clicado', motivo: '', via: 'dedicado' });
    assert.equal(r.via, 'dedicado');
    assert.equal(r.redeem, null);
    assert.equal(r.posClique, null);
  });
});

describe('multi-live: escolherCanais', () => {
  const ofi = (login, espectadores, aoVivo = true) => ({ login, nome: login, espectadores, aoVivo, ativo: true });
  const lista = [ofi('canala', 50), ofi('canalb', 300), ofi('canalc', 120), ofi('canald', 10, false)];

  it('n = 1 sem escolhidos equivale a escolherCanal (mantém o atual; senão o de mais espectadores)', () => {
    assert.deepEqual(P.escolherCanais(lista, [], ['canala'], 1), ['canala']);
    assert.deepEqual(P.escolherCanais(lista, [], [''], 1), ['canalb']);
    assert.equal(P.escolherCanal(lista, ''), 'canalb');
    assert.deepEqual(P.escolherCanais(lista, [], ['canald'], 1), ['canalb']);
  });

  it('escolhidos vêm antes, na ordem de marcação; vagas vazias são ""', () => {
    assert.deepEqual(P.escolherCanais(lista, ['canalc', 'canala'], [], 3), ['canalc', 'canala', 'canalb']);
    assert.deepEqual(P.escolherCanais(lista, ['canald'], [], 2), ['canalb', 'canalc']);
    assert.deepEqual(P.escolherCanais([ofi('canala', 1)], ['canala'], [], 3), ['canala', '', '']);
  });

  it('sem repetir canal e canal já numa vaga fica nela', () => {
    const r = P.escolherCanais(lista, ['canalb', 'canalb'], ['canala', 'canalb', ''], 2);
    assert.deepEqual(r, ['canala', 'canalb']);
    assert.equal(new Set(r.filter(Boolean)).size, r.filter(Boolean).length);
  });

  it('escolhido que volta desloca o automático de menor prioridade, de propósito; o canal que já está numa vaga fica nela', () => {
    const sem = lista.map((o) => (o.login === 'canalb' ? { ...o, aoVivo: false } : o));
    // canalc já está na vaga 1 e fica; a vaga 0 vai para o automático canala
    const fora = P.escolherCanais(sem, ['canalb'], ['canalb', 'canalc'], 2);
    assert.deepEqual(fora, ['canala', 'canalc']);
    // canalb volta e ocupa a vaga livre; canala (já na vaga 0) fica onde está
    const volta = P.escolherCanais(lista, ['canalb'], fora, 2);
    assert.deepEqual(volta, ['canala', 'canalb']);
  });
});

describe('multi-live: escolherResgateCanais', () => {
  const base = (extra = {}) => ({
    tipos: ['xp'],
    leituraOk: true,
    bonus: { xp: 0, captura: 0, shiny: 0 },
    agoraServidor: 1000000,
    recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }],
    falhas: {},
    agora: 1000000,
    travados: [],
    ...extra,
  });
  const st = (s, canal, saldoTexto, falhasCanal = {}) => ({ s, canal, saldo: saldoTexto ? P.parsePontos(saldoTexto) : null, falhasCanal });

  it('saldos 100, 350, 610 e 900: vence o de 350 (menor saldo suficiente)', () => {
    const r = P.escolherResgateCanais(base({ streams: [st(0, 'a', '100'), st(1, 'b', '350'), st(2, 'c', '610'), st(3, 'd', '900')] }));
    assert.deepEqual(r, { tipo: 'xp', titulo: 'Bônus XP', custo: 300, s: 1, canal: 'b' });
  });

  it('empate de saldo fica com a menor vaga', () => {
    const r = P.escolherResgateCanais(base({ streams: [st(2, 'c', '500'), st(0, 'a', '500')] }));
    assert.equal(r.canal, 'a');
    assert.equal(r.s, 0);
  });

  it('sem saldo suficiente em nenhuma live: espera saldo; sem saldo lido: sem-saldo-lido', () => {
    assert.deepEqual(P.escolherResgateCanais(base({ streams: [st(0, 'a', '100')] })), { espera: 'saldo' });
    assert.deepEqual(P.escolherResgateCanais(base({ streams: [st(0, 'a', null)] })), { espera: 'sem-saldo-lido' });
  });

  it('falha de canal pausa só aquela live: a outra segue', () => {
    const falhasA = { xp: { n: 1, ate: 1000000 + 120000 } };
    const r = P.escolherResgateCanais(base({ streams: [st(0, 'a', '900', falhasA), st(1, 'b', '400')] }));
    assert.equal(r.canal, 'b');
  });

  it('todas as lives pausadas dão a espera pausado', () => {
    const falhas = { xp: { n: 1, ate: 1000000 + 120000 } };
    assert.deepEqual(P.escolherResgateCanais(base({ streams: [st(0, 'a', '900', falhas)] })), { espera: 'pausado' });
  });
});

describe('multi-live: medirGanho', () => {
  const T0 = 1000000000;
  const min = (n) => n * 60000;
  const saldo = (minimo, exato = true) => ({ valor: minimo, minimo, exato });

  it('taxa por hora pela soma das altas; medindo e null antes de 15 min', () => {
    let e = null;
    let m = P.medirGanho(e, { saldo: saldo(100), bauEm: 0 }, T0);
    assert.equal(m.medindo, true);
    assert.equal(m.ganhoHora, null);
    e = m.estado;
    m = P.medirGanho(e, { saldo: saldo(150), bauEm: 0 }, T0 + min(20));
    assert.equal(m.medindo, false);
    // 50 pontos em 20 min: 150 por hora
    assert.equal(m.ganhoHora, 150);
  });

  it('queda ignorada: a base refaz e a queda não entra como ganho', () => {
    let m = P.medirGanho(null, { saldo: saldo(500), bauEm: 0 }, T0);
    m = P.medirGanho(m.estado, { saldo: saldo(300), bauEm: 0 }, T0 + min(20));
    m = P.medirGanho(m.estado, { saldo: saldo(350), bauEm: 0 }, T0 + min(40));
    assert.equal(m.ganhoHora, Math.round((50 * 3600000) / (min(40))));
  });

  it('leitura abreviada marca aproximado; janela móvel de 60 min descarta altas antigas', () => {
    let m = P.medirGanho(null, { saldo: saldo(1000, false), bauEm: 0 }, T0);
    m = P.medirGanho(m.estado, { saldo: saldo(1100, false), bauEm: 0 }, T0 + min(20));
    assert.equal(m.aproximado, true);
    m = P.medirGanho(m.estado, { saldo: saldo(1100, false), bauEm: 0 }, T0 + min(90));
    assert.equal(m.estado.altas.length, 0);
  });

  it('conta baús na janela e não conta o mesmo baú duas vezes', () => {
    let m = P.medirGanho(null, { saldo: saldo(10), bauEm: 0 }, T0);
    m = P.medirGanho(m.estado, { saldo: saldo(10), bauEm: T0 + min(1) }, T0 + min(1));
    m = P.medirGanho(m.estado, { saldo: saldo(10), bauEm: T0 + min(1) }, T0 + min(2));
    assert.equal(m.baus, 1);
  });
});

describe('multi-live: medirGanho com troca de precisão', () => {
  it('leitura abreviada antes da exata não cria alta fantasma nem zera a taxa', () => {
    const T0 = 1000000000;
    let m = P.medirGanho(null, { saldo: { valor: 1000, minimo: 1000, exato: false }, bauEm: 0 }, T0);
    m = P.medirGanho(m.estado, { saldo: { valor: 1200, minimo: 1200, exato: true }, bauEm: 0 }, T0 + 20 * 60000);
    assert.equal(m.estado.altas.length, 0);
    assert.equal(m.ganhoHora, 0);
  });
});

describe('multi-live: abreviada só é piso (oscilação entre formas)', () => {
  it('exato 1234, abreviado 1250, exato 1260 conta 26 e não zera a taxa', () => {
    const T0 = 1000000000;
    let m = P.medirGanho(null, { saldo: { valor: 1234, minimo: 1234, exato: true }, bauEm: 0 }, T0);
    m = P.medirGanho(m.estado, { saldo: { valor: 1250, minimo: 1000, exato: false }, bauEm: 0 }, T0 + 10 * 60000);
    m = P.medirGanho(m.estado, { saldo: { valor: 1260, minimo: 1260, exato: true }, bauEm: 0 }, T0 + 20 * 60000);
    const soma = m.estado.altas.reduce((s, a) => s + a.delta, 0);
    assert.equal(soma, 26);
    assert.equal(m.ganhoHora, Math.round((26 * 3600000) / (20 * 60000)));
  });
});

describe('foco por live: escolherResgateCanais', () => {
  const base = (extra = {}) => ({
    tipos: ['xp', 'captura'],
    leituraOk: true,
    bonus: { xp: 0, captura: 0, shiny: 0 },
    agoraServidor: 1000000,
    recompensas: [{ tipo: 'xp', titulo: 'Bônus XP', custo: 300 }, { tipo: 'captura', titulo: 'Captura', custo: 500 }],
    falhas: {},
    agora: 1000000,
    travados: [],
    ...extra,
  });
  const st = (s, canal, saldoTexto, foco) => ({ s, canal, saldo: saldoTexto ? P.parsePontos(saldoTexto) : null, falhasCanal: {}, foco });

  it('live focada em XP com saldo para Captura não resgata Captura (XP em dia): espera em-dia', () => {
    // XP com bônus ainda ativo: só Captura precisa de resgate. Focada em XP não pode pagar Captura.
    const r = P.escolherResgateCanais(base({
      bonus: { xp: 4600000, captura: 0, shiny: 0 },
      streams: [st(0, 'a', '900', 'xp')],
    }));
    assert.deepEqual(r, { espera: 'em-dia' });
  });

  it('focada e Automático no mesmo tipo com saldo: vence a focada, mesmo com saldo menor no Automático', () => {
    const r = P.escolherResgateCanais(base({ tipos: ['xp'], streams: [st(0, 'a', '350'), st(1, 'b', '900', 'xp')] }));
    assert.deepEqual(r, { tipo: 'xp', titulo: 'Bônus XP', custo: 300, s: 1, canal: 'b' });
  });

  it('foco em tipo desligado não resgata e não cai para outro tipo: espera foco-desligado', () => {
    assert.deepEqual(P.escolherResgateCanais(base({ tipos: ['xp'], streams: [st(0, 'a', '900', 'shiny')] })), { espera: 'foco-desligado' });
  });

  it('foco em tipo desligado não bloqueia a live Automático, que segue e pode resgatar', () => {
    const r = P.escolherResgateCanais(base({ tipos: ['xp'], streams: [st(0, 'a', '900', 'shiny'), st(1, 'b', '900')] }));
    assert.deepEqual(r, { tipo: 'xp', titulo: 'Bônus XP', custo: 300, s: 1, canal: 'b' });
  });

  it('foco-desligado fica atrás de saldo: com uma live sem saldo suficiente, a espera é saldo', () => {
    const r = P.escolherResgateCanais(base({ tipos: ['xp'], streams: [st(0, 'a', '900', 'shiny'), st(1, 'b', '100')] }));
    assert.deepEqual(r, { espera: 'saldo' });
  });

  it('sem foco, resultado igual ao antigo (foco ausente, vazio ou fora de TIPOS)', () => {
    const streams = (f) => [st(0, 'a', '100', f), st(1, 'b', '350', f), st(2, 'c', '610', f), st(3, 'd', '900', f)];
    const sem = P.escolherResgateCanais(base({ streams: streams(undefined) }));
    assert.deepEqual(sem, { tipo: 'xp', titulo: 'Bônus XP', custo: 300, s: 1, canal: 'b' });
    assert.deepEqual(P.escolherResgateCanais(base({ streams: streams('')})), sem);
    assert.deepEqual(P.escolherResgateCanais(base({ streams: streams('bogus') })), sem);
  });

  it('focada sem saldo e Automático com saldo: o Automático paga, inclusive o tipo que a outra focava', () => {
    const r = P.escolherResgateCanais(base({ streams: [st(0, 'a', '100', 'xp'), st(1, 'b', '900')] }));
    assert.deepEqual(r, { tipo: 'xp', titulo: 'Bônus XP', custo: 300, s: 1, canal: 'b' });
  });
});
