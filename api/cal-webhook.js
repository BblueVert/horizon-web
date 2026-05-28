'use strict';

const { sanitize, sanitizeEmail, httpsRequest, verifyHmac, uid } = require('./shared');

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
  const attendee = attendees[0] || {};
  const attendeeEmail = sanitizeEmail(attendee.email || '');
  const attendeeName = sanitize(attendee.name || '', 255);

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

  const sbAuth = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY };
  const sbHeaders = { ...sbAuth, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };

  // 1. Check if lead exists by email
  let existingLead = null;
  try {
    const gr = await httpsRequest('GET',
      `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(attendeeEmail)}&select=id,status&limit=1`,
      sbAuth
    );
    const rows = JSON.parse(gr.body || '[]');
    existingLead = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    console.warn('[cal-webhook] GET lead error:', err.message);
  }

  if (existingLead) {
    // 2a. Lead exists → move to arranque and save booking data
    const patch = { status: 'diagnostic', cal_link: calLink, reunion_fecha: reunionFecha };
    if (attendeeName) patch.nombre = attendeeName;
    try {
      const r = await httpsRequest('PATCH',
        `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(attendeeEmail)}`,
        sbHeaders, patch
      );
      console.log('[cal-webhook] PATCH→arranque status:', r.status, 'email:', attendeeEmail);
    } catch (err) {
      console.error('[cal-webhook] PATCH error:', err.message);
      return res.status(502).json({ error: err.message });
    }
  } else {
    // 2b. Lead not found → create new lead in arranque stage with Cal.com data
    const newLead = {
      id: uid(),
      nombre: attendeeName || attendeeEmail.split('@')[0],
      email: attendeeEmail,
      empresa: '',
      telefono: '',
      nota: '',
      plan: '',
      canal: 'cal',
      origen: 'cal-direct',
      status: 'diagnostic',
      prioridad: 'Media',
      tipoprecio: 'fundador',
      cal_link: calLink,
      reunion_fecha: reunionFecha,
      historial: [],
      hooks_respuestas: {},
    };
    try {
      const r = await httpsRequest('POST', `${SB_URL}/rest/v1/leads`, sbHeaders, newLead);
      console.log('[cal-webhook] INSERT new lead status=arranque:', r.status, 'email:', attendeeEmail);
      if (r.status >= 400) console.error('[cal-webhook] INSERT body:', r.body);
    } catch (err) {
      console.error('[cal-webhook] INSERT error:', err.message);
      return res.status(502).json({ error: err.message });
    }
  }

  return res.status(200).json({ ok: true, email: attendeeEmail, calLink, reunionFecha });
};
