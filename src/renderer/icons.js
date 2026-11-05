/* Ícones outline da Mesa — traço simples, currentColor no DOM; máscara preta para data-icon. */

var MESA_ICON_NAMES = [
  'abrir', 'fechar', 'sair', 'escala', 'automatico', 'capturar', 'repetir', 'revive', 'pocao',
  'voltar', 'mudo', 'economia', 'ultra', 'recarregar', 'igualar', 'renomear', 'tirar', 'cancelar',
  'grade', 'fila', 'coluna', 'livre', 'mapa', 'pokedex', 'depot', 'boss', 'market', 'mesa', 'dock-auto', 'espera', 'ajustes',
  'kpi-caca', 'kpi-med', 'kpi-parada', 'kpi-sem',
  'sol', 'nuvem', 'lua', 'engrenagem', 'gota', 'folha', 'fantasma', 'estrela',
  'nivel', 'estrela-xp', 'moeda', 'ram', 'bola',
  'chevron-esquerda', 'chevron-direita', 'chevron-cima', 'chevron-baixo',
];

var MESA_ICON_PATHS = {
  abrir: '<path d="M2.2 3.2h7.2v9.6H2.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 8h3M12.4 6.3 14.2 8 12.4 9.7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  fechar: '<path d="M2.2 3.2h11.6v9.6H2.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6.2 10 10.2M10 6.2 6 10.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  sair: '<path d="M9 2.8h4.2v10.4H9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.2 8h6.2M6.2 5.6 8.6 8 6.2 10.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  escala: '<path d="M2.2 6.2V2.2H6.2M9.8 2.2h4V6.2M13.8 9.8v4H9.8M6.2 13.8H2.2V9.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  automatico: '<path d="M12.6 6.2a4.8 4.8 0 1 0 1 3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.2 2.4v3.4h-3.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  capturar: '<path d="M4.2 4.2h7.6v7.6H4.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.4 8h3.2M8 6.4v3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  repetir: '<path d="M2.4 6h8.2M8.6 3.6 11.2 6 8.6 8.4M13.6 10H5.4M7.4 7.6 4.8 10 7.4 12.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  revive: '<circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5.2v5.6M5.2 8h5.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  pocao: '<path d="M6.4 2.4h3.2M7.2 2.4v3.2M8.8 2.4v3.2M5.2 5.8h5.6v5a2.8 2.8 0 0 1-5.6 0z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  voltar: '<path d="M6.2 4.4 3.2 7.2l3 2.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.2 7.2h6a3 3 0 1 1 0 6H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  mudo: '<path d="M2.6 6.2h2.2L8 3.6v8.8L4.8 9.8H2.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.6 6.2 13.8 9.8M13.8 6.2 10.6 9.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  economia: '<path d="M3.2 12.6V4.2M8 12.6V7.2M12.8 12.6v-2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  ultra: '<path d="M4.4 12.8V8.2h7.2v4.6M5.6 8.2V6.4L8 4.8l2.4 1.6v1.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  recarregar: '<path d="M3.4 6.2A4.8 4.8 0 0 1 12.2 4.8M12.6 2.2v3.2H9.4M12.6 9.8A4.8 4.8 0 0 1 3.8 11.2M3.4 13.8v-3.2h3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  igualar: '<path d="M1.8 6h2.5v4H1.8zM5.1 6h2.5v4H5.1zM8.4 6h2.5v4H8.4zM11.7 6h2.5v4h-2.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  renomear: '<path d="M9.6 2.8 13.2 6.4 5.8 13.6H2.6v-3.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.4 4 12 7.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  tirar: '<path d="M2.2 2.2h4.4v4.4H2.2zM9.4 2.2h4.4v4.4H9.4zM2.2 9.4h4.4v4.4H2.2zM10 12.2h3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  cancelar: '<path d="M4 4l8 8M12 4 4 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  grade: '<path d="M2.2 2.2h4.6v4.6h-4.6zM9.2 2.2h4.6v4.6h-4.6zM2.2 9.2h4.6v4.6h-4.6zM9.2 9.2h4.6v4.6h-4.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  fila: '<path d="M2.2 5.4h3.2v5.2H2.2zM6.4 5.4h3.2v5.2H6.4zM10.6 5.4h3.2v5.2h-3.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  coluna: '<path d="M3.2 2.2h9.6v3H3.2zM3.2 6.5h9.6v3H3.2zM3.2 10.8h9.6v3H3.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  livre: '<path d="M2.2 2.2h6.2v5.4H2.2zM10.6 2.2h3.2v8.6h-3.2zM2.2 9.8h6.2v4H2.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10.6 12.6h3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  mapa: '<path d="M2.4 3.6 5.6 2.4l4.8 1.4 3.2-1.4v10l-3.2 1.2-4.8-1.4-3.2 1.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.6 2.4v9.8M10.4 3.8v9.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  pokedex: '<path d="M3.2 2.4h9.6v11.2H3.2zM8 2.4v11.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  depot: '<path d="M2.4 5.2 8 2.6l5.6 2.6v6L8 13.8l-5.6-2.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.4 5.2 8 7.8l5.6-2.6M8 7.8v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  boss: '<path d="M8 2.2 13.4 8 8 13.8 2.6 8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  market: '<path d="M2.6 8.2 7.6 3h5.6v5.6L8 13.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11.2" cy="5.4" r="0.9" fill="currentColor" stroke="none"/>',
  mesa: '<path d="M2.2 2.2h4.6v4.6h-4.6zM9.2 2.2h4.6v4.6h-4.6zM2.2 9.2h4.6v4.6h-4.6zM9.2 9.2h4.6v4.6h-4.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  'dock-auto': '<path d="M5 11.5V19a1.75 1.75 0 0 0 1.75 1.75h10.5A1.75 1.75 0 0 0 19 19v-7.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 11.5 12 4.5 20 11.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><rect x="8.25" y="13.25" width="7.5" height="6" rx="1.35" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round"/><path d="M8.25 14.5H6.9a.85.85 0 0 1-.85-.85v-1.05a.85.85 0 0 1 .85-.85H8.25M15.75 14.5h1.35a.85.85 0 0 0 .85-.85v-1.05a.85.85 0 0 0-.85-.85H15.75" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10.35" cy="16.2" r=".9" fill="currentColor" stroke="none"/><circle cx="13.65" cy="16.2" r=".9" fill="currentColor" stroke="none"/><path d="M12 13.25v-1.15c0-.85.55-1.35 1.2-1.35s1.2.5 1.2 1.35v1.15" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13.2" cy="10.35" r=".75" fill="currentColor" stroke="none"/>',
  espera: '<path d="M5 11.5V19a1.75 1.75 0 0 0 1.75 1.75h10.5A1.75 1.75 0 0 0 19 19v-7.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 11.5 12 4.5 20 11.5" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.25 20.75V15.5a1.75 1.75 0 0 1 3.5 0v5.25" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>',
  ajustes: '<path d="M9.95 5.30 A2.05 2.05 0 0 0 14.05 5.30 A4.55 4.55 0 0 1 16.78 6.87 A2.05 2.05 0 0 0 18.83 10.43 A4.55 4.55 0 0 1 18.83 13.57 A2.05 2.05 0 0 0 16.78 17.13 A4.55 4.55 0 0 1 14.05 18.70 A2.05 2.05 0 0 0 9.95 18.70 A4.55 4.55 0 0 1 7.22 17.13 A2.05 2.05 0 0 0 5.17 13.57 A4.55 4.55 0 0 1 5.17 10.43 A2.05 2.05 0 0 0 7.22 6.87 A4.55 4.55 0 0 1 9.95 5.30Z" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.85"/>',
  'kpi-caca': '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3.15"/><circle cx="8" cy="8" r="0.95"/><path d="M8 1.8v2.15M8 12.05v2.15M1.8 8h2.15M12.05 8h2.15"/></g>',
  'kpi-med': '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 11.4a5.6 5.6 0 0 1 10.8 0"/><path d="M8 11.2 11.5 6.4"/><path d="M5.1 6.5 5.8 7.4M8 4.6v1.3M10.9 6.5 10.2 7.4"/></g>',
  'kpi-parada': '<path d="M5.5 3.2v9.6M10.5 3.2v9.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  'kpi-sem': '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5.3" r="2.05"/><path d="M3.5 13.3c1.15-2.15 2.7-3.25 4.5-3.25s3.35 1.1 4.5 3.25"/><path d="M12.4 2.7 3.8 13.5"/></g>',
  sol: '<circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.6v1.6M8 12.8v1.6M1.6 8h1.6M12.8 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  nuvem: '<path d="M4.8 11.2h6.8a2.6 2.6 0 0 0 .2-5.2 3.4 3.4 0 0 0-6.6.8 2.2 2.2 0 0 0-.4 4.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  lua: '<path d="M10.8 2.8a5.6 5.6 0 1 0 0 10.4 4.4 4.4 0 0 1 0-10.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  engrenagem: '<circle cx="8" cy="8" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 2.2v1.6M8 12.2v1.6M2.2 8h1.6M12.2 8h1.6M4.1 4.1l1.1 1.1M10.8 10.8l1.1 1.1M4.1 11.9l1.1-1.1M10.8 5.2l1.1-1.1M8 5.8l.9-1.6h1.4l.9 1.6 1.4-.5.5 1.4-1.6.9v1.6l1.6.9-.5 1.4-1.4-.5-.9 1.6h-1.4l-.9-1.6-1.4.5-.5-1.4 1.6-.9V7.3L6.1 6.4l.5-1.4z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>',
  gota: '<path d="M8 2.4c2.8 3.6 4 6 4 8a4 4 0 1 1-8 0c0-2 1.2-4.4 4-8z" fill="currentColor"/>',
  folha: '<path d="M8 13.6c3.2-1.2 5.2-3.6 5.2-7.2C13.2 3.6 8 2.4 8 2.4S2.8 3.6 2.8 6.4c0 3.6 2 6 5.2 7.2z" fill="currentColor"/><path d="M8 13.6V6.4" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.2" stroke-linecap="round"/>',
  fantasma: '<path d="M4.8 3.2h6.4a1.6 1.6 0 0 1 1.6 1.6v5.6l-2-1.2-2 1.2-2-1.2-2 1.2V4.8a1.6 1.6 0 0 1 1.6-1.6z" fill="currentColor"/><circle cx="6.4" cy="6.8" r=".75" fill="rgba(0,0,0,0.35)"/><circle cx="9.6" cy="6.8" r=".75" fill="rgba(0,0,0,0.35)"/>',
  estrela: '<path d="M8 2.4 9.6 6.2l4 .3-3 2.6.9 3.9L8 10.8 5.5 13l.9-3.9-3-2.6 4-.3z" fill="currentColor"/>',
  nivel: '<circle cx="8" cy="5.2" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.2 13.6c1.2-2.4 2.8-3.6 4.8-3.6s3.6 1.2 4.8 3.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  'estrela-xp': '<path d="M8 2.8 9.2 6l3.2.2-2.4 2.1.7 3.1L8 10.2 6.3 11.4l.7-3.1L4.6 6.2 7.8 6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  moeda: '<circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 5.2v6M6 8h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ram: '<path d="M2.4 6.4h11.2v3.2H2.4zM4.8 9.6v2.4M8 9.6v2.4M11.2 9.6v2.4M4 4.8V3.2M8 4.8V3.2M12 4.8V3.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  bola: '<circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.6 8h10.8M8 2.6a5.4 5.4 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  'chevron-esquerda': '<path d="M10.2 3.2 5.8 8l4.4 4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  'chevron-direita': '<path d="M5.8 3.2 10.2 8l-4.4 4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  'chevron-cima': '<path d="M3.2 10.2 8 5.8l4.8 4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  'chevron-baixo': '<path d="M3.2 5.8 8 10.2l4.8-4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
};

var MESA_DOCK_ICON_NAMES = { 'dock-auto': 1, espera: 1, ajustes: 1 };

function mesaIcon(name) {
  const body = MESA_ICON_PATHS[name];
  if (!body) return '';
  const dock = MESA_DOCK_ICON_NAMES[name];
  const vb = dock ? '0 0 24 24' : '0 0 16 16';
  const size = dock ? 24 : 16;
  return `<svg viewBox="${vb}" width="${size}" height="${size}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

var MESA_KPI_ICON_PATHS = {
  'kpi-caca': '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3.15"/><circle cx="8" cy="8" r="0.95"/><path d="M8 1.8v2.15M8 12.05v2.15M1.8 8h2.15M12.05 8h2.15"/></g>',
  'kpi-med': '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 11.4a5.6 5.6 0 0 1 10.8 0"/><path d="M8 11.2 11.5 6.4"/><path d="M5.1 6.5 5.8 7.4M8 4.6v1.3M10.9 6.5 10.2 7.4"/></g>',
  'kpi-parada': '<path d="M5.5 3.2v9.6M10.5 3.2v9.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  'kpi-sem': '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5.3" r="2.05"/><path d="M3.5 13.3c1.15-2.15 2.7-3.25 4.5-3.25s3.35 1.1 4.5 3.25"/><path d="M12.4 2.7 3.8 13.5"/></g>',
};

function mesaKpiIcon(name) {
  const body = MESA_KPI_ICON_PATHS[name];
  if (!body) return mesaIcon(name);
  return `<svg viewBox="0 0 16 16" width="44" height="44" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function mesaIconMaskUrl(name) {
  const body = MESA_ICON_PATHS[name];
  if (!body) return '';
  const maskBody = body
    .replace(/currentColor/g, '#000')
    .replace(/fill="none"/g, 'fill="none"')
    .replace(/fill="currentColor"/g, 'fill="#000"');
  const dock = MESA_DOCK_ICON_NAMES[name];
  const vb = dock ? '0 0 24 24' : '0 0 16 16';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${maskBody}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function mesaLogoSvg() {
  return `<svg viewBox="0 0 36 36" width="36" height="36" overflow="visible" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 18 A14 14 0 0 1 32 18" fill="none" stroke="#ff4d4d" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M32 18 A14 14 0 0 1 4 18" fill="none" stroke="#3aa0ff" stroke-width="2.8" stroke-linecap="round"/>
    <line x1="4" y1="18" x2="32" y2="18" stroke="rgba(255,255,255,0.82)" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="18" cy="18" r="4" fill="#f4f7fb"/>
  </svg>`;
}

(function injectMesaIconStyles() {
  let css = '';
  for (const name of MESA_ICON_NAMES) {
    css += `[data-icon="${name}"]{--ico:url("${mesaIconMaskUrl(name)}");}\n`;
  }
  css += `:root{--ico-bola:url("${mesaIconMaskUrl('bola')}");}\n`;
  css += `.limiar-range{--ico:url("${mesaIconMaskUrl('bola')}");}\n`;
  const node = document.createElement('style');
  node.id = 'mesa-icon-vars';
  node.textContent = css;
  document.head.appendChild(node);
})();
