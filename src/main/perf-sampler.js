const { createReport, addSample, summarize, formatReport } = require('./perf-report');

function bayPidMap(webContents, session, catalog) {
  const map = new Map();
  const open = new Set();
  for (const contents of webContents.getAllWebContents()) {
    try {
      if (contents.isDestroyed() || contents.getType() !== 'webview') continue;
      const index = catalog.partitions.findIndex((part) => session.fromPartition(part) === contents.session);
      if (index < 0) continue;
      map.set(contents.getOSProcessId(), index);
      open.add(index);
    } catch { /* o processo já saiu */ }
  }
  return { map, openBays: open.size };
}

function ramByBay(metrics, bayOfPid, partitions) {
  const byPid = new Map(metrics.map((metric) => [metric.pid, metric]));
  return partitions.map((_, index) => {
    let mb = 0;
    for (const [pid, bay] of bayOfPid) {
      if (bay !== index) continue;
      const metric = byPid.get(pid);
      const kb = metric && metric.memory ? metric.memory.workingSetSize : 0;
      mb += kb / 1024;
    }
    return Math.round(mb);
  });
}

function roleOf(metric, bayOfPid, uiPid) {
  const bay = bayOfPid.get(metric.pid);
  if (Number.isInteger(bay)) return { role: 'baia', bay };
  if (metric.type === 'GPU') return { role: 'gpu', bay: null };
  if (metric.type === 'Browser' || metric.pid === uiPid) return { role: 'mesa', bay: null };
  return { role: 'outro', bay: null };
}

function createPerfSampler({ app, webContents, session, catalog, scene, uiPid }) {
  let report = createReport();
  let ram = catalog.partitions.map(() => 0);
  let primed = false;
  let started = false;

  function tick() {
    const metrics = app.getAppMetrics();
    const found = bayPidMap(webContents, session, catalog);
    ram = ramByBay(metrics, found.map, catalog.partitions);
    if (!primed) {
      primed = true;
      return;
    }
    const current = scene();
    const processes = metrics.map((metric) => {
      const placed = roleOf(metric, found.map, uiPid());
      const cpu = metric.cpu ? Number(metric.cpu.percentCPUUsage) : 0;
      const kb = metric.memory ? metric.memory.workingSetSize : 0;
      return {
        role: placed.role,
        bay: placed.bay,
        cpu: Number.isFinite(cpu) ? cpu : 0,
        ramMb: kb / 1024,
      };
    });
    addSample(report, {
      window: current.window,
      view: current.view,
      openBays: found.openBays,
      processes,
    });
  }

  return {
    start() {
      if (started) return;
      started = true;
      try { tick(); } catch { /* a primeira leitura pode coincidir com o arranque */ }
      setInterval(() => {
        try { tick(); } catch { /* a medição espera o próximo ciclo */ }
      }, 2000);
    },
    ramByBay() {
      return ram.slice();
    },
    summarize() {
      const summary = summarize(report);
      summary.text = formatReport(summary);
      return summary;
    },
    reset() {
      report = createReport();
      return this.summarize();
    },
  };
}

module.exports = { createPerfSampler };
