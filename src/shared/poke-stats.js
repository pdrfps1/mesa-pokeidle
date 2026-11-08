// @ts-check
// Fórmulas conforme especificação do usuário; não conferidas no jogo.
// Funções puras, sem dependências. No renderer vira o global MesaPokeStats; no Node, module.exports.
var MesaPokeStats = (function pokeStatsModule() {
  /** @typedef {'P1'|'P2'|'P3'|'P4'|'P5'} Tier */
  /** @typedef {{campo: string, de: unknown, para: unknown}} Ajuste */
  /** @typedef {{level: number, quality: number, iv: number, tier: Tier, shiny: boolean, baseCd: number}} ValoresCalc */

  /** Multiplicador de tier em centésimos (P1 = 1,00). Inteiros evitam erro de ponto flutuante no floor. */
  const TIERS = Object.freeze({ P1: 100, P2: 105, P3: 110, P4: 115, P5: 200 });
  /** Multiplicador do shiny (inteiro). */
  const SHINY_MULT = 3;
  /** Piso do cooldown final, em segundos. */
  const CD_FLOOR = 0.5;
  /** Chaves dos seis stats, na ordem de exibição. Mesmos nomes da PokeAPI. */
  const STAT_KEYS = Object.freeze(['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed']);
  /** Faixas do núcleo estrito (lança erro) e da UI (normalizeInputs limita). */
  const LIMITS = Object.freeze({
    base: { min: 0, max: 1000 },
    level: { min: 1, max: 10000 },
    quality: { min: 85, max: 120 },
    iv: { min: 0, max: 31 },
    uiLevel: { min: 1, max: 100 },
    uiBaseCd: { min: 0.1, max: 600 },
  });
  /** Valores padrão da calculadora. */
  const PADRAO = Object.freeze({ level: 50, quality: 100, iv: 31, tier: /** @type {Tier} */ ('P1'), shiny: false, baseCd: 10 });

  /** @param {unknown} value */
  function isPlain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * @param {unknown} value
   * @param {string} campo
   * @returns {void}
   */
  function exigeNumero(value, campo) {
    if (typeof value !== 'number' || Number.isNaN(value)) throw new TypeError(`${campo} precisa ser um número.`);
  }

  /**
   * @param {unknown} value
   * @param {string} campo
   * @param {number} min
   * @param {number} max
   * @returns {void}
   */
  function exigeInteiro(value, campo, min, max) {
    exigeNumero(value, campo);
    const numero = /** @type {number} */ (value);
    if (!Number.isInteger(numero)) throw new RangeError(`${campo} precisa ser um número inteiro.`);
    if (numero < min || numero > max) throw new RangeError(`${campo} fora da faixa ${min} a ${max}.`);
  }

  /** @param {unknown} tier @returns {void} */
  function exigeTier(tier) {
    if (typeof tier !== 'string' || !Object.prototype.hasOwnProperty.call(TIERS, tier)) {
      throw new TypeError('tier precisa ser P1, P2, P3, P4 ou P5.');
    }
  }

  /** @param {unknown} shiny @returns {void} */
  function exigeShiny(shiny) {
    if (typeof shiny !== 'boolean') throw new TypeError('shiny precisa ser verdadeiro ou falso.');
  }

  /** @param {unknown} speed @returns {void} */
  function exigeSpeed(speed) {
    exigeNumero(speed, 'speed');
    const numero = /** @type {number} */ (speed);
    if (!Number.isFinite(numero) || numero < 0) throw new RangeError('speed precisa ser um número finito maior ou igual a 0.');
  }

  /** @param {unknown} baseCd @returns {void} */
  function exigeBaseCd(baseCd) {
    exigeNumero(baseCd, 'baseCd');
    const numero = /** @type {number} */ (baseCd);
    if (!Number.isFinite(numero) || numero <= 0) throw new RangeError('baseCd precisa ser um número finito maior que 0.');
  }

  /**
   * Multiplicador total em centésimos: tier × (shiny ? 3 : 1).
   * @param {Tier} tier
   * @param {boolean} shiny
   * @returns {number}
   */
  function multiplicador(tier, shiny) {
    return TIERS[tier] * (shiny ? SHINY_MULT : 1);
  }

  /**
   * EffectiveBase = (Base × Tier × Shiny) + IV.
   * @param {{base: number, tier: Tier, shiny: boolean, iv: number}} input
   * @returns {number}
   */
  function effectiveBase(input) {
    const { base, tier, shiny, iv } = input;
    exigeInteiro(base, 'base', LIMITS.base.min, LIMITS.base.max);
    exigeTier(tier);
    exigeShiny(shiny);
    exigeInteiro(iv, 'iv', LIMITS.iv.min, LIMITS.iv.max);
    // Mesma aritmética inteira de finalStat: em centésimos, depois divide por 100 uma vez.
    const efetivoCentesimos = base * multiplicador(tier, shiny) + iv * 100;
    return efetivoCentesimos / 100;
  }

  /**
   * FinalStat = floor(EffectiveBase × Level/10 × Quality/100), em aritmética inteira.
   * @param {{base: number, level: number, quality: number, iv: number, tier: Tier, shiny: boolean}} input
   * @returns {number}
   */
  function finalStat(input) {
    const { base, level, quality, iv, tier, shiny } = input;
    exigeInteiro(base, 'base', LIMITS.base.min, LIMITS.base.max);
    exigeInteiro(level, 'level', LIMITS.level.min, LIMITS.level.max);
    exigeInteiro(quality, 'quality', LIMITS.quality.min, LIMITS.quality.max);
    exigeInteiro(iv, 'iv', LIMITS.iv.min, LIMITS.iv.max);
    exigeTier(tier);
    exigeShiny(shiny);
    // EffectiveBase em centésimos: base × tier × shiny + iv × 100. Depois ÷ 100 × level/10 × quality/100.
    const efetivoCentesimos = base * multiplicador(tier, shiny) + iv * 100;
    return Math.floor((efetivoCentesimos * level * quality) / 100000);
  }

  /**
   * Os seis stats finais. `baseStats` traz os seis base_stat da PokeAPI.
   * @param {{baseStats: Record<string, number>, level: number, quality: number, iv: number, tier: Tier, shiny: boolean}} input
   * @returns {Record<string, number>}
   */
  function finalStats(input) {
    const { baseStats, level, quality, iv, tier, shiny } = input;
    if (!isPlain(baseStats)) throw new TypeError('baseStats precisa ser um objeto com os seis stats.');
    /** @type {Record<string, number>} */
    const out = {};
    for (const key of STAT_KEYS) {
      out[key] = finalStat({ base: baseStats[key], level, quality, iv, tier, shiny });
    }
    return out;
  }

  /**
   * CooldownReduction = 1 + Speed/1000.
   * @param {number} speed Speed final já calculado.
   * @returns {number}
   */
  function cooldownReduction(speed) {
    exigeSpeed(speed);
    return 1 + speed / 1000;
  }

  /**
   * FinalCD = max(0.5, BaseCD / CooldownReduction).
   * @param {number} baseCd Recarga base em segundos.
   * @param {number} speed Speed final já calculado.
   * @returns {number}
   */
  function finalSkillCooldown(baseCd, speed) {
    exigeBaseCd(baseCd);
    const reducao = cooldownReduction(speed);
    return Math.max(CD_FLOOR, baseCd / reducao);
  }

  /**
   * Para a UI: nunca lança. Limita, arredonda e troca lixo pelo padrão, registrando cada mudança.
   * Ausente, null ou texto vazio usa o padrão sem registrar ajuste.
   * A recarga base é arredondada a 0,1 s (uma casa decimal), dentro de 0,1 a 600.
   * @param {unknown} raw
   * @returns {{values: ValoresCalc, ajustes: Ajuste[]}}
   */
  function normalizeInputs(raw) {
    const src = /** @type {Record<string, unknown>} */ (isPlain(raw) ? raw : {});
    /** @type {Ajuste[]} */
    const ajustes = [];

    /** Só undefined e null são ausentes (padrão, sem ajuste). Texto vazio é valor inválido e registra ajuste. @param {unknown} v */
    function ausente(v) {
      return v === undefined || v === null;
    }

    /** Texto só com espaços vira '' no ajuste (campo vazio para a UI). @param {unknown} v */
    function deDe(v) {
      return typeof v === 'string' && v.trim() === '' ? '' : v;
    }

    /**
     * @param {string} campo
     * @param {number} min
     * @param {number} max
     * @param {number} padrao
     * @param {number} casas Casas decimais do arredondamento (0 = inteiro).
     * @returns {number}
     */
    function numero(campo, min, max, padrao, casas) {
      const original = src[campo];
      if (ausente(original)) return padrao;
      let n = NaN;
      if (typeof original === 'number') n = original;
      else if (typeof original === 'string' && original.trim() !== '') n = Number(original);
      if (!Number.isFinite(n)) {
        ajustes.push({ campo, de: deDe(original), para: padrao });
        return padrao;
      }
      const fator = 10 ** casas;
      let valor = Math.round(n * fator) / fator;
      valor = Math.min(max, Math.max(min, valor));
      if (valor !== n) ajustes.push({ campo, de: original, para: valor });
      return valor;
    }

    /** @returns {Tier} */
    function tier() {
      const original = src.tier;
      if (ausente(original)) return PADRAO.tier;
      const maiusculo = typeof original === 'string' ? original.trim().toUpperCase() : '';
      if (Object.prototype.hasOwnProperty.call(TIERS, maiusculo)) {
        if (maiusculo !== original) ajustes.push({ campo: 'tier', de: original, para: maiusculo });
        return /** @type {Tier} */ (maiusculo);
      }
      ajustes.push({ campo: 'tier', de: deDe(original), para: PADRAO.tier });
      return PADRAO.tier;
    }

    /** @returns {boolean} */
    function shiny() {
      const original = src.shiny;
      if (ausente(original)) return PADRAO.shiny;
      if (original === true) return true;
      if (original !== false) ajustes.push({ campo: 'shiny', de: deDe(original), para: false });
      return false;
    }

    const values = {
      level: numero('level', LIMITS.uiLevel.min, LIMITS.uiLevel.max, PADRAO.level, 0),
      quality: numero('quality', LIMITS.quality.min, LIMITS.quality.max, PADRAO.quality, 0),
      iv: numero('iv', LIMITS.iv.min, LIMITS.iv.max, PADRAO.iv, 0),
      tier: tier(),
      shiny: shiny(),
      baseCd: numero('baseCd', LIMITS.uiBaseCd.min, LIMITS.uiBaseCd.max, PADRAO.baseCd, 1),
    };
    return { values, ajustes };
  }

  /** Rótulos dos campos na frase de ajuste. */
  const ROTULOS = Object.freeze({ level: 'Nível', quality: 'Qualidade', iv: 'IV', tier: 'Tier', shiny: 'Shiny', baseCd: 'Recarga' });
  /** Campos cuja frase de vazio usa «vazia» (feminino). */
  const VAZIO_FEMININO = Object.freeze({ baseCd: true, quality: true });
  const FMT_DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

  /**
   * Valor na frase: número (ou número em texto) em pt-BR, com unidade em quality (%) e baseCd (s).
   * Booleano vira Ligado/Desligado; texto (ex.: tier) sai como está.
   * @param {string} campo
   * @param {unknown} v
   * @returns {string}
   */
  function formatValor(campo, v) {
    if (typeof v === 'boolean') return v ? 'Ligado' : 'Desligado';
    let numerico = null;
    if (typeof v === 'number') numerico = v;
    else if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) numerico = Number(v);
    if (numerico === null) return String(v);
    const texto = FMT_DECIMAL.format(numerico);
    if (campo === 'baseCd') return `${texto} s`;
    if (campo === 'quality') return `${texto}%`;
    return texto;
  }

  /**
   * Frase de um ajuste. Campo vazio: «IV vazio: calculando com 31.» (feminino para recarga e qualidade).
   * @param {{campo: string, de: unknown, para: unknown}} ajuste
   * @returns {string}
   */
  function formatAjuste(ajuste) {
    const rotulo = ROTULOS[ajuste.campo] || ajuste.campo;
    if (ajuste.de === '') {
      const artigo = VAZIO_FEMININO[ajuste.campo] ? 'vazia' : 'vazio';
      return `${rotulo} ${artigo}: calculando com ${formatValor(ajuste.campo, ajuste.para)}.`;
    }
    return `${rotulo} ${formatValor(ajuste.campo, ajuste.de)} → ${formatValor(ajuste.campo, ajuste.para)}.`;
  }

  return {
    TIERS,
    SHINY_MULT,
    CD_FLOOR,
    STAT_KEYS,
    LIMITS,
    PADRAO,
    effectiveBase,
    finalStat,
    finalStats,
    cooldownReduction,
    finalSkillCooldown,
    normalizeInputs,
    formatAjuste,
  };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaPokeStats;
