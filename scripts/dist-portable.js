const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const original = fs.readFileSync(pkgPath, 'utf8');

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
  const result = spawnSync(
    process.execPath,
    [cli, '--win', 'portable', ...process.argv.slice(2)],
    { cwd: root, stdio: 'inherit' },
  );
  status = result.status == null ? 1 : result.status;
} finally {
  if (swapped) fs.writeFileSync(pkgPath, original);
}

process.exit(status);
