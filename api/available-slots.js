'use strict';

const { httpsRequest, rateLimit, getIp } = require('./shared');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 30)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const fecha = (req.query?.fecha || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Fecha inválida' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  // If config missing, return all slots available (fail open)
  if (!SB_URL || !SB_KEY) return res.json({ booked: [] });

  try {
    // reunion_fecha is stored as UTC ISO string using the local time value
    // (schedule-meet runs on UTC server, stores HH:MM as if UTC).
    // Query the full UTC date to match all meetings on that calendar day.
    const dayStart = `${fecha}T00:00:00.000Z`;
    const dayEnd   = `${fecha}T23:59:59.999Z`;

    const r = await httpsRequest(
      'GET',
      `${SB_URL}/rest/v1/leads?reunion_fecha=gte.${encodeURIComponent(dayStart)}&reunion_fecha=lte.${encodeURIComponent(dayEnd)}&select=reunion_fecha`,
      { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    );

    const rows = JSON.parse(r.body || '[]');
    const booked = (Array.isArray(rows) ? rows : [])
      .map(row => {
        if (!row.reunion_fecha) return null;
        const d = new Date(row.reunion_fecha);
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const mm = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      })
      .filter(Boolean);

    return res.json({ booked });
  } catch (e) {
    console.error('[available-slots]', e.message);
    return res.json({ booked: [] }); // fail open
  }
};
