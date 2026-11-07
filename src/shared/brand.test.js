'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AppBrand = require('./brand');
const ROOT = path.join(__dirname, '..', '..');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));

describe('AppBrand e package.json', () => {
  it('productName bate com o package.json', () => {
    assert.equal(pkg.productName, AppBrand.productName);
    assert.equal(pkg.build.productName, AppBrand.productName);
  });

  it('executableName e appId batem com o package.json', () => {
    assert.equal(pkg.build.executableName, AppBrand.exeBaseName);
    assert.equal(pkg.build.appId, AppBrand.appId);
  });

  it('nomes dos assets batem com o package.json', () => {
    assert.equal(pkg.build.portable.artifactName, AppBrand.portableAsset);
    assert.equal(pkg.build.nsis.artifactName, AppBrand.installerAsset);
  });
});

describe('caminhos de ícones e instalador existem em disco', () => {
  it('build.win.icon e os recursos do NSIS existem', () => {
    const caminhos = [
      pkg.build.win.icon,
      pkg.build.nsis.installerIcon,
      pkg.build.nsis.uninstallerIcon,
      pkg.build.nsis.installerHeaderIcon,
      pkg.build.nsis.installerSidebar,
      pkg.build.nsis.uninstallerSidebar,
      pkg.build.nsis.installerHeader,
    ];
    for (const rel of caminhos) {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `arquivo ausente: ${rel}`);
    }
  });
});
