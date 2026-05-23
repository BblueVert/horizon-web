'use strict';

const { sanitizeEmail, httpsRequest, verifyHmac } = require('./shared');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cal-Signature-256');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  // payload.uid = "integrations:daily" (Daily.co type ID, no es una URL)
  // La URL real de la videollamada está en metadata.videoCallUrl
  const calLink = String(
    payload.metadata?.videoCallUrl ||
    payload.videoCallData?.url ||
    payload.conferenceData?.entryPoints?.[0]?.uri ||
    ''
  ).substring(0, 255);
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

  const sbHeaders = {
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  // 1. Patch cal_link + reunion_fecha en Supabase
  const patch = { cal_link: calLink, reunion_fecha: reunionFecha };
  const patchUrl = `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(attendeeEmail)}`;
  try {
    const r = await httpsRequest('PATCH', patchUrl, sbHeaders, patch);
    console.log('[cal-webhook] Supabase PATCH status:', r.status, 'email:', attendeeEmail);
  } catch (err) {
    console.error('[cal-webhook] Supabase PATCH error:', err.message);
    return res.status(502).json({ error: err.message });
  }

  // 2. GET lead completo para nombre, telefono, portal_token
  let lead = null;
  try {
    const getUrl = `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(attendeeEmail)}&select=*`;
    const gr = await httpsRequest('GET', getUrl, {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
    });
    const leads = JSON.parse(gr.body || '[]');
    lead = Array.isArray(leads) ? leads[0] : null;
  } catch (err) {
    console.error('[cal-webhook] Supabase GET lead error:', err.message);
  }

  // 3. Disparar WhatsApp vía n8n con los datos actualizados
  if (lead && lead.telefono) {
    const record = { ...lead, cal_link: calLink, reunion_fecha: reunionFecha, status: 'new' };
    try {
      const waUrl = 'https://horizon-n8n.tmae4w.easypanel.host/webhook/crm-whatsapp';
      await httpsRequest('POST', waUrl, { 'Content-Type': 'application/json' }, { record });
      console.log('[cal-webhook] WhatsApp disparado para:', attendeeEmail);
    } catch (err) {
      console.warn('[cal-webhook] WhatsApp n8n error (no fatal):', err.message);
    }
  }

  return res.status(200).json({ ok: true, email: attendeeEmail, calLink, reunionFecha });
};
