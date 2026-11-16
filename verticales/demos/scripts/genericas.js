// Convierte las demos armadas para negocios reales en demos genéricas ("Tu …"):
// mismo catálogo y reglas, sin el nombre, la dirección ni los links del negocio.
// Publica la versión genérica con un slug nuevo y apaga la original.
// Uso: DEMOS_TOKEN=… node scripts/genericas.js [--publicar]   (sin --publicar solo muestra el resultado)

import { config } from '../src/config.js';
import { validarFicha } from '../src/ficha.js';

const MAPA = {
  'hospital-burgers': {
    slug: 'hamburgueseria', nombre: 'Tu Hamburguesería', asistente: null,
    quitar: ['Hospital Burgers Gamero', 'Hospital Burgers Rabanal', 'Hospital Burgers'],
    tono: 'Cercano, rápido y con onda de hamburguesería de barrio. Claro con los precios.',
    locales: [['Local Centro', 'Av. Principal 100'], ['Local Norte', 'Calle Los Aromos 250']],
  },
  'cafe-boutique': {
    slug: 'pasteleria-cafe', nombre: 'Tu Pastelería y Café', asistente: 'Dulce',
    quitar: ['Andrea Escobar Cake Boutique', 'Cake Boutique y Café Boutique', 'Cake Boutique', 'Café Boutique', 'Andrea Escobar', ['Andrea', 'Dulce'], ['Barrio El Tenis', 'centro']],
    locales: [['Pastelería', 'Calle Las Rosas 120']],
  },
  'clinica-dental-recreo': {
    slug: 'clinica-dental', nombre: 'Tu Clínica Dental', asistente: 'Valentina',
    quitar: ['Clínica Dental Recreo', 'sector Recreo', 'Av. Recreo', 'Recreo'],
    locales: [['Clínica', 'Av. Principal 300, oficina 12']],
  },
  'medic-center-dental': {
    slug: 'centro-dental', nombre: 'Tu Centro Dental', asistente: 'Antonia',
    quitar: ['Medic Center · Clínica Dental', 'Medic Center', 'Alberto Einstein 290', 'Einstein'],
    locales: [['Centro dental', 'Av. Principal 500, oficina 4']],
  },
};

function reemplazar(v, quitar, nombre) {
  if (typeof v === 'string') return quitar.reduce((s, q) => Array.isArray(q) ? s.split(q[0]).join(q[1]) : s.split(q).join(nombre), v);
  if (Array.isArray(v)) return v.map(x => reemplazar(x, quitar, nombre));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, reemplazar(x, quitar, nombre)]));
  return v;
}

function generica(original, m) {
  const f = reemplazar(structuredClone(original), m.quitar, m.nombre);
  f.slug = m.slug;
  delete f.motor; delete f.tenant;            // sin Mesa Cero: responde la IA con esta ficha (Mesa Cero usa el nombre real)
  if (m.tono) f.tono = m.tono;
  f.nombre = m.nombre;
  if (m.asistente) f.asistente = m.asistente; else delete f.asistente;
  const horarios = (original.locales || []).map(l => l.horario);
  f.locales = m.locales.map(([nombre, direccion], i) => ({ nombre, direccion, comuna: 'Rancagua', horario: horarios[i] || horarios[0] || original.horario || '' }));
  f.fuentes = ['demo genérica de HORIZON: catálogo de ejemplo de un negocio del rubro'];
  f.notas_internas = `Demo genérica (HORIZON) basada en la demo "${original.slug}". Sin nombre, dirección ni links del negocio original.`;
  f.activa = true;
  return f;
}

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.api.token}` };
const r = await fetch(`${config.api.url}?desde=1970-01-01T00:00:00Z`, { headers });
const { fichas = [] } = await r.json();
const publicar = process.argv.includes('--publicar');

for (const [viejo, m] of Object.entries(MAPA)) {
  const fila = fichas.find(x => x.slug === viejo);
  if (!fila) { console.log(`· ${viejo}: no está en la base, se omite`); continue; }
  const nueva = generica(fila.ficha, m);
  const texto = JSON.stringify(nueva);
  const restos = m.quitar.map(q => Array.isArray(q) ? q[0] : q).filter(q => texto.includes(q));
  const { errores } = validarFicha(nueva);
  console.log(`${viejo} → ${nueva.slug} · "${nueva.nombre}" · restos del nombre real: ${restos.length ? restos.join(', ') : 'ninguno'} · errores: ${errores.length ? errores.join('; ') : 'ninguno'}`);
  console.log(`   saludo: ${nueva.saludo}`);
  if (!publicar || restos.length || errores.length) continue;
  const p = await fetch(config.api.url, { method: 'POST', headers, body: JSON.stringify({ ficha: nueva }) });
  const a = await fetch(config.api.url, { method: 'POST', headers, body: JSON.stringify({ ficha: { ...fila.ficha, activa: false } }) });
  console.log(`   publicada: ${p.status} · original apagada: ${a.status}`);
}
