'use strict';

// Panel público de una demo (/visita/<slug>/panel): lo que "le llegó al dueño" en esa demo, sin login.
// Solo lectura, solo demos activas, últimos 7 días, y el teléfono enmascarado (son personas que probaron el bot).
//   GET /api/demo-panel?slug=<slug>

const { httpsRequest, rateLimit, getIp } = require('./shared');

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const enmascarar = t => {
  const d = String(t || '').replace(/\D/g, '');
  if (!d || t === 'web') return t === 'web' ? 'web' : '';
  return '+' + d.slice(0, 3) + ' ••• •• ' + d.slice(-3);
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  if (rateLimit(getIp(req), 60_000, 40)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
  const slug = String((req.query && req.query.slug) || '');
  if (!SLUG.test(slug)) return res.status(400).json({ error: 'slug inválido' });
  const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' });
  const sb = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  try {
    const f = await httpsRequest('GET', `${SB_URL}/rest/v1/demo_fichas?slug=eq.${slug}&activa=eq.true&select=slug,nombre&limit=1`, sb);
    const ficha = (JSON.parse(f.body || '[]'))[0];
    if (!ficha) return res.status(404).json({ error: 'Demo no encontrada' });
    const desde = new Date(Date.now() - 7 * 864e5).toISOString();
    const a = await httpsRequest('GET', `${SB_URL}/rest/v1/demo_acciones?slug=eq.${slug}&created_at=gte.${encodeURIComponent(desde)}&select=id,telefono,tipo,resumen,datos,created_at&order=created_at.desc&limit=40`, sb);
    const acciones = a.status === 200 ? JSON.parse(a.body || '[]').map(x => ({ ...x, telefono: enmascarar(x.telefono) })) : [];
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ficha, acciones });
  } catch (e) {
    return res.status(500).json({ error: 'Error interno' });
  }
};
