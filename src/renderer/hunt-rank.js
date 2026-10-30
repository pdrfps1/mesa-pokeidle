var MesaHuntRank = (function () {
  const QUALITY_EXPONENT = [0.95, 0.8, 0.8, 0.8, 0.8, 0.95];
  const POTENCY_BONUS = [0, 0.05, 0.1, 0.25, 1];
  const IV_KEYS = ['hp', 'atk', 'def', 'spAtk', 'spDef', 'speed'];

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function speciesById(reference) {
    return new Map(reference.especies.map((species) => [species.id, species]));
  }

  function gameXpPerKill(level) {
    return level <= 150
      ? Math.floor(0.6 * level * level) + 8
      : Math.floor(13500 * (level / 150) ** 1.25);
  }

  function gameGoldPerKill(level) {
    return Math.round(36 * Math.min(level, 25000) ** 0.6007);
  }

  function adjustedEffectiveness(value) {
    if (value > 1) return 1 + (value - 1) * 1.5;
    if (value < 1) return value / 1.5;
    return 1;
  }

  function ivsComplete(ivs) {
    return !!ivs && IV_KEYS.every((key) => finite(ivs[key]));
  }

  function activeStats(account, activeSpecies) {
    const active = account.activePokemon;
    const ivs = active.ivs;
    if (!ivsComplete(ivs)) return null;
    const quality = active.quality;
    const potency = active.potency;
    if (!finite(quality) || !potency || potency < 1 || potency > 5) return null;
    const factor = (1 + POTENCY_BONUS[potency - 1]) * (active.shiny ? 3 : 1);
    return activeSpecies.b.slice(0, 6).map((base, index) => {
      const iv = ivs[IV_KEYS[index]];
      return Math.round((base + 2 * iv) * active.level / 100 * quality ** QUALITY_EXPONENT[index] * factor);
    });
  }

  function attackDamage(level, power, attack, defense, stab, effectiveness) {
    return ((((2 * level / 5 + 2) * power * Math.max(1, attack) / Math.max(1, defense)) / 50) + 2)
      * (stab ? 1.5 : 1) * adjustedEffectiveness(effectiveness) * 0.925;
  }

  function dpsAgainst(account, activeSpecies, stats, wild, wildLevel, typeChart) {
    const level = account.activePokemon.level;
    const ivSpeed = account.activePokemon.ivs.speed;
    const moves = activeSpecies.m.filter((move) => move[5] <= level);
    let dps = 0;
    let attacksPerSecond = 0;
    const tackleMultiplier = wild.t.reduce((total, type) => total * (typeChart.NORMAL?.[type] ?? 1), 1);
    const tackleDamage = attackDamage(
      level,
      30,
      stats[1],
      (wild.b[2] + 32) * wildLevel / 100,
      activeSpecies.t.includes('NORMAL'),
      tackleMultiplier,
    );
    for (const move of moves) {
      const moveType = move[1];
      const special = move[2];
      const power = move[3];
      const cooldownMs = move[4];
      const attack = stats[special ? 3 : 1];
      const defense = (special ? wild.b[4] : wild.b[2]) + 32;
      const multiplier = wild.t.reduce((total, type) => total * (typeChart[moveType]?.[type] ?? 1), 1);
      const cooldown = Math.max(400, cooldownMs - Math.min(32, Math.max(1, Math.round(ivSpeed))) * 10) / 1000;
      const stab = activeSpecies.t.includes(moveType);
      dps += attackDamage(level, power, attack, defense * wildLevel / 100, stab, multiplier) / cooldown;
      attacksPerSecond += 1 / cooldown;
    }
    const tackleRate = Math.max(0, 1 - attacksPerSecond * 0.9) / 2;
    return dps + tackleDamage * tackleRate;
  }

  function bonusMultiplier(account, trainer) {
    const xp = account.xpBonus || {};
    return (account.vip ? 1.5 : 1)
      * (1 + (xp.guildRankPct || 0) / 100)
      * (xp.guildBoostActive ? 1.1 : 1)
      * (1 + (xp.twitchPct || 0) / 100)
      * (1 + ((trainer ? xp.eventTrainerPct : xp.eventPokemonPct) || 0) / 100);
  }

  function signature(account) {
    const active = account.activePokemon;
    const xp = account.xpBonus || {};
    return JSON.stringify([
      account.trainerLevel,
      account.vip === true,
      active ? [
        active.speciesId,
        active.level,
        active.quality,
        active.potency,
        active.shiny === true,
        active.ivs && active.ivs.hp,
        active.ivs && active.ivs.atk,
        active.ivs && active.ivs.def,
        active.ivs && active.ivs.spAtk,
        active.ivs && active.ivs.spDef,
        active.ivs && active.ivs.speed,
      ] : null,
      [xp.guildRankPct, xp.guildBoostActive, xp.twitchPct, xp.eventTrainerPct, xp.eventPokemonPct],
      (account.huntOptions || []).map((hunt) => [
        hunt.slug,
        hunt.level,
        hunt.name,
        hunt.region,
        hunt.area,
        (hunt.species || []).map((species) => [species.speciesId, species.weight]),
      ]),
    ]);
  }

  function estimate(account, reference) {
    const active = account.activePokemon;
    if (!active || !finite(active.speciesId) || !ivsComplete(active.ivs) || !finite(active.quality) || !active.potency) return [];
    const species = speciesById(reference);
    const activeSpecies = species.get(active.speciesId);
    const stats = activeSpecies && activeStats(account, activeSpecies);
    if (!activeSpecies || !stats) return [];
    const rankXpTrainer = bonusMultiplier(account, true);
    const rankXpPokemon = bonusMultiplier(account, false);
    const accountHunts = new Map((account.huntOptions || []).map((hunt) => [hunt.slug, hunt]));
    const accountCatalog = reference.hunts.filter((hunt) => accountHunts.has(hunt.s));
    const available = accountCatalog.length ? accountCatalog : reference.hunts;
    const trainerLevel = account.trainerLevel || 0;
    const results = [];
    for (const hunt of available) {
      const observed = accountHunts.get(hunt.s);
      if ((observed && finite(observed.level) ? observed.level : hunt.nv) > trainerLevel) continue;
      const remote = observed && Array.isArray(observed.species)
        ? observed.species.filter((entry) => finite(entry.speciesId) && finite(entry.weight)).map((entry) => [entry.speciesId, entry.weight])
        : null;
      let composition = remote && remote.length ? remote : hunt.e;
      if (composition.length && !composition.some(([id]) => species.has(id))) composition = hunt.e;
      if (!composition.length) continue;
      const spawnList = composition
        .map(([id, weight]) => ({ species: species.get(id), weight: Math.max(0, weight) }))
        .filter((spawn) => spawn.species && spawn.weight > 0);
      const totalWeight = spawnList.reduce((total, spawn) => total + spawn.weight, 0);
      if (!totalWeight) continue;
      const wildLevel = observed && finite(observed.level) ? observed.level : hunt.nv;
      let weightedKillSeconds = 0;
      let weightedLootGold = 0;
      let weightedXp = 0;
      let primary = spawnList[0];
      for (const spawn of spawnList) {
        if (spawn.weight > primary.weight) primary = spawn;
        const hp = Math.max(24, ((spawn.species.b[0] + 32) * wildLevel / 100) * 12 * 5);
        const dps = Math.max(1, dpsAgainst(account, activeSpecies, stats, spawn.species, wildLevel, reference.tipos));
        const ratio = spawn.weight / totalWeight;
        weightedKillSeconds += Math.max(0.9, hp / dps) * ratio;
        weightedXp += gameXpPerKill(wildLevel) * ratio;
        const dropValue = (spawn.species.l || []).reduce((sum, loot) => sum + loot[1] / 100 * ((loot[2] + loot[3]) / 2) * loot[4], 0);
        weightedLootGold += dropValue * ratio;
      }
      const secondsPerKill = weightedKillSeconds + 2.8;
      const killsPerHour = Math.min(3600 / secondsPerKill, wildLevel < 20 ? 3600 / 4.2 : 3600 / 3.2);
      const xp = weightedXp * killsPerHour;
      results.push({
        hunt: {
          s: hunt.s,
          n: (observed && observed.name) || hunt.n,
          a: (observed && (observed.region || observed.area)) || hunt.a,
          nv: wildLevel,
        },
        xpTrainerPerHour: Math.round(xp * rankXpTrainer),
        xpPokemonPerHour: Math.round(xp * rankXpPokemon),
        goldPerHour: Math.round((gameGoldPerKill(wildLevel) + weightedLootGold) * killsPerHour),
        killsPerHour: Math.round(killsPerHour),
        secondsPerKill: Math.round(secondsPerKill * 10) / 10,
      });
    }
    return results;
  }

  function pick(estimates, currentSlug, allowed) {
    let best = null;
    let current = null;
    for (const item of estimates || []) {
      if (!item || !item.hunt || !allowed || !allowed.has(item.hunt.s)) continue;
      if (!best || item.xpTrainerPerHour > best.xpTrainerPerHour) best = item;
      if (item.hunt.s === currentSlug) current = item;
    }
    if (!best) return null;
    if (best.hunt.s === currentSlug) {
      return { slug: best.hunt.s, name: best.hunt.n, xp: best.xpTrainerPerHour, move: false };
    }
    if (current && best.xpTrainerPerHour * 100 <= current.xpTrainerPerHour * 108) {
      return { slug: current.hunt.s, name: current.hunt.n, xp: current.xpTrainerPerHour, move: false };
    }
    return { slug: best.hunt.s, name: best.hunt.n, xp: best.xpTrainerPerHour, move: true };
  }

  function combatLocked(summary, now) {
    if (!summary || !finite(summary.centroLivreEm)) return false;
    const offset = finite(summary.serverOffsetMs) ? summary.serverOffsetMs : 0;
    return now + offset < summary.centroLivreEm;
  }

  function serverNow(summary, now) {
    const offset = finite(summary.serverOffsetMs) ? summary.serverOffsetMs : 0;
    return now + offset;
  }

  function switchBlocked(summary, now) {
    if (!summary) return false;
    if (summary.safariDentro === true) return true;
    if (finite(summary.trocaHuntLivreEm) && serverNow(summary, now) < summary.trocaHuntLivreEm) return true;
    if (summary.semCena === true) return combatLocked(summary, now);
    if (summary.waveClear === true) return false;
    if (finite(summary.combateOndaSeq) && finite(summary.ondaSeq) && summary.combateOndaSeq < summary.ondaSeq) {
      return false;
    }
    return combatLocked(summary, now);
  }

  function switchBlockedReason(summary, now) {
    if (!switchBlocked(summary, now)) return '';
    if (summary.safariDentro === true) return 'Aguardando sair do Safari.';
    if (finite(summary.trocaHuntLivreEm) && serverNow(summary, now) < summary.trocaHuntLivreEm) {
      return 'Aguardando a pausa do jogo para trocar de mapa.';
    }
    return 'Aguardando o fim do combate.';
  }

  function moveOk(move) {
    return Array.isArray(move) && move.length >= 6
      && typeof move[0] === 'string' && typeof move[1] === 'string'
      && [move[2], move[3], move[4], move[5]].every(finite);
  }

  function lootOk(loot) {
    return Array.isArray(loot) && typeof loot[0] === 'string' && [loot[1], loot[2], loot[3], loot[4]].every(finite);
  }

  function read(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!Array.isArray(value.especies) || !Array.isArray(value.hunts) || !value.tipos || typeof value.tipos !== 'object') return null;
    const typeRows = Object.values(value.tipos);
    if (!typeRows.length || !typeRows.every((row) => row && typeof row === 'object' && Object.values(row).every(finite))) return null;
    const especies = value.especies.filter((item) => item && finite(item.id) && typeof item.n === 'string'
      && Array.isArray(item.t) && item.t.every((type) => typeof type === 'string')
      && Array.isArray(item.b) && item.b.length >= 6 && item.b.slice(0, 6).every(finite)
      && Array.isArray(item.m) && item.m.every(moveOk)
      && (item.l == null || (Array.isArray(item.l) && item.l.every(lootOk))));
    const hunts = value.hunts.filter((item) => item && typeof item.s === 'string' && typeof item.n === 'string'
      && typeof item.a === 'string' && finite(item.nv)
      && Array.isArray(item.e) && item.e.every((spawn) => Array.isArray(spawn) && spawn.length >= 2 && finite(spawn[0]) && finite(spawn[1])));
    if (!especies.length || !hunts.length) return null;
    return { tipos: value.tipos, especies, hunts };
  }

  return { read, estimate, signature, pick, combatLocked, switchBlocked, switchBlockedReason, bonusMultiplier };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaHuntRank;
