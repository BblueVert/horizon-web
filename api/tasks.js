'use strict';

const { sanitize, httpsRequest, rateLimit, getIp, uid } = require('./shared');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 60)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Config incompleta' });

  const auth    = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  const headers = { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' };

  // GET /api/ops/tasks?project_id=UUID
  if (req.method === 'GET') {
    const pid = sanitize(req.query?.project_id || '', 40);
    if (!pid) return res.status(400).json({ error: 'project_id requerido' });
    const r = await httpsRequest('GET',
      `${SB_URL}/rest/v1/tasks?project_id=eq.${encodeURIComponent(pid)}&order=orden.asc,created_at.asc`,
      auth
    );
    return res.status(r.status).json(JSON.parse(r.body || '[]'));
  }

  // POST — crear tarea
  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.project_id || !b.titulo) return res.status(400).json({ error: 'project_id y titulo requeridos' });
    const task = {
      id:          uid(),
      project_id:  sanitize(b.project_id, 40),
      titulo:      sanitize(b.titulo, 200),
      descripcion: sanitize(b.descripcion || '', 1000),
      estado:      ['pendiente','en_progreso','hecho'].includes(b.estado) ? b.estado : 'pendiente',
      prioridad:   ['alta','media','baja'].includes(b.prioridad) ? b.prioridad : 'media',
      orden:       Number(b.orden) || 0,
    };
    const r = await httpsRequest('POST', `${SB_URL}/rest/v1/tasks`, headers, task);
    const body = JSON.parse(r.body || '{}');
    return res.status(r.status >= 400 ? r.status : 201).json(Array.isArray(body) ? body[0] : body);
  }

  // PATCH — actualizar tarea por ID
  if (req.method === 'PATCH') {
    const id = req.params?.id || sanitize(req.query?.id || '', 40);
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const b = req.body || {};
    const patch = {};
    if (b.titulo !== undefined)      patch.titulo      = sanitize(b.titulo, 200);
    if (b.descripcion !== undefined) patch.descripcion = sanitize(b.descripcion, 1000);
    if (b.estado !== undefined && ['pendiente','en_progreso','hecho'].includes(b.estado)) patch.estado = b.estado;
    if (b.prioridad !== undefined && ['alta','media','baja'].includes(b.prioridad)) patch.prioridad = b.prioridad;
    if (b.orden !== undefined) patch.orden = Number(b.orden) || 0;
    const r = await httpsRequest('PATCH',
      `${SB_URL}/rest/v1/tasks?id=eq.${encodeURIComponent(id)}`,
      { ...headers, Prefer: 'return=minimal' }, patch
    );
    return res.status(r.status >= 400 ? r.status : 200).json({ ok: true });
  }

  // DELETE — eliminar tarea por ID
  if (req.method === 'DELETE') {
    const id = req.params?.id || sanitize(req.query?.id || '', 40);
    if (!id) return res.status(400).json({ error: 'id requerido' });
    const r = await httpsRequest('DELETE',
      `${SB_URL}/rest/v1/tasks?id=eq.${encodeURIComponent(id)}`,
      { ...auth, Prefer: 'return=minimal' }
    );
    return res.status(r.status >= 400 ? r.status : 200).json({ ok: true });
  }

  return res.status(405).end();
};
