'use strict';

const { httpsRequest, sanitize, rateLimit, getIp, verifyOpsAuth } = require('../shared');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 60)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
  if (!await verifyOpsAuth(req)) return res.status(401).json({ error: 'No autorizado' });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Config incompleta' });

  const auth    = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  const headers = { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  if (req.method === 'GET') {
    const r = await httpsRequest('GET', `${SB_URL}/rest/v1/leads?select=*&order=created_at.desc`, auth);
    return res.status(r.status).json(JSON.parse(r.body || '[]'));
  }

  if (req.method === 'PATCH') {
    const id = sanitize(req.query?.id || '', 60);
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const b = req.body || {};
    const allowed = ['status','prioridad','nota','mrr','plan','canal','reunion_fecha','session_notas',
                     'propuesta_url','contrato_url','github_url','notion_url','cal_link','sector','empresa',
                     'nombre','email','telefono','tipoprecio'];
    const patch = {};
    for (const k of allowed) {
      if (b[k] !== undefined) patch[k] = k==='mrr' ? (Number(b[k])||0) : sanitize(String(b[k]),1000);
    }
    // historial es JSONB — no sanitizar como string
    if (b.historial !== undefined && Array.isArray(b.historial)) patch.historial = b.historial;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nada que actualizar' });
    const r = await httpsRequest('PATCH', `${SB_URL}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, headers, patch);
    return res.status(r.status >= 400 ? r.status : 200).json({ ok: true });
  }

  return res.status(405).end();
};
