'use strict';

// Compra en línea de Mesa Cero (licencia + 50% de la implementación) con Mercado Pago (Checkout Pro).
//
// POST /api/mesa-cero-compra { slug, plan }
//      Lo llama el servidor de Mesa Cero (api/prueba.js, accion "comprar") desde la web o el panel de prueba.
//      → crea la preferencia por el 50% de la implementación del plan y devuelve { url } (pasarela de MP).
//        El monto sale de PLANES (acá), nunca del navegador.
//
// POST /api/mesa-cero-compra?webhook=1  (notificación de Mercado Pago)
//      → firma (MP_WEBHOOK_SECRET) + consulta del pago en la API de MP. Solo si está aprobado y el monto
//        cuadra: la licencia pasa a cliente (licencia_prueba_accion "convertir"), le llega al dueño el
//        correo de bienvenida (accesos, comprobante, /instalar, próximos pasos), el aviso a Benja y el
//        lead sube a "arranque" en OPS. Cada pago se procesa una sola vez (licencias_prueba_eventos).
//
// Variables: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MESA_CERO_SERVICE_KEY, SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (OPS),
//            HORIZON_API_URL (opcional: dominio para el webhook; www.horizonweb.cl está detrás de Cloudflare).

const crypto = require('crypto');
const { httpsRequest, rateLimit, getIp } = require('./shared');
const { enviarCorreo } = require('./_correo');
const { firmaValida } = require('./pagos');
const aviso = require('./prueba-aviso');
const { marco, boton, mcHeaders, registrar, ultimoAviso, fecha, h, clp, PLANES, MC_URL, MC_SITE, SITE } = aviso;

const MP_API = 'https://api.mercadopago.com';
const API = (process.env.HORIZON_API_URL || 'https://horizon-web-three.vercel.app').replace(/\/$/, '');
const SLUG = /^prueba-[a-z0-9]{6}$/;
const anticipo = (plan) => Math.round(PLANES[plan].impl / 2);

async function licencia(slug) {
  const r = await httpsRequest('GET', `${MC_URL}/rest/v1/licencias_prueba?slug=eq.${slug}&select=slug,nombre_local,nombre_contacto,whatsapp,email,rubro,comuna,origen,estado,created_at,expires_at&limit=1`, mcHeaders());
  return r.status === 200 ? JSON.parse(r.body || '[]')[0] || null : null;
}

async function crear(req, res) {
  if (rateLimit('compra:' + getIp(req), 60_000, 20)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
  const MP = process.env.MP_ACCESS_TOKEN;
  if (!MP) return res.status(503).json({ error: 'El pago en línea todavía no está disponible. Escríbenos por WhatsApp.' });
  if (!process.env.MESA_CERO_SERVICE_KEY) return res.status(503).json({ error: 'Falta MESA_CERO_SERVICE_KEY' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const slug = String(body.slug || '');
  const plan = PLANES[body.plan] ? body.plan : null;
  if (!SLUG.test(slug) || !plan) return res.status(400).json({ error: 'Datos inválidos' });

  try {
    const lic = await licencia(slug);
    if (!lic) return res.status(404).json({ error: 'No encontramos tu prueba' });
    if (lic.estado === 'convertida') return res.status(409).json({ error: 'Este local ya tiene su plan activo' });

    const P = PLANES[plan];
    const volver = (estado) => `${MC_SITE}/admin/dashboard.html?t=${slug}&compra=${estado}`;
    const pref = {
      items: [{ id: `mesa-cero-${plan}`, title: `Mesa Cero · Plan ${P.nm} · 50% de la implementación`, quantity: 1, currency_id: 'CLP', unit_price: anticipo(plan) }],
      external_reference: `mc|${slug}|${plan}`,
      notification_url: `${API}/api/mesa-cero-compra?webhook=1`,
      back_urls: { success: volver('ok'), pending: volver('pendiente'), failure: volver('error') },
      auto_return: 'approved',
      statement_descriptor: 'HORIZON',
    };
    if (lic.email) pref.payer = { email: lic.email };
    const r = await httpsRequest('POST', `${MP_API}/checkout/preferences`,
      { Authorization: 'Bearer ' + MP, 'Content-Type': 'application/json', 'X-Idempotency-Key': crypto.randomUUID() }, pref);
    const data = JSON.parse(r.body || '{}');
    if (r.status >= 300 || !data.init_point) {
      console.error('[mesa-cero-compra] preferencia:', r.status, data.message || '');
      return res.status(502).json({ error: 'No se pudo iniciar el pago. Prueba de nuevo en un rato o escríbenos por WhatsApp.' });
    }
    registrar(slug, 'checkout_' + plan, 'abrió el pago');
    return res.json({ ok: true, url: data.init_point });
  } catch (e) {
    console.error('[mesa-cero-compra] crear:', e.message);
    return res.status(502).json({ error: 'No se pudo iniciar el pago' });
  }
}

async function webhook(req, res) {
  const MP = process.env.MP_ACCESS_TOKEN;
  const SECRET = process.env.MP_WEBHOOK_SECRET;
  const tipo = req.body?.type || req.query?.type || req.query?.topic;
  const dataId = String(req.query?.['data.id'] || req.body?.data?.id || req.query?.id || '');
  if (tipo !== 'payment' || !/^\d+$/.test(dataId)) return res.status(200).json({ ok: true });
  if (!MP || !process.env.MESA_CERO_SERVICE_KEY) return res.status(503).json({ error: 'Config incompleta' }); // MP reintenta
  if (SECRET && !firmaValida(req, dataId, SECRET)) {
    console.warn('[mesa-cero-compra] firma inválida', dataId);
    return res.status(401).json({ error: 'Firma inválida' });
  }

  try {
    const pr = await httpsRequest('GET', `${MP_API}/v1/payments/${dataId}`, { Authorization: 'Bearer ' + MP });
    if (pr.status !== 200) { console.error('[mesa-cero-compra] consulta pago:', pr.status); return res.status(502).end(); }
    const pago = JSON.parse(pr.body || '{}');
    const [pre, slug, plan] = String(pago.external_reference || '').split('|');
    if (pre !== 'mc' || !SLUG.test(slug || '') || !PLANES[plan]) return res.status(200).json({ ok: true }); // no es de Mesa Cero
    if (pago.status !== 'approved' || pago.currency_id !== 'CLP') return res.status(200).json({ ok: true });
    if (!(Number(pago.transaction_amount) >= anticipo(plan))) {
      console.error('[mesa-cero-compra] monto no cuadra:', slug, pago.transaction_amount);
      return res.status(200).json({ ok: true });
    }
    const evento = 'pago_' + pago.id;
    if (await ultimoAviso(slug, evento)) return res.status(200).json({ ok: true, repetido: true });

    const lic = await licencia(slug);
    if (!lic) { console.warn('[mesa-cero-compra] licencia no existe:', slug); return res.status(200).json({ ok: true }); }
    const cv = await httpsRequest('POST', `${MC_URL}/rest/v1/rpc/licencia_prueba_accion`, mcHeaders(), { p_slug: slug, p_accion: 'convertir', p_dias: 7, p_nota: null });
    if (cv.status >= 400) { console.error('[mesa-cero-compra] convertir:', cv.status, cv.body); return res.status(502).end(); }
    await registrar(slug, evento, `Plan ${PLANES[plan].nm} · ${clp(pago.transaction_amount)} · MP #${pago.id}`);

    const benja = process.env.CORREO_AVISOS || process.env.CORREO_REMITENTE || 'soportebinks@gmail.com';
    const c = correoCompra(lic, plan, pago);
    const b = correoBenjaCompra(lic, plan, pago);
    const out = {
      dueno: lic.email ? await enviarCorreo({ to: lic.email, subject: c.subject, html: c.html, text: c.text }) : 'sin correo',
      benja: await enviarCorreo({ to: benja, subject: b.subject, html: b.html, text: b.text }),
    };
    Object.keys(out).forEach(k => { if (out[k] !== 'enviado') console.warn('[mesa-cero-compra] correo', k, out[k]); });

    const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SB && KEY && lic.email) {
      await httpsRequest('PATCH', `${SB}/rest/v1/leads?email=eq.${encodeURIComponent(lic.email)}&status=in.(new,contactado,propuesta)`,
        { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        { status: 'arranque', prioridad: 'Alta' }).catch(() => {});
    }
    console.log('[mesa-cero-compra] compra:', slug, plan, 'MP', pago.id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[mesa-cero-compra] webhook:', e.message);
    return res.status(502).end();
  }
}

function correoCompra(lic, plan, pago) {
  const P = PLANES[plan];
  const nombre = String(lic.nombre_contacto || '').split(' ')[0] || 'hola';
  const panel = `${MC_SITE}/admin/dashboard.html?t=${lic.slug}`;
  const instalar = `${MC_SITE}/instalar?t=${lic.slug}`;
  const plazo = plan === 'pro' ? '3–4 semanas' : '2–3 semanas';
  const saldo = P.impl - anticipo(plan);
  const subject = `Bienvenido a Mesa Cero · ${lic.nombre_local}`;
  const text = [
    `Hola ${nombre}:`, '',
    `Recibimos tu pago. ${lic.nombre_local} ya tiene el plan ${P.nm} de Mesa Cero.`, '',
    `Comprobante: 50% de la implementación, ${clp(pago.transaction_amount)} (Mercado Pago #${pago.id}). El saldo, ${clp(saldo)}, se paga al entregar.`, '',
    `Tu panel: ${panel}`,
    `Instala Mesa Cero en tus equipos (caja, cocina y tu celular): ${instalar}`, '',
    'Próximos pasos:',
    '1. Te escribo por WhatsApp para diseñar tu web y tu agente.',
    '2. Mándame fotos de tu carta, tu logo y cómo atiendes hoy los pedidos.',
    `3. Te entrego en ${plazo}. Ahí pagas el saldo.`,
    `4. El mes 1 de soporte va incluido. Desde el mes 2, ${clp(P.mes)}/mes.`, '',
    'Guarda este correo: aquí están tus accesos.', '',
    'Benja · HORIZON', 'WhatsApp +56 9 7696 2659',
  ].join('\n');
  const html = marco(`${h(nombre)}, bienvenido a Mesa Cero`, `
    <p style="margin:0 0 16px;font-size:15.5px;line-height:1.55">Recibimos tu pago. <b>${h(lic.nombre_local)}</b> ya tiene el <b>plan ${h(P.nm)}</b>.</p>
    <table style="width:100%;font-size:14.5px;border-collapse:collapse;margin:0 0 18px">
      <tr><td style="padding:5px 0;color:#6B5A46">Pagado hoy (50% de la implementación)</td><td style="text-align:right;font-weight:700">${clp(pago.transaction_amount)}</td></tr>
      <tr><td style="padding:5px 0;color:#6B5A46">Saldo al entregar</td><td style="text-align:right;font-weight:700">${clp(saldo)}</td></tr>
      <tr><td style="padding:5px 0;color:#6B5A46">Soporte desde el mes 2</td><td style="text-align:right;font-weight:700">${clp(P.mes)}/mes</td></tr>
      <tr><td style="padding:5px 0;color:#6B5A46">Comprobante</td><td style="text-align:right;font-weight:700">Mercado Pago #${h(pago.id)}</td></tr>
    </table>
    ${boton(panel, 'Entrar a mi panel')}
    ${boton(instalar, 'Instalar en mis equipos', '#241610')}
    <p style="margin:6px 0 20px;font-size:13px;color:#9C8A6E">Guarda este correo: aquí están tus accesos.</p>
    <h2 style="font-size:17px;margin:0 0 8px">Próximos pasos</h2>
    <ol style="margin:0;padding-left:20px;font-size:14.5px;line-height:1.55">
      <li>Te escribo por WhatsApp para diseñar tu web y tu agente.</li>
      <li>Mándame fotos de tu carta, tu logo y cómo atiendes hoy los pedidos.</li>
      <li>Te entrego en ${plazo}. Ahí pagas el saldo.</li>
      <li>El mes 1 de soporte va incluido. Desde el mes 2, ${clp(P.mes)}/mes.</li>
    </ol>`);
  return { subject, html, text };
}

function correoBenjaCompra(lic, plan, pago) {
  const P = PLANES[plan];
  const nombre = String(lic.nombre_contacto || '').split(' ')[0] || 'hola';
  const msg = `¡Hola ${nombre}! Soy Benja de HORIZON. Recibí tu pago del plan ${P.nm} para ${lic.nombre_local}, ¡bienvenido! Para diseñar tu web y tu agente, mándame fotos de tu carta, tu logo y cuéntame cómo atiendes hoy los pedidos.`;
  const wa = `https://wa.me/${String(lic.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  const subject = `💰 ${lic.nombre_local} compró el plan ${P.nm}`;
  const text = [`${lic.nombre_local} pagó el 50% del plan ${P.nm}: ${clp(pago.transaction_amount)} (MP #${pago.id}).`,
    `Contacto: ${lic.nombre_contacto} · +${String(lic.whatsapp).replace(/\D/g, '')} · ${lic.email}`, '', `Escribirle: ${wa}`, `Licencias: ${SITE}/ops/licencias`].join('\n');
  const html = marco(`${h(lic.nombre_local)} compró el plan ${h(P.nm)}`, `
    <p style="margin:0 0 16px;font-size:15.5px;line-height:1.55">Pagó el <b>50% de la implementación</b>: ${clp(pago.transaction_amount)} (Mercado Pago #${h(pago.id)}). La licencia ya quedó como cliente.<br>Contacto: <b>${h(lic.nombre_contacto)}</b> · +${h(String(lic.whatsapp).replace(/\D/g, ''))}</p>
    ${boton(wa, 'Escribirle para partir el diseño', '#1D9A57')}
    ${boton(`${SITE}/ops/licencias`, 'Ver en OPS · Licencias', '#241610')}
    <p style="margin:6px 0 0;font-size:13px;color:#6B5A46">El lead quedó en etapa "arranque".</p>`);
  return { subject, html, text };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (req.query?.webhook) return webhook(req, res);
  return crear(req, res);
};
module.exports.correoCompra = correoCompra;
