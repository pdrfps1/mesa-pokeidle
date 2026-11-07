const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const original = fs.readFileSync(pkgPath, 'utf8');
const distDir = path.join(root, 'dist');

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

const swapped = packageForBuilder(original);
if (swapped) fs.writeFileSync(pkgPath, swapped);

let status = 1;
try {
  const cli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');
  // Sem alvo fixo: nsis e portable vêm de build.win.target.
  const result = spawnSync(
    process.execPath,
    [cli, '--win', ...process.argv.slice(2)],
    { cwd: root, stdio: 'inherit' },
  );
  status = result.status == null ? 1 : result.status;
} finally {
  if (swapped) fs.writeFileSync(pkgPath, original);
}

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
