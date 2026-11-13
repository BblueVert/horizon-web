'use strict';

// Panel de las demos en OPS (/ops/demos): lo que "le llegó al dueño" en cada demo.
//   GET /api/ops/demos             → negocios con demo publicada (demo_fichas)
//   GET /api/ops/demos?slug=<slug> → pedidos, reservas y consultas de esa demo (demo_acciones),
//                                    tanto del bot de WhatsApp (Horizon Pruebas) como del chat web.
// demo_* no tiene policies (migración 015): se lee con service role después de validar la sesión OPS.

const { httpsRequest, rateLimit, getIp, opsAuth } = require('../shared');

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  if (rateLimit(getIp(req), 60_000, 120)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
  const ctx = await opsAuth(req);
  if (!ctx) return res.status(401).json({ error: 'No autorizado' });

  const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Supabase no configurado' });
  const sb = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  try {
    const slug = String((req.query && req.query.slug) || '');
    if (!slug) {
      const r = await httpsRequest('GET', `${SB_URL}/rest/v1/demo_fichas?select=slug,nombre,rubro,activa,updated_at&order=updated_at.desc&limit=100`, sb);
      return res.status(r.status === 200 ? 200 : 502).json({ fichas: JSON.parse(r.body || '[]') });
    }
    if (!SLUG.test(slug)) return res.status(400).json({ error: 'slug inválido' });
    const [f, a] = await Promise.all([
      httpsRequest('GET', `${SB_URL}/rest/v1/demo_fichas?slug=eq.${slug}&select=slug,nombre,rubro&limit=1`, sb),
      httpsRequest('GET', `${SB_URL}/rest/v1/demo_acciones?slug=eq.${slug}&select=id,telefono,tipo,resumen,datos,created_at&order=created_at.desc&limit=60`, sb),
    ]);
    return res.status(200).json({
      ficha: (JSON.parse(f.body || '[]')[0]) || null,
      acciones: a.status === 200 ? JSON.parse(a.body || '[]') : [],
    });
  } catch (e) {
    return res.status(500).json({ error: 'Error interno' });
  }
};
