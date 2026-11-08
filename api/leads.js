'use strict';

const { sanitize, sanitizeEmail, rateLimit, getIp, httpsPost, uid } = require('./shared');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getIp(req);
  if (rateLimit(ip)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const body = req.body || {};
  const email = sanitizeEmail(body.email);
  if (!email) return res.status(400).json({ error: 'Email requerido y válido' });
  if (!body.nombre || !String(body.nombre).trim()) {
    return res.status(400).json({ error: 'Nombre requerido' });
  }

  const lead = {
    id:               uid(),
    nombre:           sanitize(body.nombre),
    email,
    empresa:          sanitize(body.empresa),
    telefono:         sanitize(body.telefono, 30),
    nota:             sanitize(body.mensaje, 1000),
    plan:             sanitize(body.plan, 100).replace(/^plan-(\d+)$/, 'plan$1'),
    canal:            (sanitize(body.fuente, 100) || 'web').replace(/^plan-(\d+)$/, 'plan$1'),
    origen:           sanitize(body.origen, 100),
    status:           'new',
    prioridad:        'Media',
    tipoprecio:       'fundador',
    historial:        [],
    hooks_respuestas: {},
  };

  // Radiografía de terreno (/terreno/radiografia): respuestas, recomendación y decisión del dueño.
  const rx = cleanRadiografia(body.radiografia);
  if (rx) {
    lead.hooks_respuestas = { radiografia: rx };
    lead.plan      = rx.elegido === 'pro' ? 'terreno-pro' : 'terreno-esencial';
    lead.status    = rx.decision === 'partimos' ? 'propuesta' : 'contactado';
    lead.prioridad = rx.decision === 'partimos' ? 'Alta' : (rx.recomendado === 'no' ? 'Baja' : 'Media');
  }

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (SB_URL && SB_KEY) {
    try {
      const r = await httpsPost(
        SB_URL + '/rest/v1/leads',
        {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        lead
      );
      if (r.status >= 400) {
        console.error('[leads] Supabase error status:', r.status, r.body);
        return res.status(503).json({ error: 'Error al guardar el lead' });
      }
    } catch (err) {
      console.error('[leads] Supabase error:', err.message);
      return res.status(503).json({ error: 'Error al guardar el lead' });
    }
  } else {
    console.warn('[leads] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas');
  }

  const N8N = process.env.N8N_WEBHOOK_URL;
  if (N8N) {
    httpsPost(N8N, { 'Content-Type': 'application/json' }, lead).catch(err =>
      console.error('[leads] n8n error:', err.message)
    );
  }

  return res.status(200).json({ ok: true, id: lead.id });
};

function cleanRadiografia(rx) {
  if (!rx || typeof rx !== 'object' || Array.isArray(rx)) return null;
  const pick = (v, ok, def) => (ok.includes(v) ? v : def);
  const num = (v, max) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
  };
  const respuestas = {};
  if (rx.respuestas && typeof rx.respuestas === 'object') {
    Object.keys(rx.respuestas).slice(0, 12).forEach(k => {
      const key = sanitize(k, 20).replace(/[^a-z0-9_]/gi, '');
      if (key) respuestas[key] = sanitize(rx.respuestas[k], 80);
    });
  }
  return {
    respuestas,
    ticket:      num(rx.ticket, 10000000),
    escape_mes:  num(rx.escape_mes, 100000000),
    puntos_e:    num(rx.puntos_e, 50),
    puntos_p:    num(rx.puntos_p, 50),
    recomendado: pick(rx.recomendado, ['esencial', 'pro', 'no'], 'esencial'),
    elegido:     pick(rx.elegido, ['esencial', 'pro'], 'esencial'),
    decision:    pick(rx.decision, ['partimos', 'lo-pienso'], 'lo-pienso'),
    mejoras:     Array.isArray(rx.mejoras) ? rx.mejoras.slice(0, 10).map(m => sanitize(m, 200)) : [],
    resumen:     sanitize(rx.resumen, 2000),
    fecha:       new Date().toISOString(),
  };
}
