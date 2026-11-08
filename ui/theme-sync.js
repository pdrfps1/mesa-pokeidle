'use strict';

/*
 * Mantém a classe .dark em <html> em sincronia com data-theme, que a Mesa
 * troca entre "mesa" (escuro) e "mesa-claro". Sem atributo, vale o escuro.
 * Funciona como CommonJS (testes com node) e como script de navegador.
 */

function syncDarkClass(root) {
  if (!root) return;
  const isLight = root.getAttribute('data-theme') === 'mesa-claro';
  root.classList.toggle('dark', !isLight);
}

function watchTheme(root) {
  if (!root) return null;
  syncDarkClass(root);
  if (typeof MutationObserver === 'undefined') return null;
  const observer = new MutationObserver(() => syncDarkClass(root));
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return observer;
}

const themeSync = { syncDarkClass, watchTheme };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = themeSync;
}
if (typeof window !== 'undefined') {
  window.mesaThemeSync = themeSync;
}
