// Exporta cada [data-out] de un HTML como PNG transparente (2x).
// Uso: NODE_PATH=$(npm root -g) node .claude/skills/carrusel/plantilla/exportar.js <archivo.html> <carpeta-salida>
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
(async () => {
  const [html, outDir] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2400, height: 1400 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(html)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  for (const el of await p.$$('[data-out]')) {
    const f = path.join(outDir, await el.getAttribute('data-out') + '.png');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    await el.screenshot({ path: f, omitBackground: false });
  }
  console.log('ok', (await p.$$('[data-out]')).length); await b.close();
})();
