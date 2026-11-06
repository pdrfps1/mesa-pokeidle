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
    limiarMin: 5,
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

  it('bônus com 30 min não resgata; exatamente 5 min também não; 4:59 resgata', () => {
    const meiaHora = { xp: agoraServidor + 30 * 60000 };
    assert.deepEqual(P.escolherResgate(base({ bonus: meiaHora })), { espera: 'em-dia' });
    const cincoMin = { xp: agoraServidor + 5 * 60000 };
    assert.deepEqual(P.escolherResgate(base({ bonus: cincoMin })), { espera: 'em-dia' });
    const quatroE59 = { xp: agoraServidor + 4 * 60000 + 59000 };
    assert.equal(P.escolherResgate(base({ bonus: quatroE59 })).tipo, 'xp');
  });

  it('bônus inativo resgata', () => {
    assert.deepEqual(P.escolherResgate(base()), { tipo: 'xp', titulo: 'Bônus XP', custo: 300 });
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

  it('entre vários, o de menor restante vem primeiro; empate vai pela ordem de tipos', () => {
    const bonus = { xp: agoraServidor + 60000, captura: 0, shiny: 0 };
    const recompensas = [
      { tipo: 'xp', titulo: 'XP', custo: 300 },
      { tipo: 'captura', titulo: 'Captura', custo: 300 },
    ];
    assert.equal(P.escolherResgate(base({ tipos: ['xp', 'captura'], bonus, recompensas })).tipo, 'captura');
    assert.equal(P.escolherResgate(base({ tipos: ['xp', 'captura'], recompensas })).tipo, 'xp');
  });

  it('o primeiro sem saldo cede ao segundo que tem saldo', () => {
    const bonus = { xp: agoraServidor + 60000, captura: 0, shiny: 0 };
    const recompensas = [
      { tipo: 'captura', titulo: 'Captura', custo: 500 },
      { tipo: 'xp', titulo: 'XP', custo: 300 },
    ];
    assert.equal(P.escolherResgate(base({ tipos: ['xp', 'captura'], bonus, recompensas })).tipo, 'xp');
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
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'coisa' }), { id: 5, estado: 'falhou', motivo: 'outro', vistos: [], fase: '', clicou: false, pistas: [], dialogoAntes: false, dialogos: [] });
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'indisponivel' }), { id: 5, estado: 'falhou', motivo: 'indisponivel', vistos: [], fase: '', clicou: false, pistas: [], dialogoAntes: false, dialogos: [] });
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'clicado', motivo: 'x' }), { id: 5, estado: 'clicado', motivo: '' });
    assert.equal(P.limparResultado({ id: '5', estado: 'clicado' }), null);
    assert.equal(P.limparResultado({ id: 0, estado: 'clicado' }), null);
    assert.equal(P.limparResultado({ id: 5, estado: 'desconhecido' }), null);
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
    assert.deepEqual(r[1], { botoes: 0, abas: 0, itens: [], dts: [], titulo: true, campoTexto: false });
    assert.deepEqual(P.limparResultado({ id: 5, estado: 'falhou', motivo: 'sem-centro', dialogos: 'nao' }).dialogos, []);
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
