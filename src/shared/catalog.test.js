'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('./catalog');

describe('mesaLiveKind', () => {
  it('aceita o jogo e o login do Google', () => {
    assert.equal(catalog.liveKind('https://pokeidle.io/app'), 'game');
    assert.equal(catalog.liveKind('https://accounts.google.com/o/oauth2/v2/auth'), 'game');
    assert.equal(catalog.liveKind('https://accounts.google.com/gsi/select'), 'game');
    assert.equal(catalog.liveKind('https://www.google.com/recaptcha/api2/anchor'), 'game');
    assert.equal(catalog.liveKind('https://ssl.gstatic.com/accounts/static/logo.png'), 'game');
    assert.equal(catalog.liveKind('https://oauth2.googleapis.com/token'), 'game');
    assert.equal(catalog.liveKind('https://challenges.cloudflare.com/cdn-cgi/challenge'), 'game');
  });

  it('não trata um site qualquer como jogo', () => {
    assert.equal(catalog.liveKind('https://example.com'), '');
    assert.equal(catalog.liveKind('http://accounts.google.com'), '');
    assert.equal(catalog.liveKind('about:blank'), '');
  });
});

describe('normalize', () => {
  it('config antiga deixa ultra desligado nas quatro baías', () => {
    const cfg = catalog.normalize({});
    assert.equal(cfg.bays.length, 4);
    for (const bay of cfg.bays) assert.equal(bay.ultra, false);
  });

  it('config antiga usa fatias iguais e menus abertos', () => {
    const cfg = catalog.normalize({});
    assert.deepEqual(cfg.bayWeights.grade.cols, [1, 1]);
    assert.deepEqual(cfg.bayWeights.grade.rows, [1, 1]);
    assert.deepEqual(cfg.bayWeights.fila.cols, [1, 1, 1, 1]);
    assert.deepEqual(cfg.bayWeights.coluna.rows, [1, 1, 1, 1]);
    assert.equal(cfg.chrome.railExpanded, true);
    assert.equal(cfg.chrome.opExpanded, true);
    assert.equal(cfg.chrome.columnsExpanded.autos, true);
    assert.equal(cfg.chrome.columnsExpanded.focus, true);
    assert.equal(cfg.chrome.columnsExpanded.account, true);
  });

  it('preserva pesos válidos', () => {
    const cfg = catalog.normalize({
      bayWeights: {
        grade: { cols: [2, 1], rows: [1.5, 0.5] },
        fila: { cols: [3, 1, 1, 2] },
        coluna: { rows: [4, 1, 1, 1] },
      },
    });
    assert.deepEqual(cfg.bayWeights.grade.cols, [2, 1]);
    assert.deepEqual(cfg.bayWeights.grade.rows, [1.5, 0.5]);
    assert.deepEqual(cfg.bayWeights.fila.cols, [3, 1, 1, 2]);
    assert.deepEqual(cfg.bayWeights.coluna.rows, [4, 1, 1, 1]);
  });

  it('eixo inválido cai em uns sem lançar', () => {
    const cases = [
      { grade: { cols: [2, 0], rows: [1, 1] } },
      { grade: { cols: [1], rows: [1, 1] } },
      { grade: { cols: [1, 1], rows: [NaN, 1] } },
      { fila: { cols: [1, -1, 1, 1] } },
      { fila: { cols: 'x' } },
      { coluna: { rows: [1, 1, 1] } },
    ];
    for (const bayWeights of cases) {
      const cfg = catalog.normalize({ bayWeights });
      assert.deepEqual(cfg.bayWeights.grade.cols, [1, 1]);
      assert.deepEqual(cfg.bayWeights.grade.rows, [1, 1]);
      assert.deepEqual(cfg.bayWeights.fila.cols, [1, 1, 1, 1]);
      assert.deepEqual(cfg.bayWeights.coluna.rows, [1, 1, 1, 1]);
    }
  });

  it('eixo válido parcial permanece', () => {
    const cfg = catalog.normalize({ bayWeights: { grade: { cols: [2, 1] } } });
    assert.deepEqual(cfg.bayWeights.grade.cols, [2, 1]);
    assert.deepEqual(cfg.bayWeights.grade.rows, [1, 1]);
  });

  it('só false recolhe menus', () => {
    const cfg = catalog.normalize({
      chrome: {
        railExpanded: false,
        opExpanded: 0,
        columnsExpanded: { autos: null, focus: 'false', account: 1 },
      },
    });
    assert.equal(cfg.chrome.railExpanded, false);
    assert.equal(cfg.chrome.opExpanded, true);
    assert.equal(cfg.chrome.columnsExpanded.autos, true);
    assert.equal(cfg.chrome.columnsExpanded.focus, true);
    assert.equal(cfg.chrome.columnsExpanded.account, true);
  });

  it('só raw.ultra === true liga ultra', () => {
    const cfg = catalog.normalize({
      bays: [{ ultra: true }, { ultra: '1' }, { ultra: 1 }],
    });
    assert.equal(cfg.bays[0].ultra, true);
    assert.equal(cfg.bays[1].ultra, false);
    assert.equal(cfg.bays[2].ultra, false);
    assert.equal(cfg.bays[3].ultra, false);
  });
});

describe('isGoogleLoginUrl', () => {
  it('reconhece hosts de login do Google', () => {
    assert.equal(catalog.isGoogleLoginUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
    assert.equal(catalog.isGoogleLoginUrl('https://accounts.google.com/gsi/select'), true);
    assert.equal(catalog.isGoogleLoginUrl('https://www.google.com/signin'), true);
  });

  it('ignora endereços inválidos ou inseguros', () => {
    assert.equal(catalog.isGoogleLoginUrl('http://accounts.google.com'), false);
    assert.equal(catalog.isGoogleLoginUrl('https://example.com'), false);
    assert.equal(catalog.isGoogleLoginUrl(''), false);
  });
});

describe('tamanho de cada baía (disposição Livre)', () => {
  it('config antiga ganha span 6 e altura automática em todas as baías', () => {
    const cfg = catalog.normalize({});
    for (const bay of cfg.bays) assert.deepEqual(bay.box, { span: 6, h: 0 });
  });

  it('livre é uma disposição aceita; desconhecida cai em grade', () => {
    assert.equal(catalog.normalize({ layout: 'livre' }).layout, 'livre');
    assert.equal(catalog.normalize({ layout: 'xadrez' }).layout, 'grade');
  });

  it('span precisa ser inteiro de 3 a 12; o resto volta para 6', () => {
    assert.equal(catalog.boxSpan(3), 3);
    assert.equal(catalog.boxSpan(12), 12);
    assert.equal(catalog.boxSpan(2), 6);
    assert.equal(catalog.boxSpan(13), 6);
    assert.equal(catalog.boxSpan(4.5), 6);
    assert.equal(catalog.boxSpan('8'), 8);
    assert.equal(catalog.boxSpan(null), 6);
  });

  it('altura: 0 é automática; valores são arredondados a 10 px e limitados a 120–800', () => {
    assert.equal(catalog.boxHeight(0), 0);
    assert.equal(catalog.boxHeight(null), 0);
    assert.equal(catalog.boxHeight(-40), 0);
    assert.equal(catalog.boxHeight(NaN), 0);
    assert.equal(catalog.boxHeight(333), 330);
    assert.equal(catalog.boxHeight(336), 340);
    assert.equal(catalog.boxHeight(50), 120);
    assert.equal(catalog.boxHeight(5000), 800);
  });

  it('normalize aplica as mesmas regras a cada baía e preserva as outras', () => {
    const cfg = catalog.normalize({ bays: [{ box: { span: 9, h: 412 } }, { box: { span: 1, h: 9999 } }] });
    assert.deepEqual(cfg.bays[0].box, { span: 9, h: 410 });
    assert.deepEqual(cfg.bays[1].box, { span: 6, h: 800 });
    assert.equal(cfg.bays[0].placed, true);
  });
});

describe('bônus Twitch no catálogo', () => {
  it('padrões: automação desligada e preferências globais', () => {
    const cfg = catalog.normalize({});
    for (const bay of cfg.bays) assert.equal(bay.twitchAuto, false);
    assert.deepEqual(cfg.twitch, { tipos: { xp: true, captura: false, shiny: false } });
  });

  it('limiarMin não existe mais: qualquer valor passa sem lançar e tipos é preservado', () => {
    for (const limiarMin of [7, 10, 'x']) {
      const tw = catalog.normalize({ twitch: { limiarMin } }).twitch;
      assert.equal(Object.prototype.hasOwnProperty.call(tw, 'limiarMin'), false);
    }
    assert.equal(catalog.normalize({ twitch: { tipos: { xp: false } } }).twitch.tipos.xp, false);
  });

  it('twitchAuto só liga com true', () => {
    const cfg = catalog.normalize({ bays: [{ twitchAuto: true }, { twitchAuto: 'sim' }] });
    assert.equal(cfg.bays[0].twitchAuto, true);
    assert.equal(cfg.bays[1].twitchAuto, false);
  });

  it('partições da Twitch são quatro e não se cruzam com as do jogo', () => {
    assert.equal(catalog.twitchPartitions.length, 4);
    for (const part of catalog.twitchPartitions) assert.equal(catalog.partitions.includes(part), false);
  });
});
