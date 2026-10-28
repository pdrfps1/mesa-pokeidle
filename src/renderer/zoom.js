const zoomApplied = [];

function bayFit(index) {
  const stage = ui.bays && ui.bays[index] && ui.bays[index].stage;
  if (!stage) return null;
  return MESA_CATALOG.fitZoom(stage.clientWidth, stage.clientHeight);
}

function bayFactor(index) {
  const fixed = cfg.bays[index] && cfg.bays[index].scale;
  if (typeof fixed === 'number') return fixed;
  return bayFit(index);
}

function sizeBayFrame(index) {
  const stage = ui.bays && ui.bays[index] && ui.bays[index].stage;
  const webview = webviews[index];
  if (!stage || !webview) return;
  const width = Math.round(stage.clientWidth);
  const height = Math.round(stage.clientHeight);
  if (width < 8 || height < 8) return;
  const box = `${width}px`;
  const tall = `${height}px`;
  if (webview.style.width !== box) webview.style.width = box;
  if (webview.style.height !== tall) webview.style.height = tall;
}

function applyBayZoom(index, force) {
  const webview = webviews[index];
  if (!webview || typeof webview.setZoomFactor !== 'function') return;
  const factor = bayFactor(index);
  if (factor == null) return;
  if (!force && live[index].ready && zoomApplied[index] === factor) return;
  try {
    webview.setZoomFactor(factor);
    if (live[index].ready) zoomApplied[index] = factor;
  } catch { /* o quadro ainda está abrindo */ }
}

function paintZoom() {
  for (let index = 0; index < MESA_CATALOG.bays; index += 1) {
    sizeBayFrame(index);
    applyBayZoom(index);
  }
  if (!ui.scale || document.activeElement === ui.scale) return;
  const fixed = cfg.bays[cfg.selected].scale;
  const fit = bayFit(cfg.selected);
  const shown = typeof fixed === 'number' ? fixed : fit;
  if (shown != null) {
    const pct = Math.min(150, Math.max(50, Math.round(shown * 100)));
    ui.scale.value = String(pct);
  }
  if (typeof fixed === 'number') ui.scalePct.textContent = `${Math.round(fixed * 100)}%`;
  else if (fit != null) ui.scalePct.textContent = `Automático · ${Math.round(fit * 100)}%`;
  else ui.scalePct.textContent = 'Automático';
  if (ui.scaleAuto) {
    const auto = fixed == null;
    ui.scaleAuto.classList.toggle('is-on', auto);
    ui.scaleAuto.setAttribute('aria-pressed', auto ? 'true' : 'false');
  }
}

function watchBayFrames() {
  if (watchBayFrames.started || typeof ResizeObserver !== 'function' || !ui.bays) return;
  watchBayFrames.started = true;
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const index = ui.bays.findIndex((bay) => bay.stage === entry.target);
      if (index < 0) continue;
      sizeBayFrame(index);
      if (cfg.bays[index].scale == null) applyBayZoom(index);
      if (index === cfg.selected && document.activeElement !== ui.scale) paintZoom();
    }
  });
  for (const bay of ui.bays) observer.observe(bay.stage);
}
