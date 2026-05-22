'use strict';

const { sanitizeEmail, httpsRequest, verifyHmac } = require('./shared');

module.exports = async function handler(req, res) {
  // Cal.com llama server→server; no se necesita CORS de navegador.
  // Solo permitir POST desde el propio servidor.
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cal-Signature-256');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verificar firma HMAC si el secret está configurado
  const secret = process.env.CAL_COM_WEBHOOK_SECRET;
  if (secret) {
    const rawBody = JSON.stringify(req.body || {});
    const sig = req.headers['x-cal-signature-256'] || '';
    if (!verifyHmac(secret, rawBody, sig)) {
      console.warn('[cal-webhook] Firma HMAC inválida');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const body = req.body || {};
  const triggerEvent = body.triggerEvent || '';
  if (!['BOOKING_CREATED', 'BOOKING_RESCHEDULED'].includes(triggerEvent)) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const payload = body.payload || {};
  const attendees = payload.attendees || [];
  const attendeeEmail = sanitizeEmail((attendees[0]?.email || ''));
  const calLink = String(payload.uid || '').substring(0, 255);
  const reunionFecha = String(payload.startTime || '').substring(0, 100);

  if (!attendeeEmail) {
    return res.status(400).json({ error: 'No valid attendee email in payload' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SB_URL || !SB_KEY) {
    console.error('[cal-webhook] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY no configuradas');
    return res.status(500).json({ error: 'Server config missing' });
  }

  const patch = { status: 'contacted', cal_link: calLink, reunion_fecha: reunionFecha };
  // Usar eq (exact match) — no ilike para evitar wildcards no intencionales
  const patchUrl = `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(attendeeEmail)}`;
  const headers = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  try {
    const r = await httpsRequest('PATCH', patchUrl, headers, patch);
    console.log('[cal-webhook] Supabase PATCH status:', r.status, 'email:', attendeeEmail);
    return res.status(200).json({ ok: true, email: attendeeEmail, supabase: r.status });
  } catch (err) {
    console.error('[cal-webhook] Supabase error:', err.message);
    return res.status(err.message === 'Request timeout' ? 504 : 502).json({ error: err.message });
  }
};
