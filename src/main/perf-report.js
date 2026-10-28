function createReport() {
  return { scenarios: new Map() };
}

function scenarioKey(sample) {
  const openBays = Number.isInteger(sample.openBays) && sample.openBays >= 0 ? sample.openBays : 0;
  const bays = openBays === 1 ? '1 baía' : `${openBays} baías`;
  const view = sample.view === 'ajustes' ? 'ajustes' : 'mesa';
  const windowMode = sample.window === 'minimizada' ? 'minimizada' : 'aberta';
  return { key: `${windowMode} · ${view} · ${bays}`, windowMode, view, openBays };
}

function roleName(proc) {
  if (!proc || proc.role === 'baia') {
    const bay = proc && Number.isInteger(proc.bay) ? proc.bay + 1 : 0;
    return bay > 0 ? `baía ${bay}` : 'baía';
  }
  if (proc.role === 'gpu' || proc.role === 'mesa' || proc.role === 'outro') return proc.role;
  return 'outro';
}

function addSample(report, sample) {
  if (!report || !sample || !Array.isArray(sample.processes)) return;
  const scene = scenarioKey(sample);
  let row = report.scenarios.get(scene.key);
  if (!row) {
    row = {
      key: scene.key,
      windowMode: scene.windowMode,
      view: scene.view,
      openBays: scene.openBays,
      count: 0,
      cpu: 0,
      ram: 0,
      roles: new Map(),
    };
    report.scenarios.set(scene.key, row);
  }
  row.count += 1;
  for (const proc of sample.processes) {
    const cpu = Number(proc && proc.cpu);
    const ram = Number(proc && proc.ramMb);
    const safeCpu = Number.isFinite(cpu) && cpu > 0 ? cpu : 0;
    const safeRam = Number.isFinite(ram) && ram > 0 ? ram : 0;
    row.cpu += safeCpu;
    row.ram += safeRam;
    const name = roleName(proc);
    const part = row.roles.get(name) || { cpu: 0, ram: 0 };
    part.cpu += safeCpu;
    part.ram += safeRam;
    row.roles.set(name, part);
  }
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function summarize(report) {
  const windowOrder = { aberta: 0, minimizada: 1 };
  const viewOrder = { mesa: 0, ajustes: 1 };
  const rows = [...(report && report.scenarios ? report.scenarios.values() : [])].map((row) => ({
    key: row.key,
    windowMode: row.windowMode,
    view: row.view,
    openBays: row.openBays,
    count: row.count,
    cpu: round1(row.cpu / row.count),
    ram: Math.round(row.ram / row.count),
    parts: [...row.roles.entries()].map(([name, part]) => ({
      name,
      cpu: round1(part.cpu / row.count),
      ram: Math.round(part.ram / row.count),
    })).filter((part) => part.cpu > 0).sort((a, b) => b.cpu - a.cpu || a.name.localeCompare(b.name, 'pt')),
  }));
  rows.sort((a, b) => (
    windowOrder[a.windowMode] - windowOrder[b.windowMode]
    || viewOrder[a.view] - viewOrder[b.view]
    || a.openBays - b.openBays
  ));
  return {
    unit: '100% é um núcleo. O Gerenciador de Tarefas divide esse número pelos núcleos da máquina.',
    rows,
  };
}

function formatReport(summary) {
  if (!summary || !summary.rows || !summary.rows.length) return 'Ainda não há uma leitura completa.';
  const body = summary.rows.map((row) => {
    const parts = row.parts.map((part) => `${part.name} ${part.cpu}%`).join(' · ');
    return `${row.key}\n${row.count} amostras · ${row.cpu}% de um núcleo · ${row.ram} MB\n${parts}`;
  }).join('\n\n');
  return `${summary.unit}\n\n${body}`;
}

module.exports = { createReport, addSample, summarize, formatReport };
