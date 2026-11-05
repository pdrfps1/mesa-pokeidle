// Extrai o bloco da Twitch e da Kick do estado do jogo, sem validar: a validação fica no main.
function livePatchFromEstado(estado, completo) {
  if (!estado || typeof estado !== 'object') return null;
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const patch = {};
  if (has(estado, 'twitch')) {
    const src = estado.twitch;
    if (!src || typeof src !== 'object') {
      patch.twitch = { desligado: true };
    } else {
      const tw = {};
      for (const key of ['vinculado', 'login', 'bonus', 'pct', 'minutos', 'recompensas', 'pacotes', 'oficiais']) {
        if (has(src, key)) tw[key] = src[key];
      }
      patch.twitch = tw;
    }
  }
  if (estado.kick && typeof estado.kick === 'object') {
    const src = estado.kick;
    const k = {};
    if (Array.isArray(src.oficiais)) k.oficiais = src.oficiais;
    if (typeof src.pct === 'number' && Number.isFinite(src.pct)) k.pct = src.pct;
    if (typeof src.minutos === 'number' && Number.isFinite(src.minutos)) k.minutos = src.minutos;
    if (Object.keys(k).length) patch.kick = k;
  }
  if (!patch.twitch && !patch.kick && completo !== true) return null;
  if (Number.isInteger(estado.servidorAgora)) patch.servidorAgora = estado.servidorAgora;
  if (completo === true) patch.completo = true;
  return patch;
}
