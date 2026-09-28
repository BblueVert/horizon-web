'use strict';

// Portal del cliente (/c/:token) — reemplaza a la edge function portal-api.
// GET  /api/portal?token=<uuid>  → lead (datos no sensibles), proyecto, hitos y timeline
// POST /api/portal {token,brief} → guarda el brief pre-diagnóstico
//
// Usa la anon key: las políticas RLS "anon_read_*_by_token" dejan ver solo las filas
// del lead cuyo portal_token viene en el header x-portal-token. Además se filtra
// explícitamente por token en cada query, así que no depende de una sola barrera.

const { httpsRequest, rateLimit, getIp } = require('./shared');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BRIEF_KEYS = ['negocio', 'problema', 'objetivo', 'intentos'];

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  if (rateLimit(getIp(req), 60_000, req.method === 'GET' ? 30 : 20)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const ANON   = process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !ANON) return res.status(503).json({ error: 'Config incompleta' });

  const token = String((req.method === 'GET' ? req.query?.token : req.body?.token) || '');
  if (!UUID_RE.test(token)) return res.status(404).json({ error: 'Portal no encontrado' });

  const h = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'x-portal-token': token };
  const get = async (path) => {
    const r = await httpsRequest('GET', `${SB_URL}/rest/v1/${path}`, h);
    if (r.status !== 200) throw new Error('supabase ' + r.status);
    return JSON.parse(r.body || '[]');
  };

  try {
    const leads = await get(
      `leads?portal_token=eq.${token}&select=id,nombre,empresa,status,reunion_fecha,brief,created_at&limit=1`);
    if (!leads.length) return res.status(404).json({ error: 'Portal no encontrado' });
    const lead = leads[0];

    if (req.method === 'POST') {
      const src = req.body?.brief || {};
      const brief = {};
      for (const k of BRIEF_KEYS) brief[k] = String(src[k] || '').substring(0, 2000);
      const r = await httpsRequest('PATCH',
        `${SB_URL}/rest/v1/leads?portal_token=eq.${token}`,
        { ...h, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, { brief });
      if (r.status >= 300) throw new Error('supabase ' + r.status);
      return res.json({ ok: true });
    }

    const leadId = encodeURIComponent(lead.id);
    const [projects, events] = await Promise.all([
      get(`projects?lead_id=eq.${leadId}&select=id,nombre,estado,fecha_inicio,fecha_fin,descripcion&order=created_at.asc&limit=1`),
      get(`portal_events?lead_id=eq.${leadId}&select=tipo,autor,contenido,created_at&order=created_at.desc`),
    ]);
    const project = projects[0] || null;
    const milestones = project
      ? await get(`project_milestones?project_id=eq.${project.id}` +
          `&select=nombre,descripcion,fecha_target,estado,deliverables&order=fecha_target.asc.nullslast,created_at.asc`)
      : [];

    delete lead.id;
    if (project) delete project.id;
    return res.json({ lead, project, milestones, events });
  } catch (err) {
    console.error('[portal]', err.message);
    return res.status(502).json({ error: 'No se pudo cargar el portal' });
  }
};
