'use strict';

const https = require('https');

function httpsRequest(method, urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = body ? JSON.stringify(body) : '';
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // Cal.com payload: { triggerEvent, payload: { attendees, uid, startTime, ... } }
  const triggerEvent = body.triggerEvent || '';
  if (!['BOOKING_CREATED', 'BOOKING_RESCHEDULED'].includes(triggerEvent)) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const payload = body.payload || {};
  const attendees = payload.attendees || [];
  const attendeeEmail = (attendees[0]?.email || '').toLowerCase().trim();
  const calLink = payload.uid || '';
  const reunionFecha = payload.startTime || '';

  if (!attendeeEmail) {
    return res.status(400).json({ error: 'No attendee email in payload' });
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SB_URL || !SB_KEY) {
    console.error('[cal-webhook] SUPABASE_URL/SUPABASE_ANON_KEY no configuradas');
    return res.status(500).json({ error: 'Server config missing' });
  }

  const patch = {
    status: 'contacted',
    cal_link: calLink,
    reunion_fecha: reunionFecha,
  };

  const patchUrl = `${SB_URL}/rest/v1/leads?email=ilike.${encodeURIComponent(attendeeEmail)}`;
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
    return res.status(500).json({ error: err.message });
  }
};
