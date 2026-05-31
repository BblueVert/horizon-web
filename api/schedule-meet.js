'use strict';

const https = require('https');
const { sanitize, sanitizeEmail, rateLimit, getIp, httpsRequest, uid } = require('./shared');

function formPost(urlStr, data, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = new URLSearchParams(data).toString();
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function getAccessToken() {
  const r = await formPost('https://oauth2.googleapis.com/token', {
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type:    'refresh_token',
  });
  const parsed = JSON.parse(r.body);
  if (!parsed.access_token) throw new Error('No access_token: ' + r.body);
  return parsed.access_token;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getIp(req);
  if (rateLimit(ip, 60_000, 5)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const body    = req.body || {};
  const email   = sanitizeEmail(body.email);
  const nombre  = sanitize(body.nombre   || '', 255);
  const telefono= sanitize(body.telefono || '', 50);
  const fecha   = sanitize(body.fecha    || '', 12);  // YYYY-MM-DD
  const hora    = sanitize(body.hora     || '', 6);   // HH:MM
  const contexto= sanitize(body.contexto || '', 500);
  const planRaw = sanitize(body.plan     || '', 50);
  // Normalize 'plan-01' → 'plan01' to match CRM keys
  const plan = planRaw.replace(/^plan-(\d+)$/, 'plan$1');

  if (!email)         return res.status(400).json({ error: 'Email requerido' });
  if (!nombre)        return res.status(400).json({ error: 'Nombre requerido' });
  if (!telefono)      return res.status(400).json({ error: 'Teléfono requerido' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
  if (!/^\d{2}:\d{2}$/.test(hora))         return res.status(400).json({ error: 'Hora inválida' });

  const SB_URL  = process.env.SUPABASE_URL;
  const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const CAL_ID  = process.env.GOOGLE_CALENDAR_ID;
  const G_CI    = process.env.GOOGLE_CLIENT_ID;
  const G_CS    = process.env.GOOGLE_CLIENT_SECRET;
  const G_RT    = process.env.GOOGLE_REFRESH_TOKEN;

  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Config incompleta (supabase)' });
  if (!CAL_ID || !G_CI || !G_CS || !G_RT) return res.status(503).json({ error: 'Config incompleta (google)' });

  // ── 1. Get Google access token ────────────────────────────────────────────
  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    console.error('[schedule-meet] getAccessToken:', err.message);
    return res.status(503).json({ error: 'Error autenticando con Google' });
  }

  // ── 2. Create Calendar event with Google Meet ─────────────────────────────
  const tz = 'America/Santiago';
  const [hh, mm] = hora.split(':').map(Number);
  const endHour = (hh + 1) % 24;
  const endFecha = hh === 23
    ? (() => { const d = new Date(fecha + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })()
    : fecha;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  const event = {
    summary:     `Diagnóstico HORIZON — ${nombre}`,
    description: `Nombre: ${nombre}\nEmail: ${email}\nTeléfono: ${telefono}${contexto ? '\n\n' + contexto : ''}`,
    start: { dateTime: `${fecha}T${hora}:00`, timeZone: tz },
    end:   { dateTime: `${endFecha}T${endTime}:00`, timeZone: tz },
    attendees: [{ email }],
    conferenceData: {
      createRequest: {
        requestId: uid(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: { useDefault: true },
  };

  let meetLink = '';
  let eventId  = '';
  try {
    const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events?conferenceDataVersion=1&sendUpdates=all`;
    const calR   = await httpsRequest('POST', calUrl,
      { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      event
    );
    if (calR.status >= 400) {
      console.error('[schedule-meet] Calendar error:', calR.status, calR.body);
      return res.status(503).json({ error: 'Error al crear evento en Google Calendar' });
    }
    const created = JSON.parse(calR.body);
    meetLink = created.conferenceData?.entryPoints?.[0]?.uri || created.hangoutLink || '';
    eventId  = created.id || '';
    console.log('[schedule-meet] evento creado:', eventId, meetLink);
  } catch (err) {
    console.error('[schedule-meet] Calendar throw:', err.message);
    return res.status(503).json({ error: 'Error al crear evento en Google Calendar' });
  }

  // ── 3. Upsert lead in Supabase ────────────────────────────────────────────
  const sbAuth    = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  const sbHeaders = { ...sbAuth, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const reunionISO = `${fecha}T${hora}:00`;

  let existingLead = null;
  try {
    const gr   = await httpsRequest('GET',
      `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&select=id,status&limit=1`,
      sbAuth
    );
    const rows = JSON.parse(gr.body || '[]');
    existingLead = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    console.warn('[schedule-meet] GET lead:', err.message);
  }

  if (existingLead) {
    // No sobreescribir el status — solo actualizar Meet link y fecha
    const patch = { canal: 'hero', cal_link: meetLink, reunion_fecha: reunionISO };
    if (nombre)   patch.nombre   = nombre;
    if (telefono) patch.telefono = telefono;
    if (plan)     patch.plan     = plan;
    try {
      await httpsRequest('PATCH',
        `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}`,
        sbHeaders, patch
      );
      console.log('[schedule-meet] PATCH lead existente OK:', email);
    } catch (err) {
      console.error('[schedule-meet] PATCH:', err.message);
      return res.status(503).json({ error: 'Error al actualizar lead' });
    }
  } else {
    const newLead = {
      id: uid(), nombre, email, empresa: '', telefono, nota: contexto,
      plan, canal: 'hero', origen: 'agendar-directo',
      status: 'new', prioridad: 'Media', tipoprecio: 'fundador',
      cal_link: meetLink, reunion_fecha: reunionISO,
      historial: [], hooks_respuestas: {},
    };
    try {
      const r = await httpsRequest('POST', `${SB_URL}/rest/v1/leads`, sbHeaders, newLead);
      if (r.status >= 400) {
        console.error('[schedule-meet] INSERT:', r.status, r.body);
        return res.status(503).json({ error: 'Error al guardar lead' });
      }
      console.log('[schedule-meet] INSERT nuevo lead OK:', email);
    } catch (err) {
      console.error('[schedule-meet] INSERT throw:', err.message);
      return res.status(503).json({ error: 'Error interno' });
    }
  }

  // ── 4. Notify n8n (booking webhook — fire & forget) ──────────────────────
  const N8N_BOOKING = process.env.N8N_BOOKING_WEBHOOK;
  if (N8N_BOOKING) {
    httpsRequest('POST', N8N_BOOKING,
      { 'Content-Type': 'application/json' },
      { nombre, email, telefono, plan, meetLink, reunionFecha: reunionISO, contexto }
    ).catch(err => console.error('[schedule-meet] n8n notify:', err.message));
  }

  return res.status(200).json({ ok: true, meetLink, reunionFecha: reunionISO });
};
