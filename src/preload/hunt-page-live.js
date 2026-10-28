function livePatchFromEstado(estado) {
  if (!estado || typeof estado !== 'object') return null;
  const patch = {};
  if (estado.twitch && typeof estado.twitch === 'object') {
    const src = estado.twitch;
    const tw = {};
    if (Array.isArray(src.lives)) tw.lives = src.lives;
    if (Array.isArray(src.oficiais)) tw.oficiais = src.oficiais;
    if (src.assistindo === true || src.assistindo === false) tw.assistindo = src.assistindo;
    if (typeof src.pctAtual === 'number' && Number.isFinite(src.pctAtual)) tw.pctAtual = src.pctAtual;
    if (typeof src.pct === 'number' && Number.isFinite(src.pct)) tw.pct = src.pct;
    if (Object.keys(tw).length) patch.twitch = tw;
  }
  if (estado.kick && typeof estado.kick === 'object') {
    const src = estado.kick;
    const k = {};
    if (Array.isArray(src.oficiais)) k.oficiais = src.oficiais;
    if (typeof src.pct === 'number' && Number.isFinite(src.pct)) k.pct = src.pct;
    if (typeof src.minutos === 'number' && Number.isFinite(src.minutos)) k.minutos = src.minutos;
    if (Object.keys(k).length) patch.kick = k;
  }
  return Object.keys(patch).length ? patch : null;
}
