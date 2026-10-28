const test = require('node:test');
const assert = require('node:assert/strict');
const { compareSemver, findMesaAsset, isAllowedUpdateUrl, isReleaseAssetUrl } = require('./updater');

test('compareSemver ordena versão', () => {
  assert.equal(compareSemver('0.3.1', '0.3.0'), 1);
  assert.equal(compareSemver('v0.3.0', '0.3.1'), -1);
  assert.equal(compareSemver('0.3.1', '0.3.1'), 0);
});

test('findMesaAsset acha só o executável', () => {
  const asset = findMesaAsset([
    { name: 'notas.txt' },
    { name: 'Mesa.exe', browser_download_url: 'https://github.com/pdrfps1/mesa-pokeidle/releases/download/v0.3.1/Mesa.exe' },
  ]);
  assert.equal(asset.name, 'Mesa.exe');
  assert.equal(findMesaAsset([{ name: 'outro.exe' }]), null);
});

test('só aceita a API e o asset deste repositório', () => {
  assert.equal(isAllowedUpdateUrl('https://api.github.com/repos/pdrfps1/mesa-pokeidle/releases/latest'), true);
  assert.equal(isAllowedUpdateUrl('http://api.github.com/repos/pdrfps1/mesa-pokeidle/releases/latest'), false);
  assert.equal(isAllowedUpdateUrl('https://api.github.com/repos/outra/mesa-pokeidle/releases/latest'), false);
  assert.equal(isAllowedUpdateUrl('https://evil.example/Mesa.exe'), false);
  assert.equal(
    isReleaseAssetUrl('https://github.com/pdrfps1/mesa-pokeidle/releases/download/v0.3.1/Mesa.exe'),
    true,
  );
  assert.equal(
    isReleaseAssetUrl('https://objects.githubusercontent.com/github-production-release-asset/Mesa.exe'),
    false,
  );
  assert.equal(
    isAllowedUpdateUrl('https://objects.githubusercontent.com/github-production-release-asset/Mesa.exe'),
    true,
  );
  assert.equal(
    isAllowedUpdateUrl('https://release-assets.githubusercontent.com/github-production-release-asset/x'),
    true,
  );
});
