'use strict';

const https = require('https');

function sanitize(val, max = 255) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/<[^>]*>/g, '').replace(/['"`;\\]/g, '').trim().substring(0, max);
}

// Simple in-memory rate limit (resets per cold start — fine for Vercel)
const rl = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const e = rl.get(ip) || { count: 0, start: now };
  if (now - e.start > 60_000) { e.count = 0; e.start = now; }
  e.count++;
  rl.set(ip, e);
  return e.count > 10;
}

module.exports = async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (rateLimit(ip)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const body = req.body || {};
  const payload = JSON.stringify({
    nombre:   sanitize(body.nombre),
    email:    sanitize(body.email),
    empresa:  sanitize(body.empresa),
    telefono: sanitize(body.telefono, 30),
    mensaje:  sanitize(body.mensaje, 1000),
    fuente:   sanitize(body.fuente, 100) || 'web',
  });

  const N8N = process.env.N8N_WEBHOOK_URL;
  if (!N8N) {
    // Sin webhook configurado — igual responder OK (lead ya está en localStorage)
    console.warn('[leads] N8N_WEBHOOK_URL no configurada');
    return res.status(200).json({ ok: true });
  }

  return new Promise((resolve) => {
    const url = new URL(N8N);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const upstream = https.request(options, (r) => {
      res.status(r.statusCode >= 200 && r.statusCode < 300 ? 200 : 502)
         .json({ ok: r.statusCode < 300 });
      resolve();
    });
    upstream.on('error', () => { res.status(502).json({ ok: false }); resolve(); });
    upstream.write(payload);
    upstream.end();
  });
};
