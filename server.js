'use strict';

const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://cal.com",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  next();
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));

// ── Rate limiting (manual, no extra dep) ─────────────────────────────────────
const rateLimitStore = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const entry = rateLimitStore.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count++;
    rateLimitStore.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
    }
    next();
  };
}

// ── Input sanitization helper ─────────────────────────────────────────────────
function sanitizeString(val, maxLen = 255) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/<[^>]*>/g, '')       // strip HTML tags
    .replace(/['"`;\\]/g, '')      // strip SQL-dangerous chars
    .trim()
    .substring(0, maxLen);
}

// ── Health endpoint ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API: proxy lead to n8n (hides internal webhook URL) ──────────────────────
app.post('/api/leads', rateLimit(60_000, 10), (req, res) => {
  if (!N8N_WEBHOOK_URL) {
    console.error('[leads] N8N_WEBHOOK_URL not configured');
    return res.status(503).json({ error: 'Servicio no disponible' });
  }

  const body = req.body || {};
  const payload = JSON.stringify({
    nombre:   sanitizeString(body.nombre),
    email:    sanitizeString(body.email),
    empresa:  sanitizeString(body.empresa),
    telefono: sanitizeString(body.telefono, 30),
    mensaje:  sanitizeString(body.mensaje, 1000),
    fuente:   sanitizeString(body.fuente, 100) || 'web',
  });

  const url = new URL(N8N_WEBHOOK_URL);
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
  };

  const upstream = https.request(options, (upstream_res) => {
    // Forward 200/201 as success; anything else as error
    if (upstream_res.statusCode >= 200 && upstream_res.statusCode < 300) {
      return res.json({ ok: true });
    }
    console.error('[leads] upstream returned', upstream_res.statusCode);
    res.status(502).json({ error: 'Error al registrar el lead' });
  });

  upstream.on('error', (err) => {
    console.error('[leads] upstream error:', err.message);
    res.status(502).json({ error: 'Error al registrar el lead' });
  });

  upstream.write(payload);
  upstream.end();
});

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── URL rewrites (mirrors vercel.json) ───────────────────────────────────────
const rewrites = {
  '/': '/Pages/HORIZON_Landing_2026.html',
  '/plan-01': '/Pages/plan-01.html',
  '/plan-02': '/Pages/plan-02.html',
  '/plan-03': '/Pages/plan-03.html',
  '/plan-04': '/Pages/plan-04.html',
  '/servicios': '/Pages/servicios.html',
  '/crm':    '/Pages/CRM/pipeline.html',
  '/reunion':'/Pages/reunion/index.html',
};

Object.entries(rewrites).forEach(([from, to]) => {
  app.get(from, (_req, res) => res.sendFile(path.join(__dirname, to)));
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, 'Pages/HORIZON_Landing_2026.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[horizon-web] servidor corriendo en puerto ${PORT}`);
  if (!N8N_WEBHOOK_URL) console.warn('[horizon-web] ADVERTENCIA: N8N_WEBHOOK_URL no configurada');
});
