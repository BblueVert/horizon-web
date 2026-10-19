'use strict';

// Pagos del portal del cliente con Mercado Pago (Checkout Pro)
//
// POST /api/pagos            { token, item_id }
//      → crea la preferencia de pago de un ítem del presupuesto y devuelve { url } (pasarela de MP).
//        El monto sale de la base (budget_items), nunca del navegador.
//
// POST /api/pagos?webhook=1  (notificación de Mercado Pago)
//      → valida la firma (x-signature, MP_WEBHOOK_SECRET), consulta el pago en la API de MP y,
//        solo si está aprobado y el monto cuadra, marca el ítem como pagado (service role).
//        Si el ítem tenía bloquea_entrega, eso desbloquea la entrega final en el portal.
//
// Variables: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, SITE_URL (opcional).

const crypto = require('crypto');
const { httpsRequest, rateLimit, getIp } = require('./shared');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE = (process.env.SITE_URL || 'https://www.horizonweb.cl').replace(/\/$/, '');
const MP_API = 'https://api.mercadopago.com';

const clp = (n) => '$' + Math.round(n).toLocaleString('es-CL');
const hoyChile = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

// Firma del webhook: x-signature = "ts=...,v1=<hmac>" sobre "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
function firmaValida(req, dataId, secret) {
  const parts = Object.fromEntries(String(req.headers['x-signature'] || '').split(',')
    .map(p => p.trim().split('=')).filter(p => p.length === 2));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : String(dataId);
  const manifest = `id:${id};request-id:${req.headers['x-request-id'] || ''};ts:${parts.ts};`;
  const esperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(esperado), b = Buffer.from(String(parts.v1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function crearPago(req, res) {
  if (rateLimit('pago:' + getIp(req), 60_000, 10)) return res.status(429).json({ error: 'Demasiadas solicitudes' });

  const SB_URL = process.env.SUPABASE_URL;
  const ANON   = process.env.SUPABASE_ANON_KEY;
  const MP     = process.env.MP_ACCESS_TOKEN;
  if (!SB_URL || !ANON) return res.status(503).json({ error: 'Config incompleta' });
  if (!MP) return res.status(503).json({ error: 'El pago en línea todavía no está disponible. Escribinos por WhatsApp.' });

  const token  = String(req.body?.token || '');
  const itemId = String(req.body?.item_id || '');
  if (!UUID_RE.test(token) || !UUID_RE.test(itemId)) return res.status(400).json({ error: 'Datos inválidos' });

  // Lectura con la anon key + token: RLS deja ver solo el proyecto de este portal
  const h = { apikey: ANON, Authorization: 'Bearer ' + ANON, 'x-portal-token': token };
  const get = async (path) => {
    const r = await httpsRequest('GET', `${SB_URL}/rest/v1/${path}`, h);
    if (r.status !== 200) throw new Error('supabase ' + r.status + ' ' + path.split('?')[0]);
    return JSON.parse(r.body || '[]');
  };

  try {
    const [lead] = await get(`leads?portal_token=eq.${token}&select=id,email&limit=1`);
    if (!lead) return res.status(404).json({ error: 'Portal no encontrado' });
    const [project] = await get(`projects?lead_id=eq.${encodeURIComponent(lead.id)}&select=id,nombre&order=created_at.asc&limit=1`);
    if (!project) return res.status(409).json({ error: 'Este portal aún no tiene proyecto' });
    const [item] = await get(`budget_items?id=eq.${itemId}&project_id=eq.${project.id}&select=id,nombre,monto,estado&limit=1`);
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
    if (item.estado === 'pagado') return res.status(409).json({ error: 'Este ítem ya está pagado' });
    if (!Number.isInteger(item.monto) || item.monto <= 0) return res.status(409).json({ error: 'Este ítem todavía no tiene monto definido' });

    const volver = (estado) => `${SITE}/c/${token}?pago=${estado}#pres`;
    const pref = {
      items: [{ id: item.id, title: String(item.nombre).substring(0, 200), quantity: 1, currency_id: 'CLP', unit_price: item.monto }],
      external_reference: item.id,
      notification_url: `${SITE}/api/pagos?webhook=1`,
      back_urls: { success: volver('ok'), pending: volver('pendiente'), failure: volver('error') },
      auto_return: 'approved',
      statement_descriptor: 'HORIZON',
      metadata: { project_id: project.id },
    };
    if (lead.email) pref.payer = { email: lead.email };

    const r = await httpsRequest('POST', `${MP_API}/checkout/preferences`,
      { Authorization: 'Bearer ' + MP, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() }, pref);
    const data = JSON.parse(r.body || '{}');
    if (r.status >= 300 || !data.init_point) {
      console.error('[pagos] preferencia:', r.status, data.message || '');
      return res.status(502).json({ error: 'No se pudo iniciar el pago. Probá de nuevo en un rato.' });
    }
    return res.json({ ok: true, url: data.init_point });
  } catch (err) {
    console.error('[pagos] crear:', err.message);
    return res.status(502).json({ error: 'No se pudo iniciar el pago' });
  }
}

async function webhook(req, res) {
  const MP     = process.env.MP_ACCESS_TOKEN;
  const SECRET = process.env.MP_WEBHOOK_SECRET;
  const SB_URL = process.env.SUPABASE_URL;
  const SRK    = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const tipo   = req.body?.type || req.query?.type || req.query?.topic;
  const dataId = String(req.query?.['data.id'] || req.body?.data?.id || req.query?.id || '');
  if (tipo !== 'payment' || !/^\d+$/.test(dataId)) return res.status(200).json({ ok: true });   // otros avisos: se ignoran
  if (!MP || !SB_URL || !SRK) return res.status(503).json({ error: 'Config incompleta' });      // MP reintenta

  // La firma es la primera barrera; la segunda (la que manda) es consultar el pago en la API de MP.
  if (SECRET && !firmaValida(req, dataId, SECRET)) {
    console.warn('[pagos] webhook con firma inválida', dataId);
    return res.status(401).json({ error: 'Firma inválida' });
  }
  if (!SECRET) console.warn('[pagos] MP_WEBHOOK_SECRET sin configurar: se valida solo contra la API de MP');

  try {
    const pr = await httpsRequest('GET', `${MP_API}/v1/payments/${dataId}`, { Authorization: 'Bearer ' + MP });
    if (pr.status !== 200) { console.error('[pagos] consulta pago:', pr.status); return res.status(502).end(); }
    const pago = JSON.parse(pr.body || '{}');
    const itemId = String(pago.external_reference || '');
    if (pago.status !== 'approved' || pago.currency_id !== 'CLP' || !UUID_RE.test(itemId)) {
      console.log('[pagos] pago no aprobado o ajeno:', dataId, pago.status);
      return res.status(200).json({ ok: true });
    }

    const sb  = { apikey: SRK, Authorization: 'Bearer ' + SRK };
    const sbw = { ...sb, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    const ir = await httpsRequest('GET', `${SB_URL}/rest/v1/budget_items?id=eq.${itemId}&select=id,project_id,nombre,monto,estado&limit=1`, sb);
    const [item] = JSON.parse(ir.body || '[]');
    if (!item) { console.warn('[pagos] ítem no existe:', itemId); return res.status(200).json({ ok: true }); }
    if (item.estado === 'pagado') return res.status(200).json({ ok: true });                       // aviso repetido
    if (!(Number(pago.transaction_amount) >= Number(item.monto))) {
      console.error('[pagos] monto no cuadra:', itemId, pago.transaction_amount, item.monto);
      return res.status(200).json({ ok: true });
    }

    const up = await httpsRequest('PATCH', `${SB_URL}/rest/v1/budget_items?id=eq.${itemId}&estado=eq.pendiente`, sbw, {
      estado: 'pagado', pagado_at: hoyChile(), metodo_pago: 'mercadopago', mp_payment_id: String(pago.id),
      comprobante: `Mercado Pago #${pago.id}`,
    });
    if (up.status >= 300) { console.error('[pagos] PATCH ítem:', up.status, up.body); return res.status(502).end(); }

    // Aviso en la actividad del portal
    const pj = await httpsRequest('GET', `${SB_URL}/rest/v1/projects?id=eq.${item.project_id}&select=lead_id&limit=1`, sb);
    const [project] = JSON.parse(pj.body || '[]');
    if (project?.lead_id) {
      await httpsRequest('POST', `${SB_URL}/rest/v1/portal_events`, sbw, {
        lead_id: project.lead_id, tipo: 'pago', autor: 'horizon',
        contenido: `Pago recibido: ${item.nombre} (${clp(item.monto)}). ¡Gracias!`,
      }).catch(err => console.warn('[pagos] evento:', err.message));
    }
    console.log('[pagos] ítem pagado:', itemId, 'MP', pago.id);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[pagos] webhook:', err.message);
    return res.status(502).end();
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (req.query?.webhook) return webhook(req, res);
  return crearPago(req, res);
};
module.exports.firmaValida = firmaValida;
