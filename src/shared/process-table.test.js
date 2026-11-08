const test = require('node:test');
const assert = require('node:assert/strict');
const MesaProcessTable = require('./process-table');

test('labelOf dá rótulo e kind para cada tipo de processo', () => {
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 1, type: 'Browser', uiPid: 2 }), { label: 'Mesa · principal', kind: 'mesa-main' });
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 2, type: 'Browser', uiPid: 2 }), { label: 'Mesa · interface', kind: 'mesa-ui' });
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 3, type: 'GPU' }), { label: 'GPU', kind: 'gpu' });
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 4, type: 'Tab', bay: 0 }), { label: 'Baía 1 · jogo', kind: 'bay' });
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 5, type: 'Tab', bay: 2 }), { label: 'Baía 3 · jogo', kind: 'bay' });
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 6, type: 'Tab', twitchBay: 1 }), { label: 'Twitch · Baía 2', kind: 'twitch' });
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 7, type: 'Utility', serviceName: 'Audio' }), { label: 'Serviço · Audio', kind: 'service' });
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 8, type: 'Utility', name: 'Network' }), { label: 'Serviço · Network', kind: 'service' });
  assert.deepEqual(MesaProcessTable.labelOf({ pid: 9, type: 'Zygote' }), { label: 'Outro', kind: 'other' });
});

test('labelOf dá precedência à baía sobre a Twitch', () => {
  assert.equal(MesaProcessTable.labelOf({ pid: 10, type: 'Tab', bay: 1, twitchBay: 3 }).kind, 'bay');
});

test('cpuShare divide pelos núcleos e limita a 0..100', () => {
  assert.equal(MesaProcessTable.cpuShare(400, 8), 50);
  assert.equal(MesaProcessTable.cpuShare(-5, 8), 0);
  assert.equal(MesaProcessTable.cpuShare(NaN, 8), 0);
  assert.equal(MesaProcessTable.cpuShare(1000, 2), 100);
  assert.equal(MesaProcessTable.cpuShare(10, 4), 2.5);
});

test('totals soma CPU, memória e processos e converte a memória do sistema', () => {
  const rows = [
    { pid: 1, cpu: 10.5, ramMb: 300 },
    { pid: 2, cpu: 4.5, ramMb: 512.4 },
  ];
  assert.deepEqual(MesaProcessTable.totals(rows, 16 * 1024 * 1024), { cpu: 15, ramMb: 812, count: 2, systemGb: 16 });
  assert.deepEqual(MesaProcessTable.totals([], 0), { cpu: 0, ramMb: 0, count: 0, systemGb: 0 });
  assert.deepEqual(MesaProcessTable.totals(null, undefined), { cpu: 0, ramMb: 0, count: 0, systemGb: 0 });
});

test('sortRows ordena nos dois sentidos com desempate por pid', () => {
  const rows = [
    { pid: 30, label: 'B', cpu: 5, ramMb: 100 },
    { pid: 10, label: 'A', cpu: 5, ramMb: 200 },
    { pid: 20, label: 'C', cpu: 9, ramMb: 50 },
  ];
  assert.deepEqual(MesaProcessTable.sortRows(rows, 'cpu', 'desc').map((r) => r.pid), [20, 10, 30]);
  assert.deepEqual(MesaProcessTable.sortRows(rows, 'cpu', 'asc').map((r) => r.pid), [10, 30, 20]);
  assert.deepEqual(MesaProcessTable.sortRows(rows, 'ramMb', 'desc').map((r) => r.pid), [10, 30, 20]);
  assert.deepEqual(MesaProcessTable.sortRows(rows, 'label', 'asc').map((r) => r.pid), [10, 30, 20]);
  assert.deepEqual(MesaProcessTable.sortRows(rows, 'label', 'desc').map((r) => r.pid), [20, 30, 10]);
  assert.equal(rows[0].pid, 30, 'a entrada não é alterada');
});

test('formatMb usa MB abaixo de 1024 e GB com vírgula acima', () => {
  assert.equal(MesaProcessTable.formatMb(812), '812 MB');
  assert.equal(MesaProcessTable.formatMb(1228.8), '1,2 GB');
  assert.equal(MesaProcessTable.formatMb(1024), '1,0 GB');
  assert.equal(MesaProcessTable.formatMb(0), '0 MB');
  assert.equal(MesaProcessTable.formatMb(NaN), '0 MB');
});
