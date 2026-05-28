'use strict';

const { sanitize, sanitizeEmail, rateLimit, getIp, httpsRequest, uid } = require('./shared');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 20)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const body = req.body || {};
  const email = sanitizeEmail(body.email);
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  const cal_link      = String(body.cal_link      || '').slice(0, 500);
  const reunion_fecha = String(body.reunion_fecha  || '').slice(0, 100);
  const nombre_raw    = sanitize(body.nombre || '', 255);

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SB_URL || !SB_KEY) {
    console.warn('[booking-confirm] SUPABASE env vars no configuradas');
    return res.status(503).json({ error: 'Configuración incompleta' });
  }

  const sbAuth = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
  const sbHeaders = { ...sbAuth, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };

  // 1. Check if lead exists
  let existingLead = null;
  try {
    const gr = await httpsRequest('GET',
      `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&select=id,status,telefono&limit=1`,
      sbAuth
    );
    const rows = JSON.parse(gr.body || '[]');
    existingLead = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    console.warn('[booking-confirm] GET lead error:', err.message);
  }

  if (existingLead) {
    // 2a. Update existing lead → arranque + booking data
    const patch = { status: 'diagnostic', cal_link, reunion_fecha };
    if (nombre_raw) patch.nombre = nombre_raw;
    try {
      const r = await httpsRequest('PATCH',
        `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}`,
        sbHeaders, patch
      );
      if (r.status >= 400) {
        console.error('[booking-confirm] PATCH error:', r.status, r.body);
        return res.status(503).json({ error: 'Error al actualizar el lead' });
      }
      console.log('[booking-confirm] PATCH→arranque OK:', email);
    } catch (err) {
      console.error('[booking-confirm] error:', err.message);
      return res.status(503).json({ error: 'Error interno' });
    }
  } else {
    // 2b. Lead not found → create in arranque stage
    const newLead = {
      id: uid(),
      nombre: nombre_raw || email.split('@')[0],
      email,
      empresa: '',
      telefono: '',
      nota: '',
      plan: '',
      canal: 'cal',
      origen: 'cal-direct',
      status: 'diagnostic',
      prioridad: 'Media',
      tipoprecio: 'fundador',
      cal_link,
      reunion_fecha,
      historial: [],
      hooks_respuestas: {},
    };
    try {
      const r = await httpsRequest('POST', `${SB_URL}/rest/v1/leads`, sbHeaders, newLead);
      if (r.status >= 400) {
        console.error('[booking-confirm] INSERT error:', r.status, r.body);
        return res.status(503).json({ error: 'Error al guardar el lead' });
      }
      console.log('[booking-confirm] INSERT nuevo lead arranque OK:', email);
    } catch (err) {
      console.error('[booking-confirm] error:', err.message);
      return res.status(503).json({ error: 'Error interno' });
    }
  }

  return res.status(200).json({ ok: true });
};
