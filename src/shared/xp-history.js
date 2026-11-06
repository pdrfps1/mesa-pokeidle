var MesaXpHistory = (function xpHistoryModule() {
  const BAYS = 4;
  const MIN_INTERVAL_MS = 10 * 60 * 1000;
  const WINDOW_MS = 24 * 60 * 60 * 1000;

  function empty() {
    return { v: 1, bays: [[], [], [], []] };
  }

  function normalizePoint(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const t = Number(raw.t);
    const xpH = Number(raw.xpH);
    if (!Number.isFinite(t) || !Number.isFinite(xpH)) return null;
    return { t, xpH };
  }

  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.v !== 1) return empty();
    const bays = [];
    for (let index = 0; index < BAYS; index += 1) {
      const rawSeries = Array.isArray(input.bays) ? input.bays[index] : null;
      const series = [];
      if (Array.isArray(rawSeries)) {
        for (const item of rawSeries) {
          const point = normalizePoint(item);
          if (point) series.push(point);
        }
      }
      series.sort((a, b) => a.t - b.t);
      bays.push(series);
    }
    return { v: 1, bays };
  }

  function parseJson(text) {
    try {
      return normalize(JSON.parse(text));
    } catch {
      return empty();
    }
  }

  function pruneSeries(series, now) {
    if (!Array.isArray(series)) return [];
    const cutoff = now - WINDOW_MS;
    while (series.length && series[0].t < cutoff) series.shift();
    return series;
  }

  function appendPoint(doc, bayIndex, t, xpH, loggedIn) {
    const next = normalize(doc);
    const index = Number(bayIndex);
    if (!Number.isInteger(index) || index < 0 || index >= BAYS) return { doc: next, added: false };
    if (!loggedIn) return { doc: next, added: false };
    if (!Number.isFinite(xpH)) return { doc: next, added: false };
    const when = Number(t);
    if (!Number.isFinite(when)) return { doc: next, added: false };
    const series = next.bays[index];
    if (series.length && when - series[series.length - 1].t < MIN_INTERVAL_MS) {
      return { doc: next, added: false };
    }
    series.push({ t: when, xpH });
    pruneSeries(series, when);
    return { doc: next, added: true };
  }

  return {
    BAYS,
    MIN_INTERVAL_MS,
    WINDOW_MS,
    empty,
    normalize,
    parseJson,
    pruneSeries,
    appendPoint,
  };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaXpHistory;
