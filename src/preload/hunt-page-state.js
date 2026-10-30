function createHuntReader() {
  const SLUG = /^[A-Za-z0-9_-]{1,64}$/;
  const IVS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];
  let catalogDirty = false;
  const state = {
    ready: false,
    trainerLevel: null,
    huntSlug: '',
    huntName: '',
    noCentro: false,
    centroLivreEm: null,
    servidorAgora: null,
    serverOffsetMs: 0,
    vipFlag: null,
    vipUntil: null,
    eventTrainerPct: 0,
    eventPokemonPct: 0,
    guildRankPct: 0,
    guildBoostUntil: null,
    twitchPct: 0,
    activeId: null,
    pokemons: new Map(),
    hunts: [],
    huntsKey: null,
    catalogRev: 0,
    huntEventSeq: 0,
    huntEventSlug: '',
    ondaSeq: 0,
    combateOndaSeq: 0,
    trocaHuntLivreEm: null,
    waveClear: false,
    safariDentro: false,
    _spawnOndaAtual: false,
  };

  const switchGate = createSwitchGate(state);

  function slugOf(value) {
    return typeof value === 'string' && SLUG.test(value) ? value : '';
  }

  function nameOf(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80);
  }

  function pct(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 500) return null;
    return value;
  }

  function nameFor(slug) {
    const hunt = state.hunts.find((item) => item.slug === slug);
    return hunt ? hunt.nome : '';
  }

  function readIvs(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const ivs = {};
    for (const key of IVS) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      if (!Number.isInteger(raw[key]) || raw[key] < 0 || raw[key] > 100) return null;
      ivs[key] = raw[key];
    }
    return IVS.every((key) => Number.isInteger(ivs[key])) ? ivs : null;
  }

  function keepPokemon(raw) {
    if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.id)) return null;
    return {
      id: raw.id,
      level: Number.isInteger(raw.level) ? raw.level : null,
      quality: typeof raw.quality === 'number' && Number.isFinite(raw.quality) ? raw.quality : null,
      potency: Number.isInteger(raw.potencia) ? raw.potencia : null,
      shiny: raw.shiny === true,
      speciesId: Number.isInteger(raw.speciesId) ? raw.speciesId : null,
      ivs: readIvs(raw.ivs),
    };
  }

  function replacePokemons(list) {
    const next = new Map();
    for (const raw of list) {
      const pokemon = keepPokemon(raw);
      if (!pokemon) continue;
      next.set(pokemon.id, pokemon);
      if (next.size >= 800) break;
    }
    state.pokemons = next;
  }

  function patchPokemons(list) {
    for (const raw of list.slice(0, 80)) {
      if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.id)) continue;
      const pokemon = state.pokemons.get(raw.id);
      if (!pokemon) continue;
      if (Number.isInteger(raw.level)) pokemon.level = raw.level;
      if (typeof raw.quality === 'number' && Number.isFinite(raw.quality)) pokemon.quality = raw.quality;
      if (Number.isInteger(raw.potencia)) pokemon.potency = raw.potencia;
      if (typeof raw.shiny === 'boolean') pokemon.shiny = raw.shiny;
      if (Number.isInteger(raw.speciesId)) pokemon.speciesId = raw.speciesId;
      if (!raw.ivs || typeof raw.ivs !== 'object') continue;
      const merged = Object.assign({}, pokemon.ivs || {});
      for (const key of IVS) {
        if (!Object.prototype.hasOwnProperty.call(raw.ivs, key)) continue;
        if (!Number.isInteger(raw.ivs[key]) || raw.ivs[key] < 0 || raw.ivs[key] > 100) continue;
        merged[key] = raw.ivs[key];
      }
      if (IVS.every((key) => Number.isInteger(merged[key]))) pokemon.ivs = merged;
    }
  }

  function normalizeHunt(hunt) {
    if (!hunt || typeof hunt !== 'object') return null;
    const slug = slugOf(hunt.slug);
    if (!slug) return null;
    const especies = [];
    const source = Array.isArray(hunt.especies) ? hunt.especies : [];
    for (const entry of source) {
      if (!entry || typeof entry !== 'object') continue;
      const speciesId = Number.isInteger(entry.pokeId) ? entry.pokeId
        : (Number.isInteger(entry.speciesId) ? entry.speciesId : (Number.isInteger(entry.id) ? entry.id : null));
      const weight = typeof entry.pontos === 'number' ? entry.pontos
        : (typeof entry.weight === 'number' ? entry.weight : (typeof entry.peso === 'number' ? entry.peso : null));
      if (speciesId == null || weight == null || !Number.isFinite(weight) || weight < 0) continue;
      especies.push({ speciesId, weight });
      if (especies.length >= 30) break;
    }
    return {
      slug,
      nome: nameOf(hunt.nome),
      nivel: Number.isInteger(hunt.nivel) ? hunt.nivel : null,
      area: nameOf(hunt.area),
      regiao: nameOf(hunt.regiao),
      especies,
    };
  }

  function takeHunts(list) {
    const next = [];
    if (Array.isArray(list)) {
      for (const hunt of list) {
        const clean = normalizeHunt(hunt);
        if (!clean) continue;
        next.push(clean);
        if (next.length >= 800) break;
      }
    }
    const key = next.map((hunt) => `${hunt.slug}:${hunt.nivel}:${hunt.especies.map((species) => `${species.speciesId}=${species.weight}`).join(',')}`).join('|');
    if (key === state.huntsKey) return;
    state.huntsKey = key;
    state.catalogRev += 1;
    state.hunts = next;
    catalogDirty = true;
    if (!state.huntName && state.huntSlug) state.huntName = nameFor(state.huntSlug);
  }

  function applyTwitch(twitch) {
    if (twitch.assistindo === false) { state.twitchPct = 0; return; }
    const current = pct(twitch.pctAtual);
    const fallback = pct(twitch.pct);
    if (twitch.assistindo === true) state.twitchPct = current != null ? current : (fallback != null ? fallback : 0);
    else if (current != null) state.twitchPct = current;
    else if (fallback != null) state.twitchPct = fallback;
  }

  function applyEstado(estado, initializeHunt) {
    if (!estado || typeof estado !== 'object') return;
    if (Number.isInteger(estado.level) && estado.level >= 0) state.trainerLevel = estado.level;
    if (Number.isInteger(estado.servidorAgora) && estado.servidorAgora !== state.servidorAgora) {
      state.servidorAgora = estado.servidorAgora;
      state.serverOffsetMs = estado.servidorAgora - Date.now();
    }
    if (estado.evento && typeof estado.evento === 'object') {
      const trainer = pct(estado.evento.xpTreinadorPct);
      const pokemon = pct(estado.evento.xpPokemonPct);
      if (trainer != null) state.eventTrainerPct = trainer;
      if (pokemon != null) state.eventPokemonPct = pokemon;
    }
    if (Object.prototype.hasOwnProperty.call(estado, 'guildBonusPct')) {
      const guild = pct(estado.guildBonusPct);
      if (guild != null) state.guildRankPct = guild;
    }
    if (estado.guild && typeof estado.guild === 'object' && Number.isInteger(estado.guild.boostAte)) {
      state.guildBoostUntil = estado.guild.boostAte;
    }
    if (estado.twitch && typeof estado.twitch === 'object') applyTwitch(estado.twitch);
    if (Number.isInteger(estado.centroLivreEm)) state.centroLivreEm = estado.centroLivreEm;
    if (estado.loja && typeof estado.loja === 'object') {
      if (typeof estado.loja.vip === 'boolean') state.vipFlag = estado.loja.vip;
      if (Number.isInteger(estado.loja.vipAte)) state.vipUntil = estado.loja.vipAte;
    }
    if (Number.isInteger(estado.vipAte)) state.vipUntil = estado.vipAte;
    if (initializeHunt) {
      const slug = slugOf(estado.huntSlug);
      if (slug) {
        state.huntSlug = slug;
        state.huntName = nameFor(slug) || state.huntName;
      }
    }
    if (typeof estado.noCentro === 'boolean') state.noCentro = estado.noCentro;
    if (Number.isInteger(estado.activeId)) state.activeId = estado.activeId;
    if (Array.isArray(estado.pokemons)) replacePokemons(estado.pokemons);
    if (Array.isArray(estado.pkMud)) patchPokemons(estado.pkMud);
    switchGate.applyEstado(estado, slugOf);
  }

  function applyBattle(frame) {
    const events = frame && Array.isArray(frame.ev) ? frame.ev : [];
    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      switchGate.applyEvent(event, slugOf);
      if (event.k === 'hunt') {
        const slug = slugOf(event.slug);
        if (!slug) continue;
        state.huntSlug = slug;
        state.huntName = nameOf(event.nome) || nameFor(slug);
        state.noCentro = false;
        state.huntEventSeq += 1;
        state.huntEventSlug = slug;
      } else if (event.k === 'centro') {
        state.noCentro = true;
      }
    }
  }

  function vipNow() {
    if (typeof state.vipFlag === 'boolean') return state.vipFlag;
    if (state.vipUntil != null && state.servidorAgora != null) return state.vipUntil > state.servidorAgora;
    return false;
  }

  function activeSummary() {
    const pokemon = state.pokemons.get(state.activeId);
    if (!pokemon || !Number.isInteger(pokemon.speciesId) || !Number.isInteger(pokemon.level)) return null;
    const ivs = pokemon.ivs && IVS.every((key) => Number.isInteger(pokemon.ivs[key])) ? pokemon.ivs : null;
    return {
      speciesId: pokemon.speciesId,
      level: pokemon.level,
      quality: pokemon.quality,
      potency: pokemon.potency,
      shiny: pokemon.shiny === true,
      ivs: ivs ? {
        hp: ivs.hp, atk: ivs.atk, def: ivs.def, spAtk: ivs.spAtk, spDef: ivs.spDef, speed: ivs.speed,
      } : null,
    };
  }

  return {
    state,
    slugOf,
    nameFor,
    applyEstado,
    applyBattle,
    takeHunts,
    vipNow,
    activeSummary,
    isDirty: () => catalogDirty,
    clearDirty: () => { catalogDirty = false; },
  };
}
