'use strict';

const https = require('https');

function sanitize(val, max = 255) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/<[^>]*>/g, '').replace(/['"`;\\]/g, '').trim().substring(0, max);
}

const rl = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const e = rl.get(ip) || { count: 0, start: now };
  if (now - e.start > 60_000) { e.count = 0; e.start = now; }
  e.count++;
  rl.set(ip, e);
  return e.count > 10;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function httpsPost(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const payload = JSON.stringify(body);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (rateLimit(ip)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const body = req.body || {};

  const lead = {
    id:               uid(),
    nombre:           sanitize(body.nombre),
    email:            sanitize(body.email),
    empresa:          sanitize(body.empresa),
    telefono:         sanitize(body.telefono, 30),
    nota:             sanitize(body.mensaje, 1000),
    canal:            sanitize(body.fuente, 100) || 'web',
    origen:           sanitize(body.origen, 100),
    status:           'new',
    prioridad:        'Media',
    tipoprecio:       'fundador',
    historial:        [],
    hooks_respuestas: {},
  };

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_ANON_KEY;

  if (SB_URL && SB_KEY) {
    try {
      await httpsPost(
        SB_URL + '/rest/v1/leads',
        {
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        lead
      );
    } catch (err) {
      console.error('[leads] Supabase error:', err.message);
    }
  } else {
    console.warn('[leads] SUPABASE_URL/SUPABASE_ANON_KEY no configuradas');
  }

  // También notificar n8n si está configurado
  const N8N = process.env.N8N_WEBHOOK_URL;
  if (N8N) {
    try {
      await httpsPost(N8N, { 'Content-Type': 'application/json' }, lead);
    } catch (err) {
      console.error('[leads] n8n error:', err.message);
    }
  }

  return res.status(200).json({ ok: true, id: lead.id });
};
