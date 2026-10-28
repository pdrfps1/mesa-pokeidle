const FRAME_GAP_MS = 100;

function economyOn() {
  const root = document.documentElement;
  return !!(root && root.classList.contains('modo-economia'));
}

function installFrameCap() {
  const nativeFrame = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  let last = -FRAME_GAP_MS;
  let seq = 0;
  const pending = new Map();

  window.requestAnimationFrame = function (callback) {
    if (typeof callback !== 'function') return nativeFrame(callback);
    const id = ++seq;
    if (!economyOn()) {
      const rafId = nativeFrame((time) => {
        pending.delete(id);
        callback(time);
      });
      pending.set(id, { rafId, timer: 0 });
      return id;
    }
    const wait = Math.max(0, FRAME_GAP_MS - (performance.now() - last));
    const timer = window.setTimeout(() => {
      const entry = pending.get(id);
      if (!entry) return;
      entry.timer = 0;
      entry.rafId = nativeFrame((time) => {
        pending.delete(id);
        last = time;
        callback(time);
      });
    }, wait);
    pending.set(id, { rafId: 0, timer });
    return id;
  };

  window.cancelAnimationFrame = function (id) {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (entry.timer) window.clearTimeout(entry.timer);
    if (entry.rafId) nativeCancel(entry.rafId);
  };
}

installFrameCap();

const reader = createHuntReader();
const state = reader.state;
const nativeSend = WebSocket.prototype.send;
const armed = new WeakSet();
let candidate = null;
let confirmed = null;
let lastMark = '';
let pendingReport = null;
const liveQueue = [];
let generation = Date.now();

function emitLiveFromEstado(estado) {
  const patch = livePatchFromEstado(estado);
  if (!patch) return;
  const api = window.__mesaHunt;
  if (api && typeof api.live === 'function') {
    api.live(patch);
    return;
  }
  if (liveQueue.length >= 30) liveQueue.shift();
  liveQueue.push(patch);
}

function flushLiveQueue() {
  const api = window.__mesaHunt;
  if (!api || typeof api.live !== 'function') return;
  while (liveQueue.length) api.live(liveQueue.shift());
}

function bump() {
  generation = Math.max(Date.now(), generation + 1);
}

function build(includeHunts) {
  const summary = {
    generation,
    ready: state.ready === true && !!(confirmed && confirmed.readyState === WebSocket.OPEN),
    trainerLevel: state.trainerLevel,
    huntSlug: state.huntSlug,
    huntName: state.huntName,
    noCentro: state.noCentro === true,
    centroLivreEm: state.centroLivreEm,
    serverOffsetMs: state.serverOffsetMs,
    vip: reader.vipNow(),
    xpBonus: {
      guildRankPct: state.guildRankPct,
      guildBoostActive: state.guildBoostUntil != null && state.servidorAgora != null && state.guildBoostUntil > state.servidorAgora,
      twitchPct: state.twitchPct,
      eventTrainerPct: state.eventTrainerPct,
      eventPokemonPct: state.eventPokemonPct,
    },
    active: reader.activeSummary(),
    catalogRev: state.catalogRev,
    huntEventSeq: state.huntEventSeq,
    huntEventSlug: state.huntEventSlug,
  };
  if (includeHunts) summary.hunts = state.hunts;
  return summary;
}

function fingerprint(summary) {
  return JSON.stringify([
    summary.generation, summary.ready, summary.trainerLevel, summary.huntSlug, summary.huntName,
    summary.noCentro, summary.centroLivreEm, summary.serverOffsetMs, summary.vip, summary.xpBonus,
    summary.active, summary.catalogRev, summary.huntEventSeq, summary.huntEventSlug,
  ]);
}

function sendReport(summary) {
  const api = window.__mesaHunt;
  if (!api || typeof api.report !== 'function') {
    if (pendingReport && pendingReport.hunts && !summary.hunts) summary.hunts = pendingReport.hunts;
    pendingReport = summary;
    return;
  }
  pendingReport = null;
  api.report(summary);
}

function publish(extra) {
  const includeHunts = reader.isDirty();
  const summary = build(includeHunts);
  const mark = fingerprint(summary);
  if (!extra && !includeHunts && mark === lastMark) return;
  lastMark = mark;
  if (includeHunts) reader.clearDirty();
  if (extra) summary.send = { slug: extra.slug, ok: extra.ok === true, at: extra.at };
  sendReport(summary);
}

function frameOf(data) {
  if (typeof data !== 'string' || data.length > 6000000) return null;
  try {
    const frame = JSON.parse(data);
    if (!frame || typeof frame.t !== 'string') return null;
    return frame;
  } catch { return null; }
}

function onClose(ws) {
  if (ws !== candidate && ws !== confirmed) return;
  if (confirmed === ws) confirmed = null;
  if (candidate === ws) candidate = null;
  state.ready = false;
  bump();
  publish();
}

function arm(ws) {
  if (armed.has(ws)) return;
  armed.add(ws);
  ws.addEventListener('message', (event) => {
    if (ws !== candidate && ws !== confirmed) return;
    const frame = frameOf(event.data);
    if (!frame || frame.t === 'hello') return;
    if (frame.t === 'welcome' && ws === candidate) {
      confirmed = ws;
      state.ready = true;
      reader.applyEstado(frame.estado, true);
      reader.takeHunts(frame.hunts);
      if (state.huntSlug && !state.huntName) state.huntName = reader.nameFor(state.huntSlug);
      emitLiveFromEstado(frame.estado);
      publish();
      return;
    }
    if (ws !== confirmed) return;
    if (frame.t === 'estado') {
      reader.applyEstado(frame.estado, false);
      emitLiveFromEstado(frame.estado);
    } else if (frame.t === 'batalha') reader.applyBattle(frame);
    else return;
    publish();
  });
  ws.addEventListener('close', () => onClose(ws));
  ws.addEventListener('error', () => onClose(ws));
}

function sendSlug(slug) {
  if (!reader.slugOf(slug) || !confirmed || confirmed.readyState !== WebSocket.OPEN) return false;
  if (!state.hunts.some((hunt) => hunt.slug === slug)) return false;
  nativeSend.call(confirmed, JSON.stringify({ t: 'hunt.select', slug }));
  return true;
}

WebSocket.prototype.send = function (data) {
  const frame = frameOf(data);
  if (frame && frame.t === 'hello') {
    candidate = this;
    confirmed = null;
    state.ready = false;
    arm(this);
    bump();
    publish();
  }
  return nativeSend.apply(this, arguments);
};

setInterval(() => {
  const api = window.__mesaHunt;
  if (!api) return;
  flushLiveQueue();
  if (pendingReport && typeof api.report === 'function') {
    const queued = pendingReport;
    pendingReport = null;
    api.report(queued);
  }
  if (typeof api.pull !== 'function') return;
  const slug = api.pull();
  if (typeof slug !== 'string' || !slug) return;
  publish({ slug, ok: sendSlug(slug), at: Date.now() });
}, 100);
