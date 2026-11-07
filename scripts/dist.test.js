const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const nodePath = require('node:path');
const { EventEmitter } = require('node:events');
const { packageForBuilder, criarRestauro, instalarSinais, matarArvore, tratarErroDoFilho } = require('./dist');

// Nunca toca no package.json real: todo arquivo vai para um diretório temporário.
function tmpArquivo(conteudo) {
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'pokeidle-dist-'));
  const caminho = nodePath.join(dir, 'package.json');
  if (conteudo !== undefined) fs.writeFileSync(caminho, conteudo);
  return caminho;
}

test('packageForBuilder move electron de dependencies para devDependencies', () => {
  const source = JSON.stringify({ name: 'x', dependencies: { electron: '^44.5.1', outro: '1.0.0' }, devDependencies: {} });
  const out = packageForBuilder(source);
  const pkg = JSON.parse(out);
  assert.equal(pkg.dependencies.electron, undefined);
  assert.equal(pkg.devDependencies.electron, '^44.5.1');
  assert.equal(pkg.dependencies.outro, '1.0.0');
  assert.equal(out.endsWith('\n'), true);
});

test('packageForBuilder devolve null quando não há electron em dependencies', () => {
  assert.equal(packageForBuilder(JSON.stringify({ name: 'x', dependencies: {} })), null);
  assert.equal(packageForBuilder(JSON.stringify({ name: 'x' })), null);
});

test('criarRestauro devolve bytes idênticos, com BOM e CRLF, e é idempotente', () => {
  const original = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{\r\n  "name": "x"\r\n}\r\n', 'utf8')]);
  const caminho = tmpArquivo(original);
  const restaurar = criarRestauro(caminho, original);

  fs.writeFileSync(caminho, 'trocado');
  restaurar();
  const depois = fs.readFileSync(caminho);
  assert.equal(depois.equals(original), true);

  // Segunda chamada não reescreve: o conteúdo trocado depois do primeiro restauro permanece.
  fs.writeFileSync(caminho, 'de novo');
  restaurar();
  assert.equal(fs.readFileSync(caminho, 'utf8'), 'de novo');
});

function procFalso() {
  const proc = new EventEmitter();
  proc.exitCalls = [];
  proc.exit = (code) => { proc.exitCalls.push(code); };
  return proc;
}

function filhoFalso() {
  return { exitCode: null, signalCode: null, killCalls: 0, kill() { this.killCalls += 1; } };
}

function restauroEspiado() {
  const r = () => { r.calls += 1; };
  r.calls = 0;
  return r;
}

test('instalarSinais: SIGINT restaura, mata o filho e sai com 130', () => {
  const proc = procFalso();
  const child = filhoFalso();
  const restaurar = restauroEspiado();
  instalarSinais(proc, restaurar, () => child);
  proc.emit('SIGINT');
  assert.equal(restaurar.calls, 1);
  assert.equal(child.killCalls, 1);
  assert.deepEqual(proc.exitCalls, [130]);
});

test('instalarSinais: SIGTERM sai com 143', () => {
  const proc = procFalso();
  instalarSinais(proc, restauroEspiado(), () => null);
  proc.emit('SIGTERM');
  assert.deepEqual(proc.exitCalls, [143]);
});

test('instalarSinais: SIGBREAK restaura', () => {
  const proc = procFalso();
  const restaurar = restauroEspiado();
  instalarSinais(proc, restaurar, () => null);
  proc.emit('SIGBREAK');
  assert.equal(restaurar.calls, 1);
  assert.deepEqual(proc.exitCalls, [143]);
});

test('instalarSinais: não mata filho que já saiu', () => {
  const proc = procFalso();
  const child = filhoFalso();
  child.exitCode = 0;
  instalarSinais(proc, restauroEspiado(), () => child);
  proc.emit('SIGINT');
  assert.equal(child.killCalls, 0);
});

test('instalarSinais: evento exit restaura', () => {
  const proc = procFalso();
  const restaurar = restauroEspiado();
  instalarSinais(proc, restaurar, () => null);
  proc.emit('exit', 0);
  assert.equal(restaurar.calls, 1);
});

test('instalarSinais: a função de remoção tira todos os listeners', () => {
  const proc = procFalso();
  const remover = instalarSinais(proc, restauroEspiado(), () => null);
  assert.equal(proc.listenerCount('SIGINT'), 1);
  assert.equal(proc.listenerCount('exit'), 1);
  remover();
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP', 'exit']) {
    assert.equal(proc.listenerCount(sinal), 0, sinal);
  }
});

// spawnSync falso: registra a chamada e quantas saídas do processo já tinham acontecido naquele momento.
function spawnSyncEspiado(proc, retorno) {
  const f = (cmd, args, opts) => {
    f.calls.push({ cmd, args, opts, exitAntes: proc.exitCalls.length });
    if (retorno instanceof Error) throw retorno;
    return retorno;
  };
  f.calls = [];
  return f;
}

test('instalarSinais no win32: taskkill /T /F na árvore antes do proc.exit', () => {
  const proc = procFalso();
  const child = { pid: 4321, exitCode: null, signalCode: null, killCalls: 0, kill() { this.killCalls += 1; } };
  const spawnSyncFn = spawnSyncEspiado(proc, { status: 0 });
  instalarSinais(proc, restauroEspiado(), () => child, { platform: 'win32', spawnSyncFn });
  proc.emit('SIGINT');
  assert.equal(spawnSyncFn.calls.length, 1);
  assert.equal(spawnSyncFn.calls[0].cmd, 'taskkill');
  assert.deepEqual(spawnSyncFn.calls[0].args, ['/pid', '4321', '/T', '/F']);
  assert.equal(spawnSyncFn.calls[0].exitAntes, 0);
  assert.equal(child.killCalls, 0);
  assert.deepEqual(proc.exitCalls, [130]);
});

test('instalarSinais no win32: falha do taskkill cai no child.kill()', () => {
  for (const retorno of [new Error('ENOENT'), { status: 1 }, { status: null, error: new Error('x') }]) {
    const proc = procFalso();
    const child = { pid: 4321, exitCode: null, signalCode: null, killCalls: 0, kill() { this.killCalls += 1; } };
    instalarSinais(proc, restauroEspiado(), () => child, { platform: 'win32', spawnSyncFn: spawnSyncEspiado(proc, retorno) });
    proc.emit('SIGTERM');
    assert.equal(child.killCalls, 1);
    assert.deepEqual(proc.exitCalls, [143]);
  }
});

test('instalarSinais fora do win32: não chama taskkill e usa child.kill()', () => {
  const proc = procFalso();
  const child = { pid: 4321, exitCode: null, signalCode: null, killCalls: 0, kill() { this.killCalls += 1; } };
  const spawnSyncFn = spawnSyncEspiado(proc, { status: 0 });
  instalarSinais(proc, restauroEspiado(), () => child, { platform: 'linux', spawnSyncFn });
  proc.emit('SIGINT');
  assert.equal(spawnSyncFn.calls.length, 0);
  assert.equal(child.killCalls, 1);
});

test('instalarSinais: filho já saído não é morto nem no win32', () => {
  const proc = procFalso();
  const child = { pid: 4321, exitCode: 0, signalCode: null, killCalls: 0, kill() { this.killCalls += 1; } };
  const spawnSyncFn = spawnSyncEspiado(proc, { status: 0 });
  instalarSinais(proc, restauroEspiado(), () => child, { platform: 'win32', spawnSyncFn });
  proc.emit('SIGINT');
  assert.equal(spawnSyncFn.calls.length, 0);
  assert.equal(child.killCalls, 0);
});

test('matarArvore sem pid no win32 usa child.kill() direto', () => {
  const child = { killCalls: 0, kill() { this.killCalls += 1; } };
  let chamadas = 0;
  matarArvore(child, 'win32', () => { chamadas += 1; return { status: 0 }; });
  assert.equal(chamadas, 0);
  assert.equal(child.killCalls, 1);
});

test('tratarErroDoFilho sem pid restaura, remove listeners e sai com 1', () => {
  const restaurar = restauroEspiado();
  let removido = 0;
  const saidas = [];
  const logs = [];
  const ok = tratarErroDoFilho(new Error('ENOENT'), { pid: undefined }, {
    restaurar,
    remover: () => { removido += 1; },
    sair: (code) => saidas.push(code),
    log: (msg) => logs.push(msg),
  });
  assert.equal(ok, true);
  assert.equal(restaurar.calls, 1);
  assert.equal(removido, 1);
  assert.deepEqual(saidas, [1]);
  assert.equal(logs.length, 1);
});

test('tratarErroDoFilho com pid não restaura nem sai (o close termina o fluxo)', () => {
  const restaurar = restauroEspiado();
  const saidas = [];
  const ok = tratarErroDoFilho(new Error('kill falhou'), { pid: 999 }, {
    restaurar,
    remover: () => { throw new Error('não deveria remover'); },
    sair: (code) => saidas.push(code),
    log: () => {},
  });
  assert.equal(ok, false);
  assert.equal(restaurar.calls, 0);
  assert.deepEqual(saidas, []);
});
