'use strict';

// Licencias de prueba de Mesa Cero en OPS (/ops/licencias).
//   GET  /api/ops/licencias                      → todas las pruebas con uso real
//   POST /api/ops/licencias { slug, accion, dias, nota }
//        accion: extender | convertir | vencer | reactivar | nota
// Las licencias viven en el Supabase de Mesa Cero (no en el de HORIZON): se usan
// las funciones de supabase-migration-licencias-prueba-ops.sql (repo mesa-cero)
// con MESA_CERO_SERVICE_KEY, solo después de validar la sesión OPS.

const { httpsRequest, sanitize, rateLimit, getIp, opsAuth } = require('../shared');

const MC_URL = 'https://wpljybwutgxvjjlmbdxc.supabase.co';
const SLUG = /^prueba-[a-z0-9]{6}$/;
const ACCIONES = ['extender', 'convertir', 'vencer', 'reactivar', 'nota'];

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método no permitido' });
  if (rateLimit(getIp(req), 60_000, 120)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
  const ctx = await opsAuth(req);
  if (!ctx) return res.status(401).json({ error: 'No autorizado' });

  const KEY = process.env.MESA_CERO_SERVICE_KEY;
  if (!KEY) return res.status(503).json({ error: 'Falta MESA_CERO_SERVICE_KEY en el servidor' });
  const h = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'GET') {
      const r = await httpsRequest('POST', `${MC_URL}/rest/v1/rpc/licencias_prueba_resumen`, h, {});
      if (r.status >= 400) {
        console.error('[ops/licencias] resumen', r.status, r.body);
        return res.status(502).json({ error: 'No se pudieron leer las licencias. ¿Corriste la migración de OPS en Mesa Cero?' });
      }
      return res.status(200).json({ licencias: JSON.parse(r.body || '[]') });
    }

    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const slug = String(body.slug || '');
    const accion = String(body.accion || '');
    if (!SLUG.test(slug)) return res.status(400).json({ error: 'Licencia inválida' });
    if (!ACCIONES.includes(accion)) return res.status(400).json({ error: 'Acción inválida' });
    const dias = Math.max(1, Math.min(60, parseInt(body.dias, 10) || 7));
    const r = await httpsRequest('POST', `${MC_URL}/rest/v1/rpc/licencia_prueba_accion`, h,
      { p_slug: slug, p_accion: accion, p_dias: dias, p_nota: accion === 'nota' ? sanitize(body.nota, 500) : null });
    if (r.status >= 400) {
      console.error('[ops/licencias] accion', r.status, r.body);
      return res.status(502).json({ error: 'No se pudo aplicar la acción' });
    }
    return res.status(200).json({ ok: true, licencia: JSON.parse(r.body || 'null') });
  } catch (e) {
    console.error('[ops/licencias]', e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
};
