// Fichas disponibles: las de la carpeta local (fichas/*.json) + las publicadas en
// /api/demos (Claude en terreno). La API manda; se guarda copia en datos/ para
// arrancar sin internet.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';
import { validarFicha } from './ficha.js';

export function crearFichas({ log = console, alNueva = () => {} } = {}) {
  const fichas = new Map();
  const rutaCache = join(config.bot.carpetaDatos, 'fichas-api.json');
  let desde = null;
  let numero = '';

  function poner(f, origen) {
    const { errores } = validarFicha(f);
    if (errores.length) { log.warn(`[fichas] ${f?.slug || '?'} (${origen}) inválida: ${errores[0]}`); return false; }
    const antes = fichas.get(f.slug);
    if (f.activa === false) { fichas.delete(f.slug); return false; }
    fichas.set(f.slug, { ...f, _origen: origen });
    return !antes;
  }

  function cargarLocales() {
    const dir = config.bot.carpetaFichas;
    if (!existsSync(dir)) return;
    for (const archivo of readdirSync(dir).filter(a => a.endsWith('.json'))) {
      try { poner(JSON.parse(readFileSync(join(dir, archivo), 'utf8')), 'local'); }
      catch (e) { log.warn(`[fichas] ${archivo}: ${e.message}`); }
    }
  }

  function cargarCache() {
    if (!existsSync(rutaCache)) return;
    try {
      const c = JSON.parse(readFileSync(rutaCache, 'utf8'));
      for (const f of c.fichas || []) poner(f, 'api');
      desde = c.desde || null;
    } catch {}
  }

  function guardarCache() {
    mkdirSync(config.bot.carpetaDatos, { recursive: true });
    const deApi = [...fichas.values()].filter(f => f._origen === 'api');
    writeFileSync(rutaCache, JSON.stringify({ desde, fichas: deApi }, null, 1));
  }

  async function sincronizar() {
    if (!config.api.token) return;
    const url = `${config.api.url}${desde ? `?desde=${encodeURIComponent(desde)}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.api.token}`, ...(numero ? { 'x-demo-numero': numero } : {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`API demos respondió ${res.status}`);
    const { fichas: nuevas = [], ahora } = await res.json();
    const primera = !desde; // al arrancar sin caché llegan todas: no se avisa una por una
    for (const fila of nuevas) {
      const f = { ...fila.ficha, slug: fila.slug, activa: fila.activa };
      if (f.activa === false) { fichas.delete(f.slug); continue; }
      const esNueva = poner(f, 'api');
      if (!primera && fichas.has(f.slug)) alNueva(fichas.get(f.slug), esNueva);
    }
    desde = ahora || desde;
    if (nuevas.length) guardarCache();
  }

  function iniciar() {
    cargarLocales();
    cargarCache(); // después de las locales: si hay una con el mismo slug, manda la de la API
    const ciclo = () => sincronizar().catch(e => log.warn('[fichas] sync:', e.message));
    ciclo();
    if (config.api.token) setInterval(ciclo, config.api.syncSeg * 1000);
    else log.warn('[fichas] DEMOS_TOKEN vacío: solo se usan las fichas locales de', config.bot.carpetaFichas);
  }

  // Prueba de 15 días (prueba-xxxxxx): no tiene ficha propia. Si la licencia está vigente,
  // se arma una al vuelo con el motor de Mesa Cero, que responde con la carta de ese tenant.
  async function asegurarPrueba(slug) {
    if (!/^prueba-[a-z0-9]{6}$/.test(String(slug || ''))) return null;
    if (fichas.has(slug)) return fichas.get(slug);
    try {
      const { url, anon } = config.mesaCero;
      const res = await fetch(`${url}/rest/v1/rpc/licencia_prueba_estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
        body: JSON.stringify({ p_slug: slug }),
        signal: AbortSignal.timeout(10000),
      });
      const lic = res.ok ? await res.json() : null;
      if (!lic || !lic.activa) return null;
      poner({ slug, nombre: lic.nombre || 'tu local', rubro: 'restaurante', flujo: 'pedidos', motor: 'mesa-cero', tenant: slug, locales: [] }, 'prueba');
      return fichas.get(slug) || null;
    } catch (e) { log.warn(`[fichas] prueba ${slug}:`, e.message); return null; }
  }

  return {
    iniciar,
    asegurarPrueba,
    sincronizar,
    cargarLocales,
    obtener: (slug) => fichas.get(slug) || null,
    todas: () => [...fichas.values()],
    ponerNumero: (n) => { numero = String(n || '').replace(/\D/g, ''); },
  };
}
