var MesaStatus = (function statusModule() {
  function parseXp(text) {
    const match = String(text || '').match(/([\d.]+)\s*\/\s*([\d.]+)/);
    if (!match) return null;
    return {
      cur: Number(match[1].replace(/\./g, '')),
      max: Number(match[2].replace(/\./g, '')),
    };
  }

  function pushSample(bay, xp) {
    const now = Date.now();
    if (bay.lastXp) {
      let delta = xp.cur - bay.lastXp.cur;
      if (delta < 0) delta = bay.lastXp.max - bay.lastXp.cur + xp.cur;
      if (delta > 0) bay.gained += delta;
    }
    bay.lastXp = xp;
    bay.samples.push([now, bay.gained]);
    while (bay.samples.length && now - bay.samples[0][0] > 10 * 60 * 1000) bay.samples.shift();
  }

  function perHour(bay) {
    const samples = bay.samples;
    if (!samples || samples.length < 2) return null;
    const [startAt, startGain] = samples[0];
    const [endAt, endGain] = samples[samples.length - 1];
    if (endAt - startAt < 30000) return null;
    return ((endGain - startGain) / (endAt - startAt)) * 3600000;
  }

  function classify(bays) {
    const counts = { cacando: 0, medindo: 0, paradas: 0, sem: 0, grade: 0 };
    const rates = bays.map((bay) => {
      if (bay.skip) return null;
      counts.grade += 1;
      if (!bay.loggedIn) {
        counts.sem += 1;
        return null;
      }
      if (bay.rate == null) {
        counts.medindo += 1;
        return null;
      }
      if (bay.rate > 0) {
        counts.cacando += 1;
        return bay.rate;
      }
      counts.paradas += 1;
      return bay.rate;
    });
    return { counts, rates };
  }

  function fmtXp(value) {
    if (value == null || Number.isNaN(value)) return { rounded: null, text: '\u2013' };
    const rounded = Math.round(value);
    const sign = rounded < 0 ? '−' : '+';
    const body = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.abs(rounded));
    return { rounded, text: sign + body };
  }

  function finding(counts, rates) {
    const parts = rates.filter((rate) => rate != null).map((rate) => Math.round(rate));
    const sum = parts.reduce((total, part) => total + part, 0);
    const xp = parts.length ? `${fmtXp(sum).text} XP/h nas baías já medidas` : 'XP/h ainda sem amostra';
    if (counts.grade > 0 && counts.sem === counts.grade) return 'Nenhuma baía entrou. O login é na página do jogo, com a conta local.';
    if (counts.paradas > 0) {
      const noun = counts.paradas === 1 ? '1 baía parada' : `${counts.paradas} baías paradas`;
      return `${noun}. ${xp}.`;
    }
    if (counts.cacando === 4) return `As quatro estão caçando. ${xp}.`;
    if (counts.cacando > 0) return `${counts.cacando} caçando e ${counts.medindo} medindo. ${xp}.`;
    return `${counts.medindo} na mesa, medindo o XP/h.`;
  }

  const check = classify([
    { loggedIn: true, rate: 1000.4 },
    { loggedIn: true, rate: 0 },
    { loggedIn: true, rate: null },
    { loggedIn: false, rate: null },
  ]);
  const shown = check.rates.filter((rate) => rate != null).map((rate) => fmtXp(rate).rounded);
  const desk = fmtXp(shown.reduce((total, part) => total + part, 0)).rounded;
  if (check.counts.cacando !== 1 || check.counts.paradas !== 1 || check.counts.medindo !== 1 || check.counts.sem !== 1 || check.counts.grade !== 4) {
    throw new Error('A classificação das baías não confere.');
  }
  if (desk !== shown.reduce((total, part) => total + part, 0)) {
    throw new Error('O XP/h da mesa não fecha com a soma das baías.');
  }

  return { parseXp, pushSample, perHour, classify, fmtXp, finding };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaStatus;
