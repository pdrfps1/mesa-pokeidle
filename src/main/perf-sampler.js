const os = require('os');
const { createReport, addSample, summarize, formatReport } = require('./perf-report');
const MesaProcessTable = require('../shared/process-table');

// PIDs das janelas da Twitch (BrowserWindow, tipo 'window') por partição persist:mesa-twitch-N.
function twitchPidMap(webContents, session, partitions) {
  const map = new Map();
  if (!partitions.length) return map;
  const sessions = partitions.map((part) => {
    try { return session.fromPartition(part); } catch { return null; }
  });
  for (const contents of webContents.getAllWebContents()) {
    try {
      if (contents.isDestroyed() || contents.getType() !== 'window') continue;
      const index = sessions.findIndex((sess) => sess && sess === contents.session);
      if (index < 0) continue;
      map.set(contents.getOSProcessId(), index);
    } catch { /* o processo já saiu */ }
  }
  return map;
}

function systemMemoryKb() {
  try {
    const info = process.getSystemMemoryInfo ? process.getSystemMemoryInfo() : null;
    if (info && Number.isFinite(info.total) && info.total > 0) return info.total;
  } catch { /* cai no fallback do sistema operacional */ }
  return os.totalmem() / 1024;
}

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

function createPerfSampler({ app, webContents, session, catalog, scene, uiPid, twitchPartitions = [] }) {
  let report = createReport();
  let ram = catalog.partitions.map(() => 0);
  let primed = false;
  let started = false;
  let lastSnapshot = null;
  const cores = Math.max(1, os.cpus().length);

  function snapshotOf(metrics, found, twitchMap, uiId) {
    const rows = metrics.map((metric) => {
      const bay = Number.isInteger(found.map.get(metric.pid)) ? found.map.get(metric.pid) : null;
      const twitchBay = bay === null && twitchMap.has(metric.pid) ? twitchMap.get(metric.pid) : null;
      const info = MesaProcessTable.labelOf({
        pid: metric.pid,
        type: metric.type,
        name: metric.name,
        serviceName: metric.serviceName,
        bay,
        twitchBay,
        uiPid: uiId,
      });
      const raw = metric.cpu ? Number(metric.cpu.percentCPUUsage) : 0;
      const kb = metric.memory ? metric.memory.workingSetSize : 0;
      const privateKb = metric.memory ? metric.memory.privateBytes : 0;
      return {
        pid: metric.pid,
        type: metric.type,
        name: metric.name,
        kind: info.kind,
        label: info.label,
        bay,
        cpu: MesaProcessTable.cpuShare(raw, cores),
        ramMb: Number.isFinite(kb / 1024) ? kb / 1024 : 0,
        privateMb: Number.isFinite(privateKb / 1024) ? privateKb / 1024 : 0,
      };
    });
    return { at: Date.now(), cores, systemMemKb: systemMemoryKb(), rows };
  }

  function tick() {
    const metrics = app.getAppMetrics();
    const found = bayPidMap(webContents, session, catalog);
    ram = ramByBay(metrics, found.map, catalog.partitions);
    const uiId = uiPid();
    const twitchMap = twitchPidMap(webContents, session, twitchPartitions);
    try {
      lastSnapshot = snapshotOf(metrics, found, twitchMap, uiId);
    } catch { /* a leitura de processos fica para o próximo ciclo */ }
    if (!primed) {
      primed = true;
      return;
    }
    const current = scene();
    const processes = metrics.map((metric) => {
      const placed = roleOf(metric, found.map, uiId);
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
    processes() {
      return lastSnapshot;
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
