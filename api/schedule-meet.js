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

const SITE = (process.env.SITE_URL || 'https://www.horizonweb.cl').replace(/\/$/, '');

// Texto de la invitación de Google Calendar (la ve el cliente)
function descripcionInvitacion(nombre, portalUrl) {
  const first = String(nombre || '').split(' ')[0];
  return [
    `Hola${first ? ' ' + first : ''}, quedó agendado tu diagnóstico gratuito con HORIZON (30 min por Google Meet).`,
    '',
    'Tu portal de cliente:',
    portalUrl,
    'Ahí completas un brief corto antes de la sesión, y si trabajamos juntos, vas a ver todo el avance de tu proyecto en el mismo link.',
    '',
    '¿Necesitas cambiar la hora? Escríbenos por WhatsApp: +56 9 7696 2659',
  ].join('\n');
}

// Calificación previa del diagnóstico (formulario /agendar). Valores cerrados: lo demás se descarta.
const PRESUPUESTO = { ahora: 'disponible ahora', '1-2m': 'en 1–2 meses', no: 'todavía no', propuesta: 'viene de una propuesta' };
const VOLUMEN     = { '<10': 'menos de 10', '10-30': '10–30', '30-100': '30–100', '100+': 'más de 100' };
const DECISOR     = { yo: 'el dueño', socio: 'con un socio', otro: 'otra persona' };
const PRIORIDAD   = { ahora: 'Alta', propuesta: 'Alta', '1-2m': 'Media', no: 'Baja' };

function pick(map, val) { return Object.prototype.hasOwnProperty.call(map, val) ? val : ''; }

function resumenCalificacion(c) {
  if (!c.presupuesto) return '';
  return [
    'Presupuesto: ' + PRESUPUESTO[c.presupuesto],
    c.volumen && 'Consultas/semana: ' + VOLUMEN[c.volumen],
    c.decisor && 'Decide: ' + DECISOR[c.decisor],
  ].filter(Boolean).join(' · ');
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
  const source  = sanitize(body.source  || '', 100);
  const calif = {
    presupuesto: pick(PRESUPUESTO, String(body.presupuesto || '')),
    volumen:     pick(VOLUMEN,     String(body.volumen || '')),
    decisor:     pick(DECISOR,     String(body.decisor || '')),
  };
  // "Todavía no": no se agenda; queda como lead frío para nutrir.
  const sinPresupuesto = calif.presupuesto === 'no';
  const resumen = resumenCalificacion(calif);

  if (!email)         return res.status(400).json({ error: 'Email requerido' });
  if (!nombre)        return res.status(400).json({ error: 'Nombre requerido' });
  if (!telefono)      return res.status(400).json({ error: 'Teléfono requerido' });
  if (!sinPresupuesto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha inválida' });
    if (!/^\d{2}:\d{2}$/.test(hora))         return res.status(400).json({ error: 'Hora inválida' });
  }

  const SB_URL  = process.env.SUPABASE_URL;
  const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const CAL_ID  = process.env.GOOGLE_CALENDAR_ID;
  const G_CI    = process.env.GOOGLE_CLIENT_ID;
  const G_CS    = process.env.GOOGLE_CLIENT_SECRET;
  const G_RT    = process.env.GOOGLE_REFRESH_TOKEN;

  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: 'Config incompleta (supabase)' });

  const sbAuth    = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  const sbHeaders = { ...sbAuth, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

  // ── 0. Lead existente (mismo email) y su portal ──────────────────────────
  // Se busca antes de Calendar: el link del portal va en la invitación que recibe el cliente.
  let existingLead = null;
  try {
    const gr   = await httpsRequest('GET',
      `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(email)}&select=id,status,nota,hooks_respuestas,portal_token&limit=1`,
      sbAuth
    );
    const rows = JSON.parse(gr.body || '[]');
    existingLead = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    console.warn('[schedule-meet] GET lead:', err.message);
  }
  const portalToken = existingLead?.portal_token || uid();
  const portalUrl   = `${SITE}/c/${portalToken}`;

  // ── 1 & 2. Google Calendar (opcional — si falla igual guardamos el lead) ──
  let meetLink = '';
  let eventId  = '';
  const calReady = !sinPresupuesto && CAL_ID && G_CI && G_CS && G_RT;
  if (calReady) {
    try {
      const accessToken = await getAccessToken();
      const tz = 'America/Santiago';
      const [hh, mm] = hora.split(':').map(Number);
      const endMin   = hh * 60 + mm + 30;               // diagnóstico de 30 minutos
      const endFecha = endMin >= 24 * 60
        ? (() => { const d = new Date(fecha + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })()
        : fecha;
      const endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      const event = {
        summary:     `Diagnóstico HORIZON — ${nombre}`,
        // La descripción la ve el cliente en su invitación: solo lo que le sirve a él.
        // Los datos internos (calificación, contexto) quedan en OPS y en extendedProperties.private.
        description: descripcionInvitacion(nombre, portalUrl),
        extendedProperties: { private: { email, telefono, calificacion: resumen.slice(0, 900), contexto: contexto.slice(0, 900) } },
        start: { dateTime: `${fecha}T${hora}:00`, timeZone: tz },
        end:   { dateTime: `${endFecha}T${endTime}:00`, timeZone: tz },
        attendees: [{ email }],
        conferenceData: {
          createRequest: { requestId: uid(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
        },
        reminders: { useDefault: true },
      };
      const calUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events?conferenceDataVersion=1&sendUpdates=all`;
      const calR   = await httpsRequest('POST', calUrl,
        { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        event
      );
      if (calR.status < 400) {
        const created = JSON.parse(calR.body);
        meetLink = created.conferenceData?.entryPoints?.[0]?.uri || created.hangoutLink || '';
        eventId  = created.id || '';
        console.log('[schedule-meet] evento creado:', eventId, meetLink);
      } else {
        console.warn('[schedule-meet] Calendar error (no bloqueante):', calR.status, calR.body);
      }
    } catch (err) {
      console.warn('[schedule-meet] Calendar skip (no bloqueante):', err.message);
    }
  } else if (!sinPresupuesto) {
    console.warn('[schedule-meet] Google Calendar no configurado — guardando lead sin Meet link');
  }

  // ── 3. Upsert lead in Supabase ────────────────────────────────────────────
  const reunionISO = sinPresupuesto ? '' : `${fecha}T${hora}:00`;
  const califRegistro = calif.presupuesto ? { ...calif, resumen, fecha: new Date().toISOString() } : null;


  if (existingLead) {
    // No sobreescribir el status — solo actualizar Meet link y fecha
    const patch = sinPresupuesto ? {} : { canal: 'hero', cal_link: meetLink, reunion_fecha: reunionISO };
    if (source) patch.origen = source;
    if (califRegistro) {
      const prev = existingLead.hooks_respuestas && typeof existingLead.hooks_respuestas === 'object' ? existingLead.hooks_respuestas : {};
      patch.hooks_respuestas = { ...prev, calificacion: califRegistro };
      patch.prioridad = PRIORIDAD[calif.presupuesto];
      patch.nota = [existingLead.nota, '[Calificación] ' + resumen].filter(Boolean).join('\n');
    }
    if (nombre)   patch.nombre   = nombre;
    if (telefono) patch.telefono = telefono;
    if (plan)     patch.plan     = plan;
    if (!existingLead.portal_token) patch.portal_token = portalToken;
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
      id: uid(), nombre, email, empresa: '', telefono,
      nota: [resumen && '[Calificación] ' + resumen, contexto].filter(Boolean).join('\n'),
      plan, canal: 'hero', origen: source || (sinPresupuesto ? 'agendar-sin-presupuesto' : 'agendar-directo'),
      status: 'new', prioridad: PRIORIDAD[calif.presupuesto] || 'Media', tipoprecio: 'fundador',
      cal_link: meetLink, reunion_fecha: reunionISO || null, portal_token: portalToken,
      historial: [], hooks_respuestas: califRegistro ? { calificacion: califRegistro } : {},
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
  if (sinPresupuesto) return res.status(200).json({ ok: true, agendado: false });

  const N8N_BOOKING = process.env.N8N_BOOKING_WEBHOOK;
  if (N8N_BOOKING) {
    httpsRequest('POST', N8N_BOOKING,
      { 'Content-Type': 'application/json' },
      { nombre, email, telefono, plan, meetLink, reunionFecha: reunionISO, contexto, calificacion: califRegistro }
    ).catch(err => console.error('[schedule-meet] n8n notify:', err.message));
  }

  // invitacion = Google Calendar creó el evento y mandó el email; si no, el front no promete un correo que no salió
  return res.status(200).json({ ok: true, agendado: true, invitacion: Boolean(eventId), meetLink, reunionFecha: reunionISO, portalUrl });
};
