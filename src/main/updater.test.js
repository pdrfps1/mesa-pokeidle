const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compareSemver,
  findReleaseAsset,
  isPortableTarget,
  detectInstallMode,
  isAllowedUpdateUrl,
  isReleaseAssetUrl,
  psEscape,
  startDetached,
  fetchReleaseAsset,
} = require('./updater');
const fs = require('node:fs');
const os = require('node:os');
const nodePath = require('node:path');
const { EventEmitter } = require('node:events');

const BASE = 'https://github.com/pdrfps1/mesa-pokeidle/releases/download/v0.4.0/';

test('compareSemver ordena versão', () => {
  assert.equal(compareSemver('0.3.1', '0.3.0'), 1);
  assert.equal(compareSemver('v0.3.0', '0.3.1'), -1);
  assert.equal(compareSemver('0.3.1', '0.3.1'), 0);
});

test('findReleaseAsset portable prefere o nome novo e aceita o legado', () => {
  const novo = findReleaseAsset([
    { name: 'Mesa.exe', browser_download_url: `${BASE}Mesa.exe` },
    { name: 'PokeIdle-Automation.exe', browser_download_url: `${BASE}PokeIdle-Automation.exe` },
  ], 'portable');
  assert.equal(novo.name, 'PokeIdle-Automation.exe');

  const legado = findReleaseAsset([{ name: 'notas.txt' }, { name: 'mesa.exe' }], 'portable');
  assert.equal(legado.name, 'mesa.exe');
  assert.equal(findReleaseAsset([{ name: 'outro.exe' }], 'portable'), null);
});

test('findReleaseAsset instalador só aceita o setup novo', () => {
  const setup = findReleaseAsset([
    { name: 'PokeIdle-Automation.exe' },
    { name: 'PokeIdle-Automation-Setup.exe', browser_download_url: `${BASE}PokeIdle-Automation-Setup.exe` },
  ], 'installer');
  assert.equal(setup.name, 'PokeIdle-Automation-Setup.exe');
  assert.equal(findReleaseAsset([{ name: 'Mesa.exe' }], 'installer'), null);
});

test('findReleaseAsset devolve null para nome estranho e lista inválida', () => {
  assert.equal(findReleaseAsset([{ name: 'qualquer-coisa.zip' }], 'portable'), null);
  assert.equal(findReleaseAsset(null, 'installer'), null);
  assert.equal(findReleaseAsset([], 'desconhecido'), null);
});

test('isPortableTarget aceita só os dois nomes do executável portátil', () => {
  assert.equal(isPortableTarget('C:\\Apps\\PokeIdle-Automation.exe'), true);
  assert.equal(isPortableTarget('C:\\Apps\\mesa.exe'), true);
  assert.equal(isPortableTarget('C:\\Apps\\Outro.exe'), false);
  assert.equal(isPortableTarget(''), false);
});

test('detectInstallMode diferencia dev, portátil e instalado', () => {
  assert.equal(detectInstallMode({ isPackaged: false, env: {}, execPath: 'x' }), 'dev');
  assert.equal(
    detectInstallMode({ isPackaged: true, env: { PORTABLE_EXECUTABLE_FILE: 'C:\\a\\PokeIdle-Automation.exe' }, execPath: 'x' }),
    'portable',
  );
  assert.equal(detectInstallMode({ isPackaged: true, env: {}, execPath: 'C:\\b\\PokeIdle Automation.exe' }), 'installed');
});

test('só aceita a API e o asset deste repositório', () => {
  assert.equal(isAllowedUpdateUrl('https://api.github.com/repos/pdrfps1/mesa-pokeidle/releases/latest'), true);
  assert.equal(isAllowedUpdateUrl('http://api.github.com/repos/pdrfps1/mesa-pokeidle/releases/latest'), false);
  assert.equal(isAllowedUpdateUrl('https://api.github.com/repos/outra/mesa-pokeidle/releases/latest'), false);
  assert.equal(isAllowedUpdateUrl('https://evil.example/Mesa.exe'), false);
  assert.equal(isAllowedUpdateUrl('https://objects.githubusercontent.com/github-production-release-asset/x'), true);
  assert.equal(
    isAllowedUpdateUrl('https://release-assets.githubusercontent.com/github-production-release-asset/x'),
    true,
  );
});

test('isReleaseAssetUrl aceita os três nomes de asset da release', () => {
  assert.equal(isReleaseAssetUrl(`${BASE}PokeIdle-Automation.exe`), true);
  assert.equal(isReleaseAssetUrl(`${BASE}PokeIdle-Automation-Setup.exe`), true);
  assert.equal(isReleaseAssetUrl(`${BASE}Mesa.exe`), true);
  assert.equal(isReleaseAssetUrl(`${BASE}Outro.exe`), false);
  assert.equal(
    isReleaseAssetUrl('https://objects.githubusercontent.com/github-production-release-asset/Mesa.exe'),
    false,
  );
});

function fakeChild() {
  const child = new EventEmitter();
  child.unrefCalls = 0;
  child.unref = () => { child.unrefCalls += 1; };
  return child;
}

test('startDetached resolve só no evento spawn, com unref e sem shell', async () => {
  const child = fakeChild();
  const calls = [];
  const fake = (cmd, args, opts) => { calls.push({ cmd, args, opts }); return child; };
  const pending = startDetached('C:\\x\\PokeIdle-Automation-Setup.exe', ['--updated'], {}, fake);
  child.emit('spawn');
  await pending;
  assert.equal(child.unrefCalls, 1);
  assert.deepEqual(calls[0].args, ['--updated']);
  assert.deepEqual(calls[0].opts, { detached: true, stdio: 'ignore' });
  assert.equal(calls[0].opts.shell, undefined);
});

test('startDetached rejeita em erro de spawn sem derrubar o processo', async () => {
  const child = fakeChild();
  const pending = startDetached('x.exe', [], {}, () => child);
  child.emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }));
  await assert.rejects(pending, /ENOENT/);
});

test('startDetached rejeita quando o spawn lança', async () => {
  await assert.rejects(
    startDetached('x.exe', [], {}, () => { throw new Error('EACCES'); }),
    /EACCES/,
  );
});

test('psEscape dobra todas as aspas simples do PowerShell', () => {
  assert.equal(psEscape("a'b"), "a''b");
  assert.equal(psEscape('a\u2018b\u2019c\u201Ad\u201Be'), 'a\u2018\u2018b\u2019\u2019c\u201A\u201Ad\u201B\u201Be');
  assert.equal(psEscape('C:\\Pasta'), 'C:\\Pasta');
});

function tmpDest() {
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'pokeidle-upd-'));
  return nodePath.join(dir, 'asset.exe');
}

test('fetchReleaseAsset com tamanho errado remove o arquivo e lança code size', async () => {
  const dest = tmpDest();
  const download = async (url, file) => { fs.writeFileSync(file, 'curto'); };
  await assert.rejects(
    fetchReleaseAsset({ browser_download_url: 'u', size: 999 }, dest, {}, download),
    (error) => error.code === 'size',
  );
  assert.equal(fs.existsSync(dest), false);
});

test('fetchReleaseAsset aceita tamanho certo e tolera falha de stat', async () => {
  const dest = tmpDest();
  const ok = async (url, file) => { fs.writeFileSync(file, 'abcd'); };
  await fetchReleaseAsset({ browser_download_url: 'u', size: 4 }, dest, {}, ok);
  assert.equal(fs.existsSync(dest), true);
  const semStat = async () => {};
  await fetchReleaseAsset({ browser_download_url: 'u', size: 4 }, nodePath.join(nodePath.dirname(dest), 'nao-existe.exe'), {}, semStat);
});
