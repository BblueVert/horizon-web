#!/usr/bin/env node
// Arma el manual de identidad de una marca y lo exporta a PDF (16:9, 1920 × 1080).
// Uso: node scripts/marca-pdf.js <carpeta-con-marca.js> [--sin-pdf]
//   ej. node scripts/marca-pdf.js Identidad/manual
//       node scripts/marca-pdf.js CONTENIDO/clientes/<slug>/marca
// Genera <carpeta>/manual-identidad.html (autocontenido salvo imágenes y fuentes) y <carpeta>/manual-identidad.pdf.
// Plantilla: .claude/skills/documentos-cliente/templates/marca/manual-identidad.html
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const raiz = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const carpeta = args.find(a => !a.startsWith('--'));
if (!carpeta) {
  console.error('Uso: node scripts/marca-pdf.js <carpeta-con-marca.js> [--sin-pdf]');
  process.exit(1);
}
const dir = path.resolve(carpeta);
const datos = path.join(dir, 'marca.js');
if (!fs.existsSync(datos)) {
  console.error(`No existe ${path.relative(process.cwd(), datos)}. Copia Identidad/manual/marca.js como base.`);
  process.exit(1);
}

const plantilla = fs.readFileSync(path.join(raiz, '.claude/skills/documentos-cliente/templates/marca/manual-identidad.html'), 'utf8');
const sprite = fs.readFileSync(path.join(raiz, 'shared/hz-sprite.svg'), 'utf8')
  .replace(/^<\?xml[^>]*>\s*/, '')
  .replace('<svg ', '<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden" ');
const marca = fs.readFileSync(datos, 'utf8');

// Fuentes del cliente (solo para los ejemplos). Se leen sin ejecutar marca.js en Node.
const fuentes = (marca.match(/fuentes_google:\s*'([^']+)'/) || [])[1];
const linkFuentes = fuentes && !/Plus\+Jakarta\+Sans/.test(fuentes)
  ? `<link href="https://fonts.googleapis.com/css2?${fuentes}&display=swap" rel="stylesheet">` : '';

// Imágenes en <carpeta>/img/IMG-NN.(webp|jpg|png): se cargan solas en su espacio (ver prompts-imagenes.md).
const dirImg = path.join(dir, 'img');
const encontradas = fs.existsSync(dirImg) ? Object.fromEntries(fs.readdirSync(dirImg)
  .map(f => [f.match(/^(IMG-\d{2})\.(webp|jpe?g|png)$/i), f]).filter(([m]) => m)
  .map(([m, f]) => [m[1].toUpperCase(), `img/${f}`])) : {};
const extra = Object.keys(encontradas).length
  ? `<script>window.MARCA.imagenes = Object.assign(${JSON.stringify(encontradas)}, window.MARCA.imagenes || {});</script>` : '';

const html = plantilla
  .replace('<!--FUENTES_CLIENTE-->', linkFuentes)
  .replace('<!--SPRITE-->', sprite)
  .replace('<!--MARCA-->', () => `<script>\n${marca.replace(/<\/script/gi, '<\\/script')}\n</script>${extra}`);
const salida = path.join(dir, 'manual-identidad.html');
fs.writeFileSync(salida, html);
console.log(`✓ ${path.relative(process.cwd(), salida)} · imágenes: ${Object.keys(encontradas).length}`);
if (args.includes('--sin-pdf')) process.exit(0);

const pdf = salida.replace(/\.html$/, '.pdf');

(async () => {
  // 1) Playwright si está disponible (espera fuentes, imágenes y el QR).
  let playwright;
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try { playwright = require(p); break; } catch (_) {}
  }
  if (playwright) {
    const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
    const browser = await playwright.chromium.launch(proxy ? { proxy } : {});
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
    await page.goto(pathToFileURL(salida).href, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.MANUAL_LISTO === true);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    });
    await page.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
    await browser.close();
  } else {
    // 2) Chrome del sistema, igual que scripts/doc-pdf.js.
    const candidatos = [process.env.CHROME_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
    const chrome = candidatos.find(p => fs.existsSync(p));
    if (!chrome) {
      console.error('No encontré Chrome. Abre el HTML en el navegador → Imprimir → Guardar como PDF (márgenes: ninguno, gráficos de fondo: sí).');
      process.exit(1);
    }
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000',
      `--print-to-pdf=${pdf}`, pathToFileURL(salida).href], { stdio: 'ignore' });
  }
  console.log(`✓ ${path.relative(process.cwd(), pdf)}`);
})().catch(e => { console.error(e.message); process.exit(1); });
