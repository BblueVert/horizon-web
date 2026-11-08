'use strict';

const { sanitize, sanitizeEmail, rateLimit, getIp, httpsPost, httpsRequest, uid } = require('./shared');
const { enviarCorreo } = require('./_correo');

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
    // Su portal (/c/<token>) nace con la visita: antes del proyecto muestra el brief; al activarlo, el avance y los pagos.
    lead.portal_token = uid();
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
      // Radiografía de alguien que ya es lead (mismo correo): se actualiza su ficha en vez de fallar.
      if (r.status === 409 && rx) {
        const ok = await actualizarLead(SB_URL, SB_KEY, lead);
        if (!ok) return res.status(503).json({ error: 'Error al guardar el lead' });
      } else if (r.status >= 400) {
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

  const SITE = (process.env.SITE_URL || 'https://www.horizonweb.cl').replace(/\/$/, '');
  const portal = lead.portal_token ? `${SITE}/c/${lead.portal_token}` : undefined;

  // Radiografía de terreno: le llega por correo su diagnóstico y plan de acción (y la cotización si partió).
  let correo;
  if (rx) {
    const c = correoRadiografia(lead, rx, portal);
    correo = await enviarCorreo({ to: lead.email, subject: c.subject, html: c.html, text: c.text, cc: process.env.CORREO_COPIA || undefined });
    if (correo !== 'enviado') console.warn('[leads] correo radiografía:', correo);
  }

  return res.status(200).json({ ok: true, id: lead.id, portal, correo });
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
    agente_mes:  num(rx.agente_mes, 100000000),
    pro_mes:     num(rx.pro_mes, 100000000),
    modelo:      pick(rx.modelo, ['general', 'pasteleria', 'comida', 'clinica'], 'general'),
    recomendado: pick(rx.recomendado, ['esencial', 'pro', 'no'], 'esencial'),
    elegido:     pick(rx.elegido, ['esencial', 'pro'], 'esencial'),
    decision:    pick(rx.decision, ['partimos', 'lo-pienso'], 'lo-pienso'),
    mejoras:     Array.isArray(rx.mejoras) ? rx.mejoras.slice(0, 10).map(m => sanitize(m, 200)) : [],
    color:       /^#[0-9a-f]{6}$/i.test(String(rx.color || '')) ? String(rx.color) : '',
    lecturas:    Array.isArray(rx.lecturas) ? rx.lecturas.slice(0, 8).map(m => sanitize(m, 300)) : [],
    resumen:     sanitize(rx.resumen, 2000),
    conversacion: sanitize(rx.conversacion, 2000),
    notas:       sanitize(rx.notas, 1000),
    contrato:    rx.contrato && typeof rx.contrato === 'object' ? {
      rut:          sanitize(rx.contrato.rut, 20),
      razon_social: sanitize(rx.contrato.razon_social, 150),
      direccion:    sanitize(rx.contrato.direccion, 200),
    } : null,
    negocio_slug: sanitize(rx.negocio_slug, 60),
    fecha:       new Date().toISOString(),
  };
}

// Precios de terreno: misma fuente que shared/hz-radiografia.js (ESTRATEGIA/HORIZON-ACELERADORA-NOV-DIC-2026.md).
const PACKS = {
  esencial: { nm: 'Esencial', impl: 290000, mes: 99000, incluye: ['Web del negocio + ficha de Google Business', 'Agente IA en WhatsApp: responde 24/7, agenda y toma pedidos', 'Panel con cada consulta, hora y pedido', 'Primer mes de mensualidad incluido'] },
  pro:      { nm: 'Pro', impl: 490000, mes: 149000, incluye: ['Todo lo del Pack Esencial', 'Seguimiento automático a quien preguntó y no agendó', 'Recordatorio el día antes y mensaje a clientes que no vuelven', 'CRM con historial y dashboard con reporte mensual', 'Primer mes de mensualidad incluido'] },
};
const clp = n => '$' + Math.round(n).toLocaleString('es-CL');
const h = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function correoRadiografia(lead, rx, portal) {
  const pk = PACKS[rx.elegido] || PACKS.esencial;
  const parte = rx.decision === 'partimos' && rx.recomendado !== 'no';
  const negocio = lead.empresa || 'tu negocio';
  const nombre = String(lead.nombre || '').split(' ')[0];
  const subject = parte ? `Tu cotización HORIZON · Pack ${pk.nm} para ${negocio}` : `Tu radiografía HORIZON · ${negocio}`;
  const mejoras = rx.mejoras || [];

  const text = [
    `Hola ${nombre}:`, '',
    rx.escape_mes ? `Con tus respuestas, a ${negocio} se le escapan cerca de ${clp(rx.escape_mes)} al mes (estimación a la baja, no una promesa).` : `Gracias por responder la radiografía de ${negocio}.`, '',
    'Tu plan de acción:', ...mejoras.map((m, i) => `${i + 1}. ${m}`), '',
    rx.recomendado === 'no' ? 'Por ahora no te recomiendo invertir en un sistema: con estos pasos ya puedes ordenar mucho.' :
      `Pack ${pk.nm}: ${clp(pk.impl)} de implementación (50% al firmar: ${clp(pk.impl / 2)}) y ${clp(pk.mes)} al mes desde el mes 2. Valores + boleta de honorarios.`,
    parte ? 'Próximos pasos: revisas la propuesta y el contrato, pagas el 50% desde tu portal y partimos con el kickoff en 48 horas.' : 'Cualquier duda, respóndeme este correo o escríbeme por WhatsApp al +56 9 7696 2659.',
    portal && parte ? `Propuesta: ${portal}/propuesta\nContrato: ${portal}/contrato\nTu portal de cliente: ${portal}` : '', '',
    'Benja · HORIZON', 'horizonweb.cl',
  ].filter(l => l !== null).join('\n');

  const fila = (k, v) => `<tr><td style="padding:6px 0;color:#5F5970">${k}</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#1A1626">${v}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#FFFBF6;font-family:Helvetica,Arial,sans-serif;color:#1A1626">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#1A1626;border-radius:16px 16px 0 0;padding:18px 22px;color:#fff;font-weight:800;letter-spacing:3px">HORIZON</div>
  <div style="background:#fff;border:1px solid #F0E7DC;border-top:0;border-radius:0 0 16px 16px;padding:22px">
    <p style="margin:0 0 6px;font-size:13px;color:#9C96AB;text-transform:uppercase;letter-spacing:1px">${parte ? 'Cotización' : 'Radiografía'} · ${h(negocio)}</p>
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2">Hola ${h(nombre)}, ${parte ? 'partimos.' : 'aquí está tu radiografía.'}</h1>
    ${rx.escape_mes ? `<div style="background:#34276E;color:#fff;border-radius:14px;padding:16px 18px;margin:0 0 18px"><div style="font-size:12px;color:#E4DDF5;text-transform:uppercase;letter-spacing:1px">Se te escapa hoy</div><div style="font-size:32px;font-weight:800">≈ ${clp(rx.escape_mes)} al mes</div><div style="font-size:12px;color:#CFC6E6">Estimación a la baja con tus respuestas. No es una promesa.</div></div>` : ''}
    <h2 style="font-size:17px;margin:0 0 8px">Tu plan de acción</h2>
    <ol style="margin:0 0 18px;padding-left:20px;font-size:14.5px;line-height:1.5">${mejoras.map(m => `<li style="margin:0 0 6px">${h(m)}</li>`).join('')}</ol>
    ${rx.recomendado === 'no' ? '<p style="font-size:14.5px">Por ahora no te recomiendo invertir en un sistema: con estos pasos ya puedes ordenar mucho. Cuando te escriban más, conversamos.</p>' : `
    <h2 style="font-size:17px;margin:0 0 8px">${parte ? 'Cotización' : 'Te recomiendo'}: Pack ${pk.nm}</h2>
    <ul style="margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.5">${pk.incluye.map(x => `<li>${h(x)}</li>`).join('')}</ul>
    <table style="width:100%;border-collapse:collapse;font-size:14.5px;border-top:1px solid #F0E7DC;margin:0 0 6px">
      ${fila('Implementación (pago único)', clp(pk.impl))}${fila('50% al firmar', clp(pk.impl / 2))}${fila('50% antes de la entrega', clp(pk.impl / 2))}${fila('Mensualidad desde el mes 2', clp(pk.mes) + ' / mes')}
    </table>
    <p style="font-size:12px;color:#9C96AB;margin:0 0 18px">Valores + boleta de honorarios. Mes a mes, sin permanencia. Propuesta válida por 15 días.</p>`}
    ${parte ? `<h2 style="font-size:17px;margin:0 0 8px">Próximos pasos</h2><ol style="margin:0 0 18px;padding-left:20px;font-size:14.5px;line-height:1.5"><li>Revisas la propuesta y el contrato (botones de abajo).</li><li>Pagas el 50% de inicio desde tu portal, con Mercado Pago.</li><li>Kickoff en 48 horas. El avance lo ves en tu portal.</li></ol>${portal ? `<p style="margin:0 0 10px;font-size:14.5px">Tus documentos, listos para revisar y guardar en PDF:</p><p style="margin:0 0 18px"><a href="${h(portal)}/propuesta" style="display:inline-block;background:#1A1626;color:#fff;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:12px;margin:0 8px 8px 0">Ver propuesta</a><a href="${h(portal)}/contrato" style="display:inline-block;background:#1A1626;color:#fff;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:12px;margin:0 8px 8px 0">Ver contrato</a><a href="${h(portal)}" style="display:inline-block;background:#F2690C;color:#fff;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:12px;margin:0 8px 8px 0">Ir a mi portal</a></p>` : ''}` : '<p style="font-size:14.5px;margin:0 0 18px">Cualquier duda, responde este correo o escríbeme por WhatsApp al +56 9 7696 2659.</p>'}
    <p style="font-size:14.5px;margin:0">Benja<br><span style="color:#9C96AB">HORIZON · Rancagua · horizonweb.cl</span></p>
  </div>
</div></body></html>`;
  return { subject, text, html };
}

// Lead existente (mismo correo): conserva su id y su portal, suma la radiografía y sube la etapa
// solo si avanza (nunca baja un lead que ya está en arranque, activo o cerrado).
async function actualizarLead(SB_URL, SB_KEY, lead) {
  const h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
  try {
    const g = await httpsRequest('GET', `${SB_URL}/rest/v1/leads?email=eq.${encodeURIComponent(lead.email)}&select=id,status,portal_token,hooks_respuestas,nota&limit=1`, h);
    const prev = (JSON.parse(g.body || '[]'))[0];
    if (!prev) return false;
    const ORDEN = ['new', 'contactado', 'propuesta', 'arranque', 'activo', 'cerrado'];
    const sube = ORDEN.indexOf(lead.status) > ORDEN.indexOf(prev.status);
    const patch = {
      nombre: lead.nombre, empresa: lead.empresa || undefined, telefono: lead.telefono || undefined,
      plan: lead.plan, origen: lead.origen, prioridad: lead.prioridad,
      nota: [prev.nota, lead.nota].filter(Boolean).join(' | ').slice(0, 2000),
      hooks_respuestas: { ...(prev.hooks_respuestas && typeof prev.hooks_respuestas === 'object' ? prev.hooks_respuestas : {}), radiografia: lead.hooks_respuestas.radiografia },
    };
    if (sube) patch.status = lead.status;
    if (!prev.portal_token) patch.portal_token = lead.portal_token; else lead.portal_token = prev.portal_token;
    lead.id = prev.id;
    const r = await httpsRequest('PATCH', `${SB_URL}/rest/v1/leads?id=eq.${prev.id}`, { ...h, Prefer: 'return=minimal' }, patch);
    if (r.status >= 300) { console.error('[leads] update error:', r.status, r.body); return false; }
    return true;
  } catch (e) {
    console.error('[leads] update error:', e.message);
    return false;
  }
}
