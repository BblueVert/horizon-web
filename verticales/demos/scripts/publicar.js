// Publica una ficha en /api/demos para que el bot de demos la tome (≤ 20 s).
// Lo usa Claude en terreno, también desde la nube (solo necesita DEMOS_TOKEN).
// Uso: npm run publicar -- fichas/tia-julia.json [--qr salida.png]

import { readFileSync } from 'node:fs';
import QRCode from 'qrcode';
import { config } from '../src/config.js';
import { validarFicha, linkDemo } from '../src/ficha.js';

const [ruta, ...resto] = process.argv.slice(2);
const qrIdx = resto.indexOf('--qr');
const rutaQr = qrIdx >= 0 ? resto[qrIdx + 1] : null;
if (!ruta) { console.error('Uso: npm run publicar -- <ficha.json> [--qr salida.png]'); process.exit(1); }

const ficha = JSON.parse(readFileSync(ruta, 'utf8'));
const { errores, avisos } = validarFicha(ficha);
for (const a of avisos) console.log(`aviso: ${a}`);
if (errores.length) { for (const e of errores) console.error(`error: ${e}`); process.exit(1); }
if (!config.api.token) { console.error('Falta DEMOS_TOKEN (variable de entorno o .env).'); process.exit(1); }

const res = await fetch(config.api.url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.api.token}` },
  body: JSON.stringify({ ficha }),
  signal: AbortSignal.timeout(20000),
});
const data = await res.json().catch(() => ({}));
if (!res.ok) { console.error(`La API respondió ${res.status}: ${data.error || ''} ${data.detalle || ''}`); process.exit(1); }

// Horizon Pruebas = número de la consultoría (+56 9 7696 2659), el mismo del agente de Mesa Cero.
const numero = data.bot?.numero || process.env.DEMO_NUMERO || '56976962659';
const visto = data.bot?.visto_at ? Math.round((Date.now() - Date.parse(data.bot.visto_at)) / 1000) : null;
console.log(`publicada: ${ficha.slug}`);
if (visto === null) console.log('bot: nunca se ha conectado (¿está corriendo npm start en el equipo?)');
else console.log(visto < 90 ? `bot: en línea (sincronizó hace ${visto} s)` : `bot: SIN CONEXIÓN hace ${Math.round(visto / 60)} min`);

if (numero) {
  const link = linkDemo(numero, ficha);
  console.log(`link: ${link}`);
  if (rutaQr) {
    await QRCode.toFile(rutaQr, link, { width: 600, margin: 2 });
    console.log(`qr: ${rutaQr}`);
  }
} else {
  console.log('link: falta el número (el bot aún no se conecta y no hay DEMO_NUMERO)');
}
