#!/usr/bin/env node
// Convierte documentos HTML a PDF con Chrome/Chromium en modo headless (sin dependencias npm).
// Uso: node scripts/doc-pdf.js <archivo.html> [más archivos…]
// Si Chrome no está en una ruta conocida, definí CHROME_PATH.
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const CANDIDATOS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ...(fs.existsSync('/opt/pw-browsers')
    ? fs.readdirSync('/opt/pw-browsers').filter(d => d.startsWith('chromium-')).map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`)
    : []),
].filter(Boolean);

const chrome = CANDIDATOS.find(p => fs.existsSync(p));
if (!chrome) {
  console.error('No encontré Chrome/Chromium. Abrí el HTML en el navegador → Imprimir → Guardar como PDF, o definí CHROME_PATH.');
  process.exit(1);
}

const archivos = process.argv.slice(2);
if (!archivos.length) {
  console.error('Uso: node scripts/doc-pdf.js <archivo.html> [más archivos…]');
  process.exit(1);
}

for (const archivo of archivos) {
  const html = path.resolve(archivo);
  const pdf = html.replace(/\.html?$/i, '.pdf');
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--no-pdf-header-footer', '--virtual-time-budget=5000',
    `--print-to-pdf=${pdf}`, pathToFileURL(html).href,
  ], { stdio: 'ignore' });
  console.log(`✓ ${path.relative(process.cwd(), pdf)}`);
}
