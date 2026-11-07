'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const stats = require('./poke-stats');

const BULBA = { hp: 45, attack: 49, defense: 49, 'special-attack': 65, 'special-defense': 65, speed: 45 };

describe('finalStat', () => {
  it('casos da especificação', () => {
    const casos = [
      [{ base: 45, tier: 'P1', shiny: false, iv: 0, level: 10, quality: 100 }, 45],
      [{ base: 45, tier: 'P1', shiny: false, iv: 31, level: 10, quality: 100 }, 76],
      [{ base: 45, tier: 'P1', shiny: false, iv: 31, level: 50, quality: 100 }, 380],
      [{ base: 100, tier: 'P1', shiny: false, iv: 0, level: 1, quality: 100 }, 10],
      [{ base: 45, tier: 'P1', shiny: false, iv: 0, level: 1, quality: 85 }, 3],
      [{ base: 45, tier: 'P1', shiny: false, iv: 0, level: 10, quality: 85 }, 38],
      [{ base: 45, tier: 'P1', shiny: false, iv: 0, level: 10, quality: 120 }, 54],
      [{ base: 100, tier: 'P5', shiny: true, iv: 31, level: 100, quality: 120 }, 7572],
      [{ base: 45, tier: 'P5', shiny: true, iv: 0, level: 1, quality: 85 }, 22],
      [{ base: 49, tier: 'P1', shiny: true, iv: 15, level: 25, quality: 97 }, 392],
      [{ base: 65, tier: 'P2', shiny: false, iv: 20, level: 37, quality: 110 }, 359],
      [{ base: 49, tier: 'P3', shiny: false, iv: 7, level: 88, quality: 93 }, 498],
    ];
    for (const [input, esperado] of casos) assert.equal(stats.finalStat(input), esperado, JSON.stringify(input));
  });

  it('tiers P2 a P5 com base 100, IV 0, nível 10, qualidade 100 (P4 pega o erro de ponto flutuante)', () => {
    assert.equal(stats.finalStat({ base: 100, tier: 'P2', shiny: false, iv: 0, level: 10, quality: 100 }), 105);
    assert.equal(stats.finalStat({ base: 100, tier: 'P3', shiny: false, iv: 0, level: 10, quality: 100 }), 110);
    assert.equal(stats.finalStat({ base: 100, tier: 'P4', shiny: false, iv: 0, level: 10, quality: 100 }), 115);
    assert.equal(stats.finalStat({ base: 100, tier: 'P5', shiny: false, iv: 0, level: 10, quality: 100 }), 200);
  });
});

describe('effectiveBase', () => {
  it('exemplos da especificação', () => {
    assert.equal(stats.effectiveBase({ base: 100, tier: 'P5', shiny: true, iv: 31 }), 631);
    assert.equal(stats.effectiveBase({ base: 65, tier: 'P2', shiny: false, iv: 20 }), 88.25);
  });
});

describe('finalStats', () => {
  it('Bulbasaur L50 Q100 P1 sem shiny IV31', () => {
    assert.deepEqual(
      stats.finalStats({ baseStats: BULBA, level: 50, quality: 100, iv: 31, tier: 'P1', shiny: false }),
      { hp: 380, attack: 400, defense: 400, 'special-attack': 480, 'special-defense': 480, speed: 380 },
    );
  });

  it('baseStats ausente lança TypeError', () => {
    assert.throws(() => stats.finalStats({ level: 50, quality: 100, iv: 31, tier: 'P1', shiny: false }), TypeError);
  });
});

describe('cooldown', () => {
  const casos = [
    [0, 10, 10],
    [380, 10, 7.246376811594203],
    [1000, 10, 5],
    [380, 0.6, 0.5],
    [1000, 1, 0.5],
    [0, 0.5, 0.5],
    [0, 0.4, 0.5],
  ];
  for (const [speed, cd, esperado] of casos) {
    it(`speed ${speed}, cd ${cd} -> ${esperado}`, () => {
      assert.ok(Math.abs(stats.finalSkillCooldown(cd, speed) - esperado) < 1e-9);
    });
  }

  it('speed 7572 com recarga 30', () => {
    assert.ok(Math.abs(stats.finalSkillCooldown(30, 7572) - 3.4997666822) < 1e-6);
  });

  it('cooldownReduction(0) é 1', () => {
    assert.equal(stats.cooldownReduction(0), 1);
  });
});

describe('núcleo estrito', () => {
  const base = { base: 45, tier: 'P1', shiny: false, iv: 0, level: 10, quality: 100 };
  const rangeErrors = [
    { ...base, iv: 32 },
    { ...base, iv: -1 },
    { ...base, iv: 1.5 },
    { ...base, quality: 84 },
    { ...base, quality: 121 },
    { ...base, quality: 100.5 },
    { ...base, level: 0 },
    { ...base, level: 1.5 },
    { ...base, base: -1 },
  ];
  for (const input of rangeErrors) {
    it(`RangeError para ${JSON.stringify(input)}`, () => {
      assert.throws(() => stats.finalStat(input), RangeError);
    });
  }
  it('baseCd 0, -1 e speed -1 lançam RangeError', () => {
    assert.throws(() => stats.finalSkillCooldown(0, 10), RangeError);
    assert.throws(() => stats.finalSkillCooldown(-1, 10), RangeError);
    assert.throws(() => stats.finalSkillCooldown(10, -1), RangeError);
  });
  it('tier desconhecido, tier undefined, base string e baseCd NaN lançam TypeError', () => {
    assert.throws(() => stats.finalStat({ ...base, tier: 'P6' }), TypeError);
    assert.throws(() => stats.finalStat({ ...base, tier: undefined }), TypeError);
    assert.throws(() => stats.finalStat({ ...base, base: '45' }), TypeError);
    assert.throws(() => stats.finalSkillCooldown(NaN, 10), TypeError);
  });
});

describe('normalizeInputs', () => {
  it('limita, arredonda e registra ajustes de IV', () => {
    const iv40 = stats.normalizeInputs({ iv: 40 });
    assert.equal(iv40.values.iv, 31);
    assert.deepEqual(iv40.ajustes, [{ campo: 'iv', de: 40, para: 31 }]);
    assert.equal(stats.normalizeInputs({ iv: -3 }).values.iv, 0);
    assert.equal(stats.normalizeInputs({ iv: 12.6 }).values.iv, 13);
  });

  it('qualidade e nível dentro das faixas da UI', () => {
    assert.equal(stats.normalizeInputs({ quality: 130 }).values.quality, 120);
    assert.equal(stats.normalizeInputs({ quality: 80 }).values.quality, 85);
    assert.equal(stats.normalizeInputs({ level: 0 }).values.level, 1);
    assert.equal(stats.normalizeInputs({ level: 150 }).values.level, 100);
  });

  it('tier: p3 vira P3 e X vira P1', () => {
    const p3 = stats.normalizeInputs({ tier: 'p3' });
    assert.equal(p3.values.tier, 'P3');
    assert.equal(p3.ajustes.length, 1);
    const x = stats.normalizeInputs({ tier: 'X' });
    assert.equal(x.values.tier, 'P1');
    assert.deepEqual(x.ajustes, [{ campo: 'tier', de: 'X', para: 'P1' }]);
  });

  it('shiny só vale true exato', () => {
    assert.equal(stats.normalizeInputs({ shiny: 'true' }).values.shiny, false);
    assert.equal(stats.normalizeInputs({ shiny: true }).values.shiny, true);
  });

  it('recarga entre 0,1 e 600', () => {
    assert.equal(stats.normalizeInputs({ baseCd: 0 }).values.baseCd, 0.1);
    assert.equal(stats.normalizeInputs({ baseCd: 1000 }).values.baseCd, 600);
  });

  it('null devolve os padrões sem ajustes', () => {
    const r = stats.normalizeInputs(null);
    assert.deepEqual(r.values, { level: 50, quality: 100, iv: 31, tier: 'P1', shiny: false, baseCd: 10 });
    assert.deepEqual(r.ajustes, []);
  });

  it('undefined e null são ausentes: padrão e sem ajuste', () => {
    const r = stats.normalizeInputs({ iv: undefined, baseCd: null, tier: undefined, shiny: null });
    assert.equal(r.values.iv, 31);
    assert.equal(r.values.baseCd, 10);
    assert.deepEqual(r.ajustes, []);
  });

  it('texto vazio ou só espaço é inválido: padrão e ajuste com de vazio, em todos os campos', () => {
    for (const vazio of ['', '  ']) {
      for (const campo of ['level', 'quality', 'iv', 'baseCd', 'tier', 'shiny']) {
        const r = stats.normalizeInputs({ [campo]: vazio });
        assert.equal(r.ajustes.length, 1, `${campo} ${JSON.stringify(vazio)}`);
        assert.equal(r.ajustes[0].campo, campo);
        assert.equal(r.ajustes[0].de, '');
      }
    }
    const r = stats.normalizeInputs({ level: '', quality: '', iv: '', tier: '', shiny: '', baseCd: '' });
    assert.deepEqual(r.values, { level: 50, quality: 100, iv: 31, tier: 'P1', shiny: false, baseCd: 10 });
    assert.deepEqual(
      r.ajustes.map((a) => [a.campo, a.para]),
      [['level', 50], ['quality', 100], ['iv', 31], ['tier', 'P1'], ['shiny', false], ['baseCd', 10]],
    );
  });

  it('tier X continua registrando ajuste', () => {
    const r = stats.normalizeInputs({ tier: 'X' });
    assert.equal(r.values.tier, 'P1');
    assert.equal(r.ajustes.length, 1);
  });

  it('formatAjuste: vazio com concordância e unidade, nos seis campos', () => {
    assert.equal(stats.formatAjuste({ campo: 'iv', de: '', para: 31 }), 'IV vazio: calculando com 31.');
    assert.equal(stats.formatAjuste({ campo: 'baseCd', de: '', para: 10 }), 'Recarga vazia: calculando com 10 s.');
    assert.equal(stats.formatAjuste({ campo: 'quality', de: '', para: 100 }), 'Qualidade vazia: calculando com 100%.');
    assert.equal(stats.formatAjuste({ campo: 'level', de: '', para: 50 }), 'Nível vazio: calculando com 50.');
    assert.equal(stats.formatAjuste({ campo: 'tier', de: '', para: 'P1' }), 'Tier vazio: calculando com P1.');
    assert.equal(stats.formatAjuste({ campo: 'shiny', de: '', para: false }), 'Shiny vazio: calculando com Desligado.');
  });

  it('formatAjuste: vazio vindo de normalizeInputs, inclusive só com espaços', () => {
    const frases = stats.normalizeInputs({ iv: '  ', baseCd: '' }).ajustes.map((a) => stats.formatAjuste(a));
    assert.deepEqual(frases, ['IV vazio: calculando com 31.', 'Recarga vazia: calculando com 10 s.']);
  });

  it('formatAjuste: número em texto ganha unidade na origem e no destino, em pt-BR', () => {
    assert.equal(stats.formatAjuste({ campo: 'quality', de: '84', para: 85 }), 'Qualidade 84% → 85%.');
    assert.equal(stats.formatAjuste({ campo: 'baseCd', de: '0', para: 0.1 }), 'Recarga 0 s → 0,1 s.');
    assert.equal(stats.formatAjuste({ campo: 'baseCd', de: '12.5', para: 13.5 }), 'Recarga 12,5 s → 13,5 s.');
    assert.equal(stats.formatAjuste({ campo: 'level', de: '150', para: 100 }), 'Nível 150 → 100.');
  });

  it('formatAjuste: booleano e tier em texto', () => {
    assert.equal(stats.formatAjuste({ campo: 'shiny', de: true, para: false }), 'Shiny Ligado → Desligado.');
    assert.equal(stats.formatAjuste({ campo: 'tier', de: 'p3', para: 'P3' }), 'Tier p3 → P3.');
    assert.equal(stats.formatAjuste({ campo: 'tier', de: 'X', para: 'P1' }), 'Tier X → P1.');
  });

  it('lixo vira padrão e é registrado; nunca lança', () => {
    const r = stats.normalizeInputs({ iv: 'abc', baseCd: NaN });
    assert.equal(r.values.iv, 31);
    assert.equal(r.values.baseCd, 10);
    assert.equal(r.ajustes.length, 2);
  });
});
