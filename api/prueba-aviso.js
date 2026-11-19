'use strict';

// Avisos de las pruebas de 15 días de Mesa Cero. Lo llama el servidor de Mesa Cero (api/prueba.js).
//   POST /api/prueba-aviso { slug, tipo, plan }
//     tipo "nueva"   → correo de bienvenida al dueño (link a su panel) + aviso a Benja
//     tipo "acceso"  → reenvía el link del panel al dueño (volvió a llenar el formulario)
//     tipo "activar" → aviso a Benja: el dueño tocó "Activar mi plan" (y el lead pasa a propuesta)
// Nadie puede usar esto para mandar correos a terceros: los datos (correo, nombre) se leen de la
// licencia en el Supabase de Mesa Cero, no del request, y cada aviso tiene ventana y tope.

const { httpsRequest, rateLimit, getIp } = require('./shared');
const { enviarCorreo } = require('./_correo');

const MC_URL = 'https://wpljybwutgxvjjlmbdxc.supabase.co';
const MC_SITE = (process.env.MESA_CERO_SITE || 'https://mesa-cero.vercel.app').replace(/\/$/, '');
const SITE = (process.env.SITE_URL || 'https://www.horizonweb.cl').replace(/\/$/, '');
const WA_BENJA = '56976962659';
const SLUG = /^prueba-[a-z0-9]{6}$/;
const PLANES = {
  esencial: { nm: 'Esencial', impl: 290000, mes: 99000 },
  pro: { nm: 'Pro', impl: 490000, mes: 199000 },
};

const clp = n => '$' + Math.round(n).toLocaleString('es-CL');
const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fecha = iso => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', timeZone: 'America/Santiago' });

function mcHeaders() {
  const k = process.env.MESA_CERO_SERVICE_KEY || '';
  const base = { apikey: k, 'Content-Type': 'application/json' };
  return k.startsWith('sb_') ? base : Object.assign(base, { Authorization: 'Bearer ' + k });
}

async function ultimoAviso(slug, accion) {
  const r = await httpsRequest('GET', `${MC_URL}/rest/v1/licencias_prueba_eventos?slug=eq.${slug}&accion=eq.${accion}&select=created_at&order=created_at.desc&limit=1`, mcHeaders());
  const row = r.status === 200 ? JSON.parse(r.body || '[]')[0] : null;
  return row ? Date.parse(row.created_at) : 0;
}
function registrar(slug, accion, detalle) {
  return httpsRequest('POST', `${MC_URL}/rest/v1/licencias_prueba_eventos`, Object.assign({ Prefer: 'return=minimal' }, mcHeaders()),
    { slug, accion, detalle: String(detalle || '').slice(0, 200) }).catch(() => {});
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (rateLimit('aviso:' + getIp(req), 60_000, 20)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
  if (!process.env.MESA_CERO_SERVICE_KEY) return res.status(503).json({ error: 'Falta MESA_CERO_SERVICE_KEY' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const slug = String(body.slug || '');
  const tipo = String(body.tipo || '');
  if (!SLUG.test(slug) || !['nueva', 'acceso', 'activar'].includes(tipo)) return res.status(400).json({ error: 'Datos inválidos' });

  try {
    const r = await httpsRequest('GET', `${MC_URL}/rest/v1/licencias_prueba?slug=eq.${slug}&select=slug,nombre_local,nombre_contacto,whatsapp,email,rubro,comuna,origen,estado,created_at,expires_at&limit=1`, mcHeaders());
    const lic = r.status === 200 ? JSON.parse(r.body || '[]')[0] : null;
    if (!lic) return res.status(404).json({ error: 'Licencia no encontrada' });

    const ahora = Date.now();
    const benja = process.env.CORREO_AVISOS || process.env.CORREO_REMITENTE || 'soportebinks@gmail.com';
    const out = {};

    if (tipo === 'nueva') {
      // Solo recién creada y una vez.
      if (ahora - Date.parse(lic.created_at) > 20 * 60_000) return res.status(409).json({ error: 'Fuera de plazo' });
      if (await ultimoAviso(slug, 'aviso_nueva')) return res.status(200).json({ ok: true, repetido: true });
      await registrar(slug, 'aviso_nueva', 'bienvenida + aviso');
      const c = correoBienvenida(lic, false);
      out.dueno = lic.email ? await enviarCorreo({ to: lic.email, subject: c.subject, html: c.html, text: c.text }) : 'sin correo';
      const b = correoBenjaNueva(lic);
      out.benja = await enviarCorreo({ to: benja, subject: b.subject, html: b.html, text: b.text });
    } else if (tipo === 'acceso') {
      // Reenvío del link: como máximo uno cada 10 minutos por licencia.
      if (ahora - (await ultimoAviso(slug, 'aviso_acceso')) < 10 * 60_000) return res.status(200).json({ ok: true, repetido: true });
      await registrar(slug, 'aviso_acceso', 'reenvío del link');
      const c = correoBienvenida(lic, true);
      out.dueno = lic.email ? await enviarCorreo({ to: lic.email, subject: c.subject, html: c.html, text: c.text }) : 'sin correo';
    } else {
      const plan = PLANES[body.plan] ? body.plan : 'esencial';
      if (ahora - (await ultimoAviso(slug, 'quiere_' + plan)) < 30 * 60_000) return res.status(200).json({ ok: true, repetido: true });
      await registrar(slug, 'quiere_' + plan, 'tocó Activar mi plan');
      const b = correoBenjaActivar(lic, PLANES[plan]);
      out.benja = await enviarCorreo({ to: benja, subject: b.subject, html: b.html, text: b.text });
      // El lead en OPS pasa a propuesta.
      const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (SB && KEY && lic.email) {
        await httpsRequest('PATCH', `${SB}/rest/v1/leads?email=eq.${encodeURIComponent(lic.email)}&status=in.(new,contactado)`,
          { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          { status: 'propuesta', prioridad: 'Alta' }).catch(() => {});
      }
    }
    Object.keys(out).forEach(k => { if (out[k] !== 'enviado') console.warn('[prueba-aviso]', tipo, k, out[k]); });
    return res.status(200).json({ ok: true, correos: out });
  } catch (e) {
    console.error('[prueba-aviso]', e.message);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// ── Correos ──────────────────────────────────────────────────────────────────
function marco(titulo, cuerpo) {
  return `<!doctype html><html><body style="margin:0;background:#FBF7F1;font-family:Helvetica,Arial,sans-serif;color:#241610">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#1A1210;border-radius:16px 16px 0 0;padding:18px 22px;color:#fff;font-weight:800;font-size:18px">Mesa Cero <span style="font-weight:400;font-size:12px;letter-spacing:2px;color:#B9A994">· HORIZON</span></div>
  <div style="background:#fff;border:1px solid #EFE6DA;border-top:0;border-radius:0 0 16px 16px;padding:24px 22px">
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2">${titulo}</h1>
    ${cuerpo}
    <p style="margin:22px 0 0;font-size:14px;color:#6B5A46">Benja · HORIZON<br>WhatsApp +56 9 7696 2659 · horizonweb.cl</p>
  </div>
</div></body></html>`;
}
const boton = (href, txt, color) => `<a href="${href}" style="display:block;text-align:center;background:${color || '#E5402C'};color:#fff;text-decoration:none;font-weight:800;font-size:16px;padding:15px 18px;border-radius:12px;margin:0 0 10px">${txt}</a>`;

function correoBienvenida(lic, reenvio) {
  const nombre = String(lic.nombre_contacto || '').split(' ')[0] || 'hola';
  const panel = `${MC_SITE}/admin/dashboard.html?t=${lic.slug}`;
  const web = `${MC_SITE}/mi-web?t=${lic.slug}`;
  const planes = `${MC_SITE}/prueba#planes`;
  const vence = fecha(lic.expires_at);
  const subject = reenvio ? `Tu acceso a Mesa Cero · ${lic.nombre_local}` : `Tu prueba de Mesa Cero está lista · ${lic.nombre_local}`;
  const text = [
    `Hola ${nombre}:`, '',
    reenvio ? `Aquí está de nuevo el acceso a tu panel de ${lic.nombre_local}.` : `Tu panel de ${lic.nombre_local} ya está listo. Tienes 15 días para probarlo, hasta el ${vence}.`, '',
    `Tu panel: ${panel}`, `Tu web de pedidos: ${web}`, '',
    'Qué probar primero:',
    '1. Abre tu web de pedidos y haz un pedido de prueba.',
    '2. Mira cómo cae en el tablero de tu panel y acéptalo.',
    '3. Revisa el inicio: ventas del día, hora peak y pedidos atrasados.', '',
    `Cuando quieras dejarlo funcionando con tu WhatsApp y tu carta real, mira los planes: ${planes}`,
    'Los primeros 3 locales tienen valor fundador: 2.º mes de soporte sin costo y valor congelado 12 meses.', '',
    'Guarda este correo: el link de arriba es tu acceso al panel.', '',
    'Benja · HORIZON', 'WhatsApp +56 9 7696 2659',
  ].join('\n');
  const html = marco(reenvio ? `${h(nombre)}, aquí está tu acceso` : `${h(nombre)}, tu panel está listo`, `
    <p style="margin:0 0 18px;font-size:15.5px;line-height:1.55">${reenvio ? `Este es el link a tu panel de <b>${h(lic.nombre_local)}</b>.` : `Tu panel de <b>${h(lic.nombre_local)}</b> ya está funcionando. Tienes <b>15 días</b> para probarlo, hasta el <b>${h(vence)}</b>.`}</p>
    ${boton(panel, 'Entrar a mi panel')}
    ${boton(web, 'Ver mi web de pedidos', '#241610')}
    <p style="margin:6px 0 20px;font-size:13px;color:#9C8A6E">Guarda este correo: estos links son tu acceso.</p>
    <h2 style="font-size:17px;margin:0 0 8px">Qué probar primero</h2>
    <ol style="margin:0 0 20px;padding-left:20px;font-size:14.5px;line-height:1.55">
      <li>Abre tu web de pedidos y haz un pedido de prueba.</li>
      <li>Mira cómo cae en el tablero de tu panel y acéptalo.</li>
      <li>Revisa el inicio: ventas del día, hora peak y pedidos atrasados.</li>
    </ol>
    <div style="background:#FFF4E3;border:1px solid #F3D9A6;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.5">
      <b>Valor fundador:</b> los primeros 3 locales tienen el 2.º mes de soporte sin costo y el valor congelado 12 meses.
      Esencial ${clp(290000)} + ${clp(99000)}/mes · Pro ${clp(490000)} + ${clp(199000)}/mes. <a href="${planes}" style="color:#E5402C;font-weight:700">Ver planes</a>
    </div>`);
  return { subject, html, text };
}

function correoBenjaNueva(lic) {
  const nombre = String(lic.nombre_contacto || '').split(' ')[0] || 'hola';
  const msg = `¡Hola ${nombre}! Soy Benja de HORIZON. Vi que ya entraste a tu panel de ${lic.nombre_local}. Haz esta prueba: abre "Ver vista de pedido", pide algo desde tu web y mira cómo cae en el tablero. Toma 1 minuto.`;
  const wa = `https://wa.me/${String(lic.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  const subject = `Nueva prueba Mesa Cero: ${lic.nombre_local}`;
  const text = [`Nueva prueba de 15 días: ${lic.nombre_local}`, `Contacto: ${lic.nombre_contacto} · +${String(lic.whatsapp).replace(/\D/g, '')} · ${lic.email}`,
    `Rubro: ${lic.rubro}${lic.comuna ? ' · ' + lic.comuna : ''} · Origen: ${lic.origen}`, `Vence: ${fecha(lic.expires_at)}`, '',
    `Escribirle (día 0): ${wa}`, `Su panel: ${MC_SITE}/admin/dashboard.html?t=${lic.slug}`, `Licencias: ${SITE}/ops/licencias`].join('\n');
  const html = marco(`Nueva prueba: ${h(lic.nombre_local)}`, `
    <table style="width:100%;font-size:14.5px;border-collapse:collapse;margin:0 0 18px">
      <tr><td style="padding:5px 0;color:#6B5A46">Contacto</td><td style="text-align:right;font-weight:700">${h(lic.nombre_contacto)}</td></tr>
      <tr><td style="padding:5px 0;color:#6B5A46">WhatsApp</td><td style="text-align:right;font-weight:700">+${h(String(lic.whatsapp).replace(/\D/g, ''))}</td></tr>
      <tr><td style="padding:5px 0;color:#6B5A46">Correo</td><td style="text-align:right;font-weight:700">${h(lic.email)}</td></tr>
      <tr><td style="padding:5px 0;color:#6B5A46">Rubro</td><td style="text-align:right;font-weight:700">${h(lic.rubro)}${lic.comuna ? ' · ' + h(lic.comuna) : ''}</td></tr>
      <tr><td style="padding:5px 0;color:#6B5A46">Origen</td><td style="text-align:right;font-weight:700">${h(lic.origen)}</td></tr>
      <tr><td style="padding:5px 0;color:#6B5A46">Vence</td><td style="text-align:right;font-weight:700">${h(fecha(lic.expires_at))}</td></tr>
    </table>
    ${boton(wa, 'Escribirle por WhatsApp (día 0)', '#1D9A57')}
    ${boton(`${SITE}/ops/licencias`, 'Ver en OPS · Licencias', '#241610')}
    <p style="margin:6px 0 0;font-size:13px"><a href="${MC_SITE}/admin/dashboard.html?t=${lic.slug}" style="color:#E5402C">Abrir su panel</a></p>`);
  return { subject, html, text };
}

function correoBenjaActivar(lic, plan) {
  const nombre = String(lic.nombre_contacto || '').split(' ')[0] || 'hola';
  const msg = `¡Hola ${nombre}! Vi que quieres activar el plan ${plan.nm} para ${lic.nombre_local}. ¿Te parece si lo vemos hoy? Te explico los pasos y quedas con valor fundador.`;
  const wa = `https://wa.me/${String(lic.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  const subject = `${lic.nombre_local} quiere activar el plan ${plan.nm}`;
  const text = [`${lic.nombre_local} tocó "Activar mi plan" → ${plan.nm} (${clp(plan.impl)} + ${clp(plan.mes)}/mes).`,
    `Contacto: ${lic.nombre_contacto} · +${String(lic.whatsapp).replace(/\D/g, '')} · ${lic.email}`, '', `Escribirle: ${wa}`, `Licencias: ${SITE}/ops/licencias`].join('\n');
  const html = marco(`${h(lic.nombre_local)} quiere activar el plan ${h(plan.nm)}`, `
    <p style="margin:0 0 16px;font-size:15.5px;line-height:1.55">Tocó <b>"Activar mi plan"</b> en su panel. Plan <b>${h(plan.nm)}</b>: ${clp(plan.impl)} de implementación + ${clp(plan.mes)}/mes desde el mes 2.<br>Contacto: <b>${h(lic.nombre_contacto)}</b> · +${h(String(lic.whatsapp).replace(/\D/g, ''))}</p>
    ${boton(wa, 'Escribirle ahora por WhatsApp', '#1D9A57')}
    ${boton(`${SITE}/ops/licencias`, 'Ver en OPS · Licencias', '#241610')}
    <p style="margin:6px 0 0;font-size:13px;color:#6B5A46">El lead quedó en etapa "propuesta" en el pipeline.</p>`);
  return { subject, html, text };
}
