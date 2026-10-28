var MesaAutoHunt = (function () {
  const CONFIRM_MS = 8000;
  let guide = null;
  let guideError = '';
  let guideLoading = false;

  function formatSlug(slug) {
    if (!slug) return '';
    return String(slug).split(/[_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  function mapName(hunt) {
    if (!hunt) return '';
    if (hunt.noCentro) return 'Pokémon Center';
    return hunt.huntName || formatSlug(hunt.huntSlug) || 'sem mapa';
  }

  function accountFrom(hunt) {
    return {
      trainerLevel: Number.isFinite(hunt.trainerLevel) ? hunt.trainerLevel : 0,
      vip: hunt.vip === true,
      xpBonus: hunt.xpBonus || {},
      activePokemon: hunt.active || null,
      huntOptions: (hunt.hunts || []).map((item) => ({
        slug: item.slug,
        name: item.nome,
        level: item.nivel,
        region: item.regiao,
        area: item.area,
        species: item.especies || [],
      })),
    };
  }

  function allowedSlugs(hunt) {
    const allowed = new Set();
    for (const item of hunt.hunts || []) {
      if (item && item.slug) allowed.add(item.slug);
    }
    return allowed;
  }

  function refreshBest(index) {
    const bay = live[index];
    const hunt = bay && bay.hunt;
    if (!guide || !hunt) {
      if (bay) bay.huntBest = null;
      return;
    }
    const account = accountFrom(hunt);
    const sig = MesaHuntRank.signature(account);
    if (sig !== bay.huntSignature) {
      bay.huntSignature = sig;
      bay.huntEstimates = MesaHuntRank.estimate(account, guide);
    }
    bay.huntBest = MesaHuntRank.pick(bay.huntEstimates || [], hunt.huntSlug, allowedSlugs(hunt));
  }

  function pump(index) {
    const bay = live[index];
    const cfgBay = cfg.bays[index];
    if (!bay || !cfgBay || cfgBay.autoHunt !== true || cfgBay.open === false) {
      if (bay) bay.huntPending = null;
      return;
    }
    const hunt = bay.hunt;
    if (!hunt || !hunt.ready || !bay.loggedIn || !webviews[index]) return;
    refreshBest(index);
    const best = bay.huntBest;
    const now = Date.now();
    if (bay.huntPending && now - bay.huntPending.sentAt >= CONFIRM_MS) {
      bay.huntPending = null;
      bay.huntArmedUntil = 0;
    }
    if (bay.huntPending) return;
    if (bay.huntArmedUntil && now < bay.huntArmedUntil) return;
    if (bay.huntRetryAt && now < bay.huntRetryAt) return;
    if (bay.huntHoldUntil && now < bay.huntHoldUntil) return;
    if (!best || !best.move || best.slug === hunt.huntSlug) return;
    if (MesaHuntRank.combatLocked(hunt, now)) return;
    bay.huntWant = best.slug;
    bay.huntArmedUntil = now + CONFIRM_MS;
    try { webviews[index].send('hunt-select', best.slug); }
    catch { bay.huntArmedUntil = 0; bay.huntRetryAt = now + CONFIRM_MS; }
  }

  function paint() {
    if (!ui.autoHunt || !cfg.bays[cfg.selected]) return;
    setChecked(ui.autoHunt, cfg.bays[cfg.selected].autoHunt === true);
    if (!ui.autoHuntStatus) return;
    ui.autoHuntStatus.textContent = status(cfg.selected);
  }

  function status(index) {
    const cfgBay = cfg.bays[index];
    if (!cfgBay || cfgBay.autoHunt !== true) return 'Mapa automático desligado.';
    if (!guide && guideError) return guideError;
    if (!guide) return 'Mapa automático ligado. Lendo o guia de hunts.';
    const bay = live[index];
    if (!bay || !bay.loggedIn || !bay.hunt || !bay.hunt.ready) return 'Mapa automático ligado. Aguardando a conta.';
    const current = mapName(bay.hunt);
    const best = bay.huntBest;
    if (best && best.move && MesaHuntRank.combatLocked(bay.hunt, Date.now())) return 'Aguardando o fim do combate.';
    if (best && best.move) return `Mapa atual: ${current}. Recomendado: ${best.name}.`;
    return `Mapa atual: ${current}.`;
  }

  function loadGuide() {
    if (guide || guideLoading) return;
    if (!window.mesa || typeof window.mesa.huntReference !== 'function') {
      guideError = 'Não foi possível ler o guia de hunts.';
      return;
    }
    guideLoading = true;
    window.mesa.huntReference().then((data) => {
      const parsed = data && !data.error ? MesaHuntRank.read(data) : null;
      if (!parsed) {
        guide = null;
        guideError = (data && data.error) || 'Não foi possível ler o guia de hunts.';
        setTimeout(loadGuide, 30000);
        return;
      }
      guide = parsed;
      guideError = '';
      for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
        if (live[index]) live[index].huntSignature = '';
      }
      tick();
    }).catch(() => {
      guideError = 'Não foi possível ler o guia de hunts.';
      setTimeout(loadGuide, 30000);
    }).finally(() => { guideLoading = false; });
  }

  function tick() {
    for (let index = 0; index < MESA_CATALOG.bays; index += 1) pump(index);
    paint();
  }

  function ingest(index, payload) {
    const bay = live[index];
    if (!bay || !payload || typeof payload !== 'object') return;
    const prev = bay.hunt;
    if (prev && payload.generation !== prev.generation) {
      bay.huntPending = null;
      bay.huntArmedUntil = 0;
    }
    const risingCenter = payload.noCentro === true && !(prev && prev.noCentro);
    bay.hunt = {
      generation: payload.generation,
      ready: payload.ready === true,
      trainerLevel: payload.trainerLevel,
      huntSlug: payload.huntSlug || '',
      huntName: payload.huntName || '',
      noCentro: payload.noCentro === true,
      centroLivreEm: payload.centroLivreEm,
      serverOffsetMs: payload.serverOffsetMs || 0,
      vip: payload.vip === true,
      xpBonus: payload.xpBonus || {},
      active: payload.active || null,
      catalogRev: payload.catalogRev || 0,
      hunts: Array.isArray(payload.hunts) ? payload.hunts : (prev && prev.hunts) || [],
      huntEventSeq: payload.huntEventSeq || 0,
      huntEventSlug: payload.huntEventSlug || '',
    };
    if (risingCenter) {
      bay.huntPending = null;
      if (!MesaHuntRank.combatLocked(bay.hunt, Date.now())) bay.huntHoldUntil = Date.now() + 1500;
    }
    if (bay.huntPending && payload.huntEventSeq > bay.huntPending.seenSeq && payload.huntEventSlug === bay.huntPending.slug) {
      bay.huntPending = null;
      bay.huntArmedUntil = 0;
      bay.huntRetryAt = 0;
    }
    if (payload.send && payload.send.slug) {
      bay.huntArmedUntil = 0;
      if (payload.send.ok === true && bay.huntWant === payload.send.slug) {
        bay.huntPending = { slug: payload.send.slug, sentAt: payload.send.at || Date.now(), seenSeq: bay.hunt.huntEventSeq };
        bay.huntRetryAt = 0;
      } else if (payload.send.ok !== true) {
        bay.huntPending = null;
        bay.huntRetryAt = Date.now() + CONFIRM_MS;
      }
    }
    pump(index);
    paint();
  }

  function clear(index) {
    const bay = live[index];
    if (!bay) return;
    bay.hunt = null;
    bay.huntPending = null;
    bay.huntBest = null;
    bay.huntEstimates = null;
    bay.huntSignature = '';
    bay.huntWant = '';
    bay.huntArmedUntil = 0;
    bay.huntRetryAt = 0;
    bay.huntHoldUntil = 0;
    paint();
  }

  function apply(index, want) {
    if (!cfg.bays[index] || !live[index]) return;
    cfg.bays[index].autoHunt = want === true;
    if (!cfg.bays[index].autoHunt) {
      live[index].huntPending = null;
      live[index].huntBest = null;
      live[index].huntWant = '';
      live[index].huntArmedUntil = 0;
      const webview = webviews[index];
      if (webview && live[index].ready) {
        try { webview.send('hunt-cancel'); } catch { /* a baía está fechando */ }
      }
      return;
    }
    pump(index);
  }

  function start() {
    if (start.began) return;
    start.began = true;
    loadGuide();
    setInterval(tick, 1000);
  }

  return { start, ingest, clear, apply, paint, pump };
}());

function applyAutoHunt(index, want) {
  MesaAutoHunt.apply(index, want);
}
