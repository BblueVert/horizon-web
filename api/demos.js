'use strict';

// Demos express de agentes de WhatsApp (ver verticales/demos/README.md)
//
// Servidor-a-servidor con Authorization: Bearer <DEMOS_TOKEN>. Usa SUPABASE_SERVICE_ROLE_KEY.
//   POST /api/demos                 { ficha }  → publica o actualiza la ficha (Claude en terreno)
//   GET  /api/demos?desde=<ISO>                → fichas cambiadas desde esa fecha (bot de demos)
//        header x-demo-numero: <número>          el bot avisa que está vivo y con qué número
//   GET  /api/demos?estado=1                   → número vinculado y último latido del bot
//   POST /api/demos?accion=1        { slug, telefono, tipo, resumen, datos } → registra un pedido/reserva de demo

const crypto = require('crypto');
const { httpsRequest, rateLimit, getIp } = require('./shared');

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const TIPOS = ['pedido', 'reserva', 'consulta', 'derivar'];

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function validarFicha(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return 'ficha debe ser un objeto';
  if (!SLUG.test(String(f.slug || ''))) return 'slug inválido (minúsculas, números y guiones)';
  if (!String(f.nombre || '').trim()) return 'falta nombre';
  if (JSON.stringify(f).length > 60_000) return 'ficha muy grande (máx. 60 KB)';
  return null;
}

module.exports = async function handler(req, res) {
  if (rateLimit(getIp(req), 60_000, 60)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const TOKEN  = process.env.DEMOS_TOKEN;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!TOKEN || !SB_URL || !SB_KEY) return res.status(503).json({ error: 'Demos no configuradas' });

  const token = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !safeEqual(token, TOKEN)) return res.status(401).json({ error: 'No autorizado' });

  const sb = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
  const rest = (method, path, body, prefer) =>
    httpsRequest(method, `${SB_URL}/rest/v1/${path}`, prefer ? { ...sb, Prefer: prefer } : sb, body);
  const q = req.query || {};

  try {
    if (req.method === 'GET' && q.estado) {
      const r = await rest('GET', 'demo_estado?id=eq.1&select=numero,visto_at');
      return res.status(200).json((JSON.parse(r.body || '[]')[0]) || { numero: null, visto_at: null });
    }

    if (req.method === 'GET') {
      const numero = String(req.headers['x-demo-numero'] || '').replace(/\D/g, '');
      if (numero) {
        await rest('POST', 'demo_estado?on_conflict=id',
          { id: 1, numero, visto_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal');
      }
      const desde = Date.parse(q.desde || '') ? new Date(q.desde).toISOString() : '1970-01-01T00:00:00Z';
      const r = await rest('GET',
        `demo_fichas?updated_at=gt.${encodeURIComponent(desde)}&select=slug,nombre,activa,ficha,updated_at&order=updated_at.asc&limit=200`);
      if (r.status !== 200) return res.status(502).json({ error: 'No se pudieron leer las fichas' });
      return res.status(200).json({ fichas: JSON.parse(r.body || '[]'), ahora: new Date().toISOString() });
    }

    if (req.method === 'POST' && q.accion) {
      const b = req.body || {};
      if (!SLUG.test(String(b.slug || '')) || !TIPOS.includes(b.tipo)) return res.status(400).json({ error: 'slug o tipo inválido' });
      const r = await rest('POST', 'demo_acciones', {
        slug: b.slug, telefono: String(b.telefono || '').slice(0, 40), tipo: b.tipo,
        resumen: String(b.resumen || '').slice(0, 2000),
        datos: b.datos && typeof b.datos === 'object' ? b.datos : {},
      }, 'return=minimal');
      return res.status(r.status < 300 ? 201 : 502).json({ ok: r.status < 300 });
    }

    if (req.method === 'POST') {
      const ficha = (req.body || {}).ficha;
      const error = validarFicha(ficha);
      if (error) return res.status(400).json({ error });
      const r = await rest('POST', 'demo_fichas?on_conflict=slug', {
        slug: ficha.slug, nombre: String(ficha.nombre).slice(0, 120), rubro: ficha.rubro || null,
        ficha, activa: ficha.activa !== false,
      }, 'resolution=merge-duplicates,return=minimal');
      if (r.status >= 300) return res.status(502).json({ error: 'No se pudo guardar la ficha', detalle: r.body.slice(0, 300) });
      const e = await rest('GET', 'demo_estado?id=eq.1&select=numero,visto_at');
      return res.status(200).json({ ok: true, slug: ficha.slug, bot: (JSON.parse(e.body || '[]')[0]) || null });
    }

    return res.status(405).end();
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
};
