// Convierte una plantilla HTML en el PDF base de un documento de demo y mide dónde va cada dato.
//   node scripts/medir-plantilla.js <plantilla.html> <salida.pdf>
// En el HTML, cada espacio a completar lleva data-campo="<clave>" (puede repetirse): un elemento
// con línea inferior (el texto se apoya sobre ella) o una celda (el texto va centrado).
// Imprime el arreglo "campos" para la ficha (documento.campos), en puntos PDF.
// Se mide sobre el PDF real: se imprime una versión con marcas en cada espacio y se leen sus
// coordenadas con pdftotext (poppler). Necesita Playwright y pdftotext, solo donde se arma la plantilla.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const [html, pdf] = process.argv.slice(2);
if (!html || !pdf) { console.error('Uso: node scripts/medir-plantilla.js <plantilla.html> <salida.pdf>'); process.exit(1); }

const ALTO_PT = 841.89; // A4
const opciones = { format: 'A4', printBackground: true, preferCSSPageSize: true };
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.emulateMedia({ media: 'print' });
await pagina.goto(pathToFileURL(resolve(html)).href, { waitUntil: 'networkidle' });
await pagina.evaluate(() => document.fonts.ready);

// 1. PDF base, sin marcas.
await pagina.pdf({ path: pdf, ...opciones });

// 2. PDF de medición: una marca por espacio, en posición absoluta para no mover el diseño.
const info = await pagina.evaluate(() => [...document.querySelectorAll('[data-campo]')].map((el, i) => {
  const celda = el.tagName === 'TD';
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  const m = document.createElement('span');
  m.textContent = `ZZ${i}ZZ`;
  Object.assign(m.style, {
    position: 'absolute', left: '0', whiteSpace: 'nowrap', fontSize: '10pt', lineHeight: '1', color: '#000',
    fontFamily: 'Arial, sans-serif', fontStyle: 'normal', fontWeight: '400', letterSpacing: '0',
    ...(celda ? { top: '50%', transform: 'translateY(-50%)' } : { bottom: '3px' }),
  });
  el.appendChild(m);
  return { clave: el.dataset.campo, celda };
}));
const dir = mkdtempSync(join(tmpdir(), 'plantilla-'));
await pagina.pdf({ path: join(dir, 'marcas.pdf'), ...opciones });
await navegador.close();

execFileSync('pdftotext', ['-bbox', join(dir, 'marcas.pdf'), join(dir, 'marcas.html')]);
const xml = readFileSync(join(dir, 'marcas.html'), 'utf8');
const paginas = xml.split(/<page\b/).slice(1);
const pos = new Map();
paginas.forEach((p, n) => {
  for (const w of p.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">ZZ(\d+)ZZ<\/word>/g)) {
    pos.set(Number(w[5]), { pagina: n, xMin: +w[1], yMin: +w[2], yMax: +w[4] });
  }
});

// El ancho del espacio se toma de su línea o celda: se mide en el navegador (horizontal no cambia al imprimir).
const r1 = (n) => Math.round(n * 10) / 10;
const anchos = await (async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.emulateMedia({ media: 'print' });
  await p.goto(pathToFileURL(resolve(html)).href, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const a = await p.evaluate(() => [...document.querySelectorAll('[data-campo]')].map(el => {
    const r = el.getBoundingClientRect(), h = el.closest('.pag').getBoundingClientRect();
    return { x: (r.left - h.left) * 0.75, ancho: r.width * 0.75 };
  }));
  await b.close(); return a;
})();

const campos = info.map((c, i) => {
  const p = pos.get(i);
  if (!p) throw new Error(`no encontré la marca del campo "${c.clave}" (#${i}) en el PDF`);
  // Línea: la base de la marca (sin descendentes) es donde se apoya el texto.
  // Celda: el centro de la marca, bajado 3,4 pt para centrar un texto de ~9,5 pt.
  const y = c.celda ? ALTO_PT - ((p.yMin + p.yMax) / 2 + 3.4) : ALTO_PT - p.yMax + 2;
  return { clave: c.clave, pagina: p.pagina, x: r1(anchos[i].x), y: r1(y), ancho: r1(anchos[i].ancho), alinear: c.celda ? 'centro' : 'izquierda' };
});
console.log(JSON.stringify(campos, null, 2));
