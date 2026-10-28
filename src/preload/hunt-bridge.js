function installHuntBridge(ipc) {
  const { contextBridge } = require('electron');
  const SLUG = /^[A-Za-z0-9_-]{1,64}$/;
  const IVS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];
  let queued = '';
  let lastRev = -1;
  let stamps = 0;
  let windowStart = 0;

  function slugOf(value) {
    return typeof value === 'string' && SLUG.test(value) ? value : '';
  }

  function nameOf(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
  }

  function intOf(value, min, max) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) return null;
    return value;
  }

  function pctOf(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 500) return 0;
    return value;
  }

  function allowReport() {
    const now = Date.now();
    if (now - windowStart > 1000) {
      windowStart = now;
      stamps = 0;
    }
    stamps += 1;
    return stamps <= 30;
  }

  function cleanIvs(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const ivs = {};
    for (const key of IVS) {
      const value = intOf(raw[key], 0, 100);
      if (value == null) return null;
      ivs[key] = value;
    }
    return ivs;
  }

  function cleanActive(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const speciesId = intOf(raw.speciesId, 1, 1000000);
    const level = intOf(raw.level, 1, 1000000);
    if (speciesId == null || level == null) return null;
    const quality = typeof raw.quality === 'number' && Number.isFinite(raw.quality) && raw.quality >= 0 && raw.quality <= 100
      ? raw.quality
      : null;
    return {
      speciesId,
      level,
      quality,
      potency: intOf(raw.potency, 1, 5),
      shiny: raw.shiny === true,
      ivs: cleanIvs(raw.ivs),
    };
  }

  function cleanHunt(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const slug = slugOf(raw.slug);
    if (!slug) return null;
    const especies = [];
    const source = Array.isArray(raw.especies) ? raw.especies.slice(0, 30) : [];
    for (const entry of source) {
      if (!entry || typeof entry !== 'object') continue;
      const speciesId = intOf(entry.speciesId, 1, 1000000);
      const weight = typeof entry.weight === 'number' && Number.isFinite(entry.weight) && entry.weight >= 0 && entry.weight <= 1000000
        ? entry.weight
        : null;
      if (speciesId == null || weight == null) continue;
      especies.push({ speciesId, weight });
    }
    return {
      slug,
      nome: nameOf(raw.nome),
      nivel: intOf(raw.nivel, 0, 1000000),
      area: nameOf(raw.area),
      regiao: nameOf(raw.regiao),
      especies,
    };
  }

  function cleanBonus(raw) {
    const bonus = raw && typeof raw === 'object' ? raw : {};
    return {
      guildRankPct: pctOf(bonus.guildRankPct),
      guildBoostActive: bonus.guildBoostActive === true,
      twitchPct: pctOf(bonus.twitchPct),
      eventTrainerPct: pctOf(bonus.eventTrainerPct),
      eventPokemonPct: pctOf(bonus.eventPokemonPct),
    };
  }

  function cleanSummary(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const offset = typeof raw.serverOffsetMs === 'number' && Number.isFinite(raw.serverOffsetMs) && Math.abs(raw.serverOffsetMs) <= 1e12
      ? raw.serverOffsetMs
      : 0;
    const summary = {
      generation: intOf(raw.generation, 0, Number.MAX_SAFE_INTEGER) || 0,
      ready: raw.ready === true,
      trainerLevel: intOf(raw.trainerLevel, 0, 1000000),
      huntSlug: slugOf(raw.huntSlug),
      huntName: nameOf(raw.huntName),
      noCentro: raw.noCentro === true,
      centroLivreEm: intOf(raw.centroLivreEm, 0, Number.MAX_SAFE_INTEGER),
      serverOffsetMs: offset,
      vip: raw.vip === true,
      xpBonus: cleanBonus(raw.xpBonus),
      active: cleanActive(raw.active),
      catalogRev: intOf(raw.catalogRev, 0, Number.MAX_SAFE_INTEGER) || 0,
      huntEventSeq: intOf(raw.huntEventSeq, 0, Number.MAX_SAFE_INTEGER) || 0,
      huntEventSlug: slugOf(raw.huntEventSlug),
    };
    if (Array.isArray(raw.hunts)) summary.hunts = raw.hunts.slice(0, 800).map(cleanHunt).filter(Boolean);
    const sendSlug = raw.send && typeof raw.send === 'object' ? slugOf(raw.send.slug) : '';
    if (sendSlug) {
      summary.send = {
        slug: sendSlug,
        ok: raw.send.ok === true,
        at: intOf(raw.send.at, 0, Number.MAX_SAFE_INTEGER) || Date.now(),
      };
    }
    return summary;
  }

  function accept(raw) {
    let clean;
    try { clean = cleanSummary(raw); } catch { return; }
    if (!clean) return;
    if (!clean.send && !allowReport()) return;
    if (Array.isArray(clean.hunts)) {
      if (clean.catalogRev === lastRev) delete clean.hunts;
      else lastRev = clean.catalogRev;
    }
    try { ipc.sendToHost('hunt', clean); } catch { /* a baía está fechando */ }
  }

  ipc.on('hunt-select', (_event, slug) => {
    const clean = slugOf(slug);
    if (clean) queued = clean;
  });
  ipc.on('hunt-cancel', () => { queued = ''; });

  function acceptLive(raw) {
    let clean;
    try { clean = sanitizeLivePatch(raw); } catch { return; }
    if (!clean) return;
    try { ipc.send('live:frame', clean); } catch { /* a baía está fechando */ }
  }

  try {
    contextBridge.exposeInMainWorld('__mesaHunt', {
      report(raw) { accept(raw); },
      live(raw) { acceptLive(raw); },
      pull() {
        const slug = queued;
        queued = '';
        return slug;
      },
    });
  } catch { /* a página já recebeu a ponte neste documento */ }
}
