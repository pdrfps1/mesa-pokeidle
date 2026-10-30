function createSwitchGate(state) {
  const alive = new Set();
  let sawSpawn = false;

  function slotOf(event) {
    if (!event || typeof event !== 'object') return null;
    const raw = Number.isInteger(event.s) ? event.s : (Number.isInteger(event.slot) ? event.slot : null);
    if (raw == null || raw < 0 || raw > 999) return null;
    return raw;
  }

  function resetWave() {
    alive.clear();
    sawSpawn = false;
    state.waveClear = false;
    state._spawnOndaAtual = false;
  }

  function inHuntEstado(estado) {
    if (!estado || typeof estado !== 'object') return false;
    const arena = estado.boss && typeof estado.boss === 'object' ? estado.boss.arena : null;
    const emCasa = estado.casa && typeof estado.casa === 'object' ? estado.casa.dentro === true : false;
    const safariDentro = estado.safari && typeof estado.safari === 'object' ? estado.safari.dentro === true : false;
    const huntSlug = typeof estado.huntSlug === 'string' && estado.huntSlug;
    return (!!huntSlug || safariDentro) && estado.noCentro !== true && !emCasa && !arena;
  }

  function applyEstado(estado, slugOf) {
    if (!estado || typeof estado !== 'object') return;
    const prevSlug = state.huntSlug;
    const prevCentro = state.noCentro;
    const prevSafari = state.safariDentro;
    if (estado.safari && typeof estado.safari === 'object' && typeof estado.safari.dentro === 'boolean') {
      state.safariDentro = estado.safari.dentro;
    }
    const slug = slugOf(estado.huntSlug);
    const risingHunt = slug && slug !== prevSlug;
    const risingCentro = estado.noCentro === true && !prevCentro;
    const safariChanged = state.safariDentro !== prevSafari;
    if (risingHunt || risingCentro || safariChanged) resetWave();
    if (inHuntEstado(estado)) {
      if (Number.isInteger(estado.ondaSeq) && estado.ondaSeq >= 0) state.ondaSeq = estado.ondaSeq;
      if (Number.isInteger(estado.combateOndaSeq) && estado.combateOndaSeq >= 0) {
        state.combateOndaSeq = estado.combateOndaSeq;
      }
    } else {
      state.ondaSeq = 0;
      state.combateOndaSeq = 0;
      resetWave();
    }
  }

  function trocaFrom(event) {
    if (!event || typeof event !== 'object') return;
    if (Number.isInteger(event.trocaLivreEm) && event.trocaLivreEm >= 0) {
      state.trocaHuntLivreEm = event.trocaLivreEm;
    }
  }

  function applyEvent(event, slugOf) {
    if (!event || typeof event !== 'object') return;
    if (event.k === 'hunt') {
      trocaFrom(event);
      const slug = slugOf(event.slug);
      if (slug && slug !== state.huntSlug) resetWave();
      return;
    }
    if (event.k === 'safariEntrou') {
      trocaFrom(event);
      resetWave();
      return;
    }
    if (event.k === 'centro') {
      resetWave();
      return;
    }
    if (event.k === 'spawn') {
      if (state.huntSlug && !state.noCentro && !state._spawnOndaAtual) {
        state.ondaSeq = (Number.isInteger(state.ondaSeq) ? state.ondaSeq : 0) + 1;
        state._spawnOndaAtual = true;
        state.waveClear = false;
      }
      const slot = slotOf(event);
      if (slot == null) return;
      alive.add(slot);
      sawSpawn = true;
      state.waveClear = false;
      return;
    }
    if (event.k === 'ataque') {
      if (state.huntSlug && !state.noCentro) {
        state.combateOndaSeq = Number.isInteger(state.ondaSeq) ? state.ondaSeq : 0;
      }
      return;
    }
    if (event.k === 'morte' && event.quem === 'selvagem') {
      const slot = slotOf(event);
      if (slot == null) return;
      alive.delete(slot);
      if (sawSpawn && alive.size === 0) {
        state.waveClear = true;
        state._spawnOndaAtual = false;
      }
    }
  }

  return { applyEstado, applyEvent, resetWave };
}
