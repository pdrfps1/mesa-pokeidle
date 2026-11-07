'use strict';

// Empacota a ilha React (ui/main.tsx) em src/renderer/react/mesa-ui.js.
// Equivale ao antigo comando esbuild do package.json, sem depender do shell.
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');

esbuild.build({
  entryPoints: [path.join(root, 'ui', 'main.tsx')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: path.join(root, 'src', 'renderer', 'react', 'mesa-ui.js'),
}).catch(() => process.exit(1));
