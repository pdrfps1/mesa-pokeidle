// Contagem de capturas da sessão por baía. Funções puras: nunca mutam a entrada.
// O relatório da página é cumulativo: o delta é a diferença para o último valor visto.
var MesaCaptureTally = (function captureTallyModule() {
  function isPlain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isCount(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }

  // Valida o relatório de capturas: inteiro de 0 a 1e9 em normal e shiny, senão null. Nunca converte para 0.
  function cleanCapturaReport(raw) {
    if (!isPlain(raw) || !isCount(raw.normal) || !isCount(raw.shiny)) return null;
    if (raw.normal > 1e9 || raw.shiny > 1e9) return null;
    const report = { normal: raw.normal, shiny: raw.shiny };
    if (isPlain(raw.melhor) && typeof raw.melhor.nome === 'string' && Number.isInteger(raw.melhor.level)) {
      report.melhor = raw.melhor;
    }
    return report;
  }

  function empty() {
    return {
      normal: 0, shiny: 0, lastNormalAt: null, lastShinyAt: null, seen: { normal: 0, shiny: 0 }, nick: '', melhor: null,
    };
  }

  // Mais forte entre dois Pokémon: maior nível; empate vai para a maior soma de IVs.
  function strongerOf(a, b) {
    if (!isPlain(b)) return isPlain(a) ? a : null;
    if (!isPlain(a)) return b;
    if (a.level !== b.level) return a.level > b.level ? a : b;
    return (b.ivSum ?? -1) > (a.ivSum ?? -1) ? b : a;
  }

  // Cur menor que o visto indica recarga da página: o valor atual é todo novo.
  function deltaOf(cur, seen) {
    return cur >= seen ? cur - seen : cur;
  }

  function apply(tally, rawReport, nick, now) {
    // Porta de entrada única: relatório inválido (incluindo acima de 1e9) devolve o tally intacto.
    const report = cleanCapturaReport(rawReport);
    if (!report) return tally;
    const base = isPlain(tally) ? tally : empty();
    const seenBase = isPlain(base.seen) ? base.seen : { normal: 0, shiny: 0 };
    const name = typeof nick === 'string' ? nick.trim() : '';
    const prev = typeof base.nick === 'string' ? base.nick : '';

    // Outra conta nesta baía: zera o acumulado, mas grava o relatório atual para não gerar delta falso.
    if (name && prev && name !== prev) {
      return {
        normal: 0,
        shiny: 0,
        lastNormalAt: null,
        lastShinyAt: null,
        seen: { normal: report.normal, shiny: report.shiny },
        nick: name,
        melhor: report.melhor || null,
      };
    }

    const dNormal = deltaOf(report.normal, isCount(seenBase.normal) ? seenBase.normal : 0);
    const dShiny = deltaOf(report.shiny, isCount(seenBase.shiny) ? seenBase.shiny : 0);
    return {
      normal: base.normal + dNormal,
      shiny: base.shiny + dShiny,
      lastNormalAt: dNormal > 0 ? now : base.lastNormalAt,
      lastShinyAt: dShiny > 0 ? now : base.lastShinyAt,
      seen: { normal: report.normal, shiny: report.shiny },
      nick: name || prev,
      melhor: strongerOf(base.melhor, report.melhor),
    };
  }

  return { empty, apply, cleanCapturaReport };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaCaptureTally;
