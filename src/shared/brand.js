// Nomes e arquivos do produto. Fonte única: o package.json e o atualizador conferem com estes valores.
var AppBrand = (function appBrandModule() {
  return Object.freeze({
    productName: 'PokeIdle Automation',
    exeBaseName: 'PokeIdle-Automation',
    portableAsset: 'PokeIdle-Automation.exe',
    installerAsset: 'PokeIdle-Automation-Setup.exe',
    legacyPortableAsset: 'Mesa.exe',
    dataDirName: 'Mesa',
    appId: 'local.mesa.pokeidle',
  });
}());

if (typeof module !== 'undefined' && module.exports) module.exports = AppBrand;
