'use strict';

const { sanitizeEmail, rateLimit, getIp, httpsRequest } = require('./shared');

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

  const cal_link     = String(body.cal_link     || '').slice(0, 500);
  const reunion_fecha = String(body.reunion_fecha || '').slice(0, 50);

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SB_URL || !SB_KEY) {
    console.warn('[booking-confirm] SUPABASE env vars no configuradas');
    return res.status(503).json({ error: 'Configuración incompleta' });
  }

  try {
    const patch = { status: 'new', cal_link, reunion_fecha };
    const r = await httpsRequest(
      'PATCH',
      SB_URL + '/rest/v1/leads?email=ilike.' + encodeURIComponent(email),
      {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      patch
    );
    if (r.status >= 400) {
      console.error('[booking-confirm] Supabase error:', r.status, r.body);
      return res.status(503).json({ error: 'Error al actualizar el lead' });
    }
  } catch (err) {
    console.error('[booking-confirm] error:', err.message);
    return res.status(503).json({ error: 'Error interno' });
  }

  return res.status(200).json({ ok: true });
};
