#!/usr/bin/env node
// Capa 5 — copia las piezas de contenido de .claude/ al plugin horizon-kit.
// .claude/ es la única fuente de verdad: edita ahí y corre `npm run plugin:sync`.
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, '.claude');
const dest = path.join(root, 'plugins', 'horizon-kit');

const PIEZAS = {
  skills: ['reels', 'carrusel', 'stories'],
  agents: ['copy-reviewer.md', 'reel-writer.md', 'carrusel-maker.md', 'stories-builder.md'],
  hooks: ['pre-escritura.js', 'frases-ia.txt', 'voseo.txt'],
};

for (const [dir, items] of Object.entries(PIEZAS)) {
  for (const item of items) {
    const to = path.join(dest, dir, item);
    fs.rmSync(to, { recursive: true, force: true });
    fs.cpSync(path.join(src, dir, item), to, { recursive: true });
    console.log(`✓ ${dir}/${item}`);
  }
}

const manifest = path.join(dest, '.claude-plugin', 'plugin.json');
const { version } = JSON.parse(fs.readFileSync(manifest, 'utf8'));
console.log(`\nhorizon-kit v${version} sincronizado. Si cambió algo, sube la versión en plugin.json.`);
