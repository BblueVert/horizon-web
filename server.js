'use strict';

const express = require('express');
const path = require('path');
const { sanitize, rateLimit, getIp, httpsPost } = require('./api/shared');

// OPS modules — required at startup so errors surface immediately
const opsData     = require('./api/ops-data');
const opsLeads    = require('./api/ops-leads');
const promoteLead = require('./api/promote-lead');
const tasks       = require('./api/tasks');
const agente      = require('./api/agente');

const app = express();
const PORT = process.env.PORT || 3000;

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
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://dkitbnrpwmwrfnmztdfc.supabase.co",
      "frame-src 'none'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  next();
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '256kb' }));

// ── Rate limiting middleware ──────────────────────────────────────────────────
function rateLimitMiddleware(windowMs, max) {
  return (req, res, next) => {
    if (rateLimit(getIp(req), windowMs, max)) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta más tarde.' });
    }
    next();
  };
}

// ── Health endpoint ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── API: leads ────────────────────────────────────────────────────────────────
app.post('/api/leads', rateLimitMiddleware(60_000, 10), async (req, res) => {
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
  if (!N8N_WEBHOOK_URL) {
    console.error('[leads] N8N_WEBHOOK_URL not configured');
    return res.status(503).json({ error: 'Servicio no disponible' });
  }

  // Validate URL safety (no localhost / non-HTTPS)
  try {
    const u = new URL(N8N_WEBHOOK_URL);
    if (u.protocol !== 'https:') throw new Error('Non-HTTPS webhook URL');
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(u.hostname)) throw new Error('Invalid webhook host');
  } catch (err) {
    console.error('[leads] Invalid N8N_WEBHOOK_URL:', err.message);
    return res.status(503).json({ error: 'Servicio no disponible' });
  }

  const body = req.body || {};
  const lead = {
    nombre:   sanitize(body.nombre),
    email:    sanitize(body.email),
    empresa:  sanitize(body.empresa),
    telefono: sanitize(body.telefono, 30),
    mensaje:  sanitize(body.mensaje, 1000),
    fuente:   sanitize(body.fuente, 100) || 'web',
    plan:     sanitize(body.plan, 100),
    origen:   sanitize(body.origen, 100),
  };

  try {
    const r = await httpsPost(N8N_WEBHOOK_URL, { 'Content-Type': 'application/json' }, lead);
    if (r.status >= 200 && r.status < 300) return res.json({ ok: true });
    console.error('[leads] upstream returned', r.status);
    return res.status(502).json({ error: 'Error al registrar el lead' });
  } catch (err) {
    console.error('[leads] upstream error:', err.message);
    const status = err.message === 'Request timeout' ? 504 : 502;
    return res.status(status).json({ error: 'Error al registrar el lead' });
  }
});

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── URL rewrites (mirrors vercel.json) ───────────────────────────────────────
const rewrites = {
  '/':                '/Pages/HORIZON_Landing_2026.html',
  '/plan-01':         '/Pages/plan-01.html',
  '/plan-02':         '/Pages/plan-02.html',
  '/plan-03':         '/Pages/plan-03.html',
  '/plan-04':         '/Pages/plan-04.html',
  '/plan-05':         '/Pages/plan-05.html',
  '/servicios':       '/Pages/servicios.html',
  '/crm':             '/Pages/CRM/pipeline.html',
  '/reunion':         '/Pages/reunion/index.html',
  '/agendar':         '/Pages/agendar/index.html',
  '/booking-confirm': '/Pages/booking-confirm/index.html',
};

Object.entries(rewrites).forEach(([from, to]) => {
  app.get(from, (_req, res) => res.sendFile(path.join(__dirname, to)));
});

// Portal con token dinámico
app.get('/c/:token', (_req, res) => res.sendFile(path.join(__dirname, 'Pages/portal/index.html')));

// ── OPS — Centro de Operaciones ──────────────────────────────────────────────
const opsPages = {
  '/ops':            'OPS/index.html',
  '/ops/login':      'OPS/login.html',
  '/ops/pipeline':   'OPS/pipeline.html',
  '/ops/proyectos':  'OPS/proyectos.html',
  '/ops/proyecto':   'OPS/proyecto-detalle.html',
  '/ops/agente':     'OPS/agente.html',
};
Object.entries(opsPages).forEach(([from, to]) => {
  app.get(from, (_req, res) => res.sendFile(path.join(__dirname, to)));
});

// OPS API endpoints
app.get('/api/ops/dashboard',     opsData);
app.get('/api/ops/leads',         opsLeads);
app.post('/api/ops/promote-lead', promoteLead);
app.get('/api/ops/tasks',         tasks);
app.post('/api/ops/tasks',        tasks);
app.patch('/api/ops/tasks/:id',   tasks);
app.delete('/api/ops/tasks/:id',  tasks);
app.post('/api/ops/agente',       agente);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, 'Pages/HORIZON_Landing_2026.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[horizon-web] servidor corriendo en puerto ${PORT}`);
  if (!process.env.N8N_WEBHOOK_URL) console.warn('[horizon-web] ADVERTENCIA: N8N_WEBHOOK_URL no configurada');
  if (!process.env.SUPABASE_URL) console.warn('[horizon-web] ADVERTENCIA: SUPABASE_URL no configurada');
});
