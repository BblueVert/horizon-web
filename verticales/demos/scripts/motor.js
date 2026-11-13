// Pasa una demo ya publicada a un motor real (o la devuelve a la IA por rubro), sin tocar el resto de la ficha.
// Ej.: npm run motor -- cafe-boutique mesa-cero      → sus pedidos caen al panel de Mesa Cero (tenant = slug)
//      npm run motor -- cafe-boutique mesa-cero otro → tenant distinto al slug
//      npm run motor -- cafe-boutique off            → vuelve a la IA por rubro

import { config } from '../src/config.js';

const [slug, motor, tenant] = process.argv.slice(2);
if (!slug || !motor) { console.error('Uso: npm run motor -- <slug> <motor|off> [tenant]'); process.exit(1); }
if (!config.api.token) { console.error('Falta DEMOS_TOKEN (.env).'); process.exit(1); }
const auth = { Authorization: `Bearer ${config.api.token}` };

const r = await fetch(config.api.url, { headers: auth, signal: AbortSignal.timeout(20000) });
if (!r.ok) { console.error(`La API respondió ${r.status}`); process.exit(1); }
const fila = ((await r.json()).fichas || []).find(f => f.slug === slug);
if (!fila) { console.error(`No hay una demo publicada con el slug "${slug}".`); process.exit(1); }

const ficha = { ...fila.ficha, slug };
if (motor === 'off') { delete ficha.motor; delete ficha.tenant; }
else { ficha.motor = motor; ficha.tenant = tenant || slug; }

const p = await fetch(config.api.url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({ ficha }), signal: AbortSignal.timeout(20000),
});
const data = await p.json().catch(() => ({}));
if (!p.ok) { console.error(`La API respondió ${p.status}: ${data.error || ''} ${data.detalle || ''}`); process.exit(1); }
console.log(motor === 'off' ? `${slug}: vuelve a la IA por rubro` : `${slug}: ahora responde con el motor ${motor} (tenant ${ficha.tenant})`);
console.log('El bot lo toma solo en unos 20 segundos.');
