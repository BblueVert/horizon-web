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

  // Disparar WhatsApp de bienvenida si el lead tiene teléfono
  if (lead.telefono) {
    httpsPost(
      'https://horizon-n8n.tmae4w.easypanel.host/webhook/crm-whatsapp',
      { 'Content-Type': 'application/json' },
      { record: lead }
    ).catch(err => console.warn('[leads] WhatsApp error:', err.message));
  }

  return res.status(200).json({ ok: true, id: lead.id });
};
