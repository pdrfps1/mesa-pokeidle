const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const distDir = path.join(root, 'dist');
const SINAIS = ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'];

function packageForBuilder(source) {
  const pkg = JSON.parse(source);
  if (!pkg.dependencies || !pkg.dependencies.electron) return null;
  pkg.devDependencies = pkg.devDependencies || {};
  if (!pkg.devDependencies.electron) {
    pkg.devDependencies.electron = pkg.dependencies.electron;
  }
  delete pkg.dependencies.electron;
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

// Devolve uma função que reescreve o conteúdo original uma única vez. Chamadas seguintes não fazem nada.
function criarRestauro(caminho, originalBuffer, fsImpl = fs) {
  let feito = false;
  return function restaurar() {
    if (feito) return;
    feito = true;
    fsImpl.writeFileSync(caminho, originalBuffer);
  };
}

// No win32, derruba a árvore inteira (electron-builder tem netos como makensis e 7z) de forma síncrona.
// Se o taskkill falhar, cai no child.kill() que mata só o filho direto.
function matarArvore(child, platform, spawnSyncFn) {
  if (platform === 'win32' && child.pid !== undefined) {
    try {
      const r = spawnSyncFn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      if (!r || r.error || r.status !== 0) throw new Error('taskkill');
      return;
    } catch { /* cai no kill direto */ }
  }
  try { child.kill(); } catch { /* o filho pode já ter saído */ }
}

// Restaura, mata o filho (se ainda estiver vivo) e sai quando o processo recebe um sinal.
// Também restaura no 'exit', cubra qual for a saída. Devolve a função que remove os listeners.
// opts.platform e opts.spawnSyncFn são injetáveis para teste; o padrão é a plataforma real.
function instalarSinais(proc, restaurar, getChild, opts = {}) {
  const platform = opts.platform || process.platform;
  const spawnSyncFn = opts.spawnSyncFn || spawnSync;
  const handlers = {};
  const matarFilho = () => {
    const child = getChild();
    if (!child || child.exitCode != null || child.signalCode != null) return;
    matarArvore(child, platform, spawnSyncFn);
  };
  for (const sinal of SINAIS) {
    handlers[sinal] = () => {
      try { restaurar(); } catch { /* o restauro já tentou; sair mesmo assim */ }
      matarFilho();
      proc.exit(sinal === 'SIGINT' ? 130 : 143);
    };
    proc.on(sinal, handlers[sinal]);
  }
  const aoSair = () => {
    try { restaurar(); } catch { /* sem o que fazer além de sair */ }
  };
  proc.on('exit', aoSair);
  return function remover() {
    for (const sinal of SINAIS) proc.removeListener(sinal, handlers[sinal]);
    proc.removeListener('exit', aoSair);
  };
}

// Só encerra quando o spawn falhou (sem pid). Com pid, o processo pode estar vivo: não faz nada e deixa o 'close' concluir.
function tratarErroDoFilho(error, child, { restaurar, remover, sair = (code) => process.exit(code), log = console.error }) {
  if (child.pid !== undefined) return false;
  restaurar();
  remover();
  log(`Falha ao iniciar o electron-builder: ${error.message}`);
  sair(1);
  return true;
}

function main() {
  const originalBuffer = fs.readFileSync(pkgPath);
  const texto = originalBuffer.toString('utf8');
  console.log('package.json será reescrito durante o build e restaurado no fim; se o processo for morto à força, devolva `electron` de devDependencies para dependencies (confira com `git diff package.json`).');

  const swapped = packageForBuilder(texto);
  const devElectron = !!(JSON.parse(texto).devDependencies || {}).electron;
  if (!swapped && devElectron) {
    console.log('Aviso: package.json já está com electron em devDependencies. Provável execução anterior interrompida; confira com `git diff package.json`.');
  }
  const restaurar = swapped ? criarRestauro(pkgPath, originalBuffer) : () => {};

  let child = null;
  const remover = instalarSinais(process, restaurar, () => child);

  const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
  try {
    if (swapped) fs.writeFileSync(pkgPath, swapped);
    // Sem alvo fixo: nsis e portable vêm de build.win.target.
    child = spawn(
      process.execPath,
      [cli, '--win', ...process.argv.slice(2)],
      { cwd: root, stdio: 'inherit' },
    );
  } catch (error) {
    restaurar();
    remover();
    console.error(`Falha ao iniciar o electron-builder: ${error.message}`);
    process.exit(1);
  }

  child.on('error', (error) => {
    tratarErroDoFilho(error, child, { restaurar, remover });
  });

  child.on('close', (code) => {
    restaurar();
    remover();
    let status = code == null ? 1 : code;

    if (status === 0) {
      // Alias legado: o atualizador de versões antigas ainda procura Mesa.exe na release.
      const portable = path.join(distDir, 'PokeIdle-Automation.exe');
      const legacy = path.join(distDir, 'Mesa.exe');
      if (fs.existsSync(portable)) {
        fs.copyFileSync(portable, legacy);
        console.log(`Alias legado criado: ${legacy}`);
        console.log('A release precisa publicar três arquivos: PokeIdle-Automation.exe, PokeIdle-Automation-Setup.exe e Mesa.exe.');
      } else {
        console.log(`Aviso: ${portable} não foi gerado; o alias Mesa.exe não foi criado.`);
        status = 1;
      }
    }

    process.exit(status);
  });
}

module.exports = { packageForBuilder, criarRestauro, instalarSinais, matarArvore, tratarErroDoFilho, SINAIS };

if (require.main === module) main();
