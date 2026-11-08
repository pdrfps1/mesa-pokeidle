var MesaProcessTable = (function processTableModule() {
  const TEXT_KEYS = ['label', 'type'];

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // proc: { pid, type, name, serviceName, bay, twitchBay, uiPid }
  // bay e twitchBay são índices 0-based, ou null quando o PID não é de baía/Twitch.
  function labelOf(proc) {
    const p = proc || {};
    if (Number.isInteger(p.bay) && p.bay >= 0) {
      return { label: `Baía ${p.bay + 1} · jogo`, kind: 'bay' };
    }
    if (Number.isInteger(p.twitchBay) && p.twitchBay >= 0) {
      return { label: `Twitch · Baía ${p.twitchBay + 1}`, kind: 'twitch' };
    }
    if (Number.isInteger(p.uiPid) && p.uiPid > 0 && p.pid === p.uiPid) {
      return { label: 'Mesa · interface', kind: 'mesa-ui' };
    }
    if (p.type === 'GPU') return { label: 'GPU', kind: 'gpu' };
    if (p.type === 'Browser') return { label: 'Mesa · principal', kind: 'mesa-main' };
    if (p.type === 'Utility') {
      const service = p.serviceName || p.name || 'sem nome';
      return { label: `Serviço · ${service}`, kind: 'service' };
    }
    return { label: 'Outro', kind: 'other' };
  }

  // Divide o percentual bruto do Electron (soma de núcleos) pelo número de núcleos.
  function cpuShare(rawPercent, cores) {
    const value = Number(rawPercent);
    if (!Number.isFinite(value) || value <= 0) return 0;
    const divisor = Number.isFinite(Number(cores)) && Number(cores) >= 1 ? Number(cores) : 1;
    const share = Math.min(100, Math.max(0, value / divisor));
    return Math.round(share * 10) / 10;
  }

  function totals(rows, systemMemKb) {
    const list = Array.isArray(rows) ? rows : [];
    let cpu = 0;
    let ramMb = 0;
    for (const row of list) {
      cpu += finite(row && row.cpu);
      ramMb += finite(row && row.ramMb);
    }
    const kb = Number(systemMemKb);
    const systemGb = Number.isFinite(kb) && kb > 0 ? Math.round((kb / 1024 / 1024) * 10) / 10 : 0;
    return {
      cpu: Math.round(cpu * 10) / 10,
      ramMb: Math.round(ramMb),
      count: list.length,
      systemGb,
    };
  }

  // Estável. Desempate por pid crescente, nos dois sentidos. Devolve cópia.
  function sortRows(rows, key, dir) {
    const list = Array.isArray(rows) ? rows.slice() : [];
    const sign = dir === 'asc' ? 1 : -1;
    const textual = TEXT_KEYS.includes(key);
    list.sort((a, b) => {
      let diff;
      if (textual) {
        diff = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'pt-BR');
      } else {
        diff = (Number(a[key]) || 0) - (Number(b[key]) || 0);
      }
      if (diff !== 0) return diff * sign;
      return (Number(a.pid) || 0) - (Number(b.pid) || 0);
    });
    return list;
  }

  function formatMb(mb) {
    const n = Number(mb);
    if (!Number.isFinite(n) || n <= 0) return '0 MB';
    if (n >= 1024) return `${(n / 1024).toFixed(1).replace('.', ',')} GB`;
    return `${Math.round(n)} MB`;
  }

  return { labelOf, cpuShare, totals, sortRows, formatMb };
}());

if (typeof module !== 'undefined' && module.exports) module.exports = MesaProcessTable;
