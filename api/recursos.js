'use strict';

// /api/recursos
//   GET                → lista de recursos (hub /recursos)
//   GET ?slug=ficha    → definición de un recurso (preguntas)
//   GET ?r=<token>     → resultado guardado (link permanente /recursos/r/<token>)
//   POST               → { slug, contacto, respuestas, consentimiento, origen, web }
//                        evalúa, agrega conclusión con IA, crea/actualiza el lead y guarda.

const https = require('https');
const { sanitize, sanitizeEmail, rateLimit, getIp, httpsRequest, uid } = require('./shared');
const { RECURSOS, evaluar, conclusionBase, txt } = require('./_recursos');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sbHeaders(key, extra = {}) {
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...extra };
}

// Teléfonos chilenos → +569XXXXXXXX. Otros formatos se guardan con sus dígitos.
function normTel(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (/^9\d{8}$/.test(d)) return '+56' + d;
  if (/^569\d{8}$/.test(d)) return '+' + d;
  return d.length >= 8 && d.length <= 15 ? '+' + d : '';
}

function definicionPublica(def) {
  return {
    slug: def.slug, kw: def.kw, titulo: def.titulo, bajada: def.bajada, tarea: def.tarea, minutos: def.minutos,
    campos: def.campos.map(c => ({
      id: c.id, tipo: c.tipo, label: c.label, ayuda: c.ayuda || '', req: !!c.req,
      opciones: c.opciones ? c.opciones.map(o => ({ v: o.v, l: o.l })) : undefined,
    })),
  };
}

// ── Conclusión con IA (DeepSeek, mismo proveedor que el Agente OPS) ──────────
// Solo viajan datos del negocio y el resultado: nunca nombre, teléfono ni email.
function conclusionIA(slug, ctx, def, resultado) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Promise.resolve(null);
  const system = `Eres el consultor de HORIZON, un estudio de Rancagua que ayuda a negocios locales a crecer con diseño, sistemas digitales e IA.
Escribes la conclusión de un recurso gratuito que el dueño de un negocio acaba de completar.
Reglas: español de Chile, tuteo (tú, nunca vos), cercano y directo. Máximo 90 palabras, un solo párrafo, sin listas, sin saludo ni firma.
Usa solo los datos entregados; no inventes cifras. Nombra el hallazgo más importante y termina con el primer paso concreto.
No vendas de forma agresiva: si hay un plan sugerido, menciónalo como opción, no como obligación.`;
  const user = JSON.stringify({
    recurso: def.titulo, negocio: ctx.negocio, rubro: ctx.rubro, comuna: ctx.comuna,
    puntaje: resultado.puntaje, nivel: resultado.nivel, titular: resultado.titular,
    prioridades: resultado.acciones, datos: resultado.datos,
    plan_sugerido: resultado.plan ? `${resultado.plan.codigo} · ${resultado.plan.nombre}` : null,
  });
  const payload = JSON.stringify({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', max_tokens: 300, temperature: 0.6,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST', timeout: 12_000,
      headers: { Authorization: 'Bearer ' + apiKey, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
    }, res => {
      let d = ''; res.on('data', c => (d += c));
      res.on('end', () => {
        try {
          const t = JSON.parse(d)?.choices?.[0]?.message?.content;
          resolve(res.statusCode === 200 && t ? txt(t, 900) : null);
        } catch { resolve(null); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.write(payload); req.end();
  });
}

// ── Lead: reutiliza por teléfono o email, si no existe lo crea ───────────────
async function upsertLead(SB, KEY, c, slug, row) {
  const filtros = [`telefono.eq.${c.telefono}`];
  if (c.email) filtros.push(`email.eq.${c.email}`);
  const q = `${SB}/rest/v1/leads?select=id,hooks_respuestas,historial,plan&or=(${encodeURIComponent(filtros.join(','))})&limit=1`;
  const found = await httpsRequest('GET', q, sbHeaders(KEY));
  const lead = found.status === 200 ? JSON.parse(found.body)[0] : null;
  const hook = { fecha: new Date().toISOString(), puntaje: row.puntaje, nivel: row.nivel, plan: row.plan_sugerido, token: row.token };
  const evento = { fecha: hook.fecha, tipo: 'recurso', texto: `Completó el recurso ${RECURSOS[slug].kw}${row.puntaje != null ? ` (${row.puntaje}/100)` : ''}` };

  if (lead) {
    const patch = {
      hooks_respuestas: { ...(lead.hooks_respuestas || {}), [slug]: hook },
      historial: [...(Array.isArray(lead.historial) ? lead.historial : []), evento].slice(-100),
    };
    if (!lead.plan && row.plan_sugerido) patch.plan = row.plan_sugerido;
    const r = await httpsRequest('PATCH', `${SB}/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}`, sbHeaders(KEY, { Prefer: 'return=minimal' }), patch);
    if (r.status >= 400) throw new Error('lead patch ' + r.status);
    return lead.id;
  }
  const nuevo = {
    id: uid(), nombre: c.nombre, empresa: c.negocio, email: c.email || null, telefono: c.telefono,
    sector: c.rubro, canal: 'recurso', origen: slug, plan: row.plan_sugerido || '',
    status: 'new', prioridad: 'Media', tipoprecio: 'fundador',
    nota: `Llegó por el recurso ${RECURSOS[slug].kw}${c.comuna ? ' · ' + c.comuna : ''}`,
    hooks_respuestas: { [slug]: hook }, historial: [evento],
  };
  const r = await httpsRequest('POST', `${SB}/rest/v1/leads`, sbHeaders(KEY, { Prefer: 'return=minimal' }), nuevo);
  if (r.status >= 400) throw new Error('lead insert ' + r.status);
  return nuevo.id;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://horizonweb.cl');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ip = getIp(req);

  if (req.method === 'GET') {
    if (rateLimit('rg:' + ip, 60_000, 60)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
    const q = req.query || {};
    if (q.r) {
      if (!UUID_RE.test(String(q.r))) return res.status(400).json({ error: 'Link inválido' });
      if (!SB || !KEY) return res.status(503).json({ error: 'No disponible' });
      const r = await httpsRequest('GET',
        `${SB}/rest/v1/resource_responses?select=recurso,negocio,resultado,created_at&token=eq.${q.r}&limit=1`, sbHeaders(KEY)).catch(() => null);
      const row = r && r.status === 200 ? JSON.parse(r.body)[0] : null;
      if (!row) return res.status(404).json({ error: 'No encontramos ese resultado' });
      return res.status(200).json({ ...row, definicion: RECURSOS[row.recurso] ? definicionPublica(RECURSOS[row.recurso]) : null });
    }
    if (q.slug) {
      const def = RECURSOS[String(q.slug)];
      return def ? res.status(200).json(definicionPublica(def)) : res.status(404).json({ error: 'Recurso no encontrado' });
    }
    return res.status(200).json(Object.values(RECURSOS).map(d => ({ slug: d.slug, kw: d.kw, titulo: d.titulo, bajada: d.bajada, tarea: d.tarea, minutos: d.minutos })));
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimit('rp:' + ip, 60_000, 6)) return res.status(429).json({ error: 'Demasiados envíos. Espera un minuto.' });

  const b = req.body || {};
  if (b.web) return res.status(200).json({ ok: true }); // honeypot: bots llenan el campo oculto

  const slug = String(b.slug || '');
  if (!RECURSOS[slug]) return res.status(404).json({ error: 'Recurso no encontrado' });
  if (b.consentimiento !== true) return res.status(400).json({ error: 'Necesitamos tu autorización para guardar tus respuestas.' });

  const c = b.contacto || {};
  const contacto = {
    nombre: sanitize(c.nombre, 80), negocio: sanitize(c.negocio, 120), rubro: sanitize(c.rubro, 80),
    comuna: sanitize(c.comuna, 60), telefono: normTel(c.whatsapp), email: c.email ? sanitizeEmail(c.email) : null,
  };
  if (!contacto.nombre || !contacto.negocio) return res.status(400).json({ error: 'Cuéntanos tu nombre y el de tu negocio.' });
  if (!contacto.telefono) return res.status(400).json({ error: 'Revisa tu WhatsApp (ej.: 9 1234 5678).' });
  if (c.email && !contacto.email) return res.status(400).json({ error: 'Revisa tu email.' });

  const ctx = { negocio: contacto.negocio, rubro: contacto.rubro, comuna: contacto.comuna };
  const ev = evaluar(slug, b.respuestas, ctx);
  if (ev.error) return res.status(400).json({ error: ev.error });
  const { respuestas, resultado } = ev;

  resultado.conclusion = (await conclusionIA(slug, ctx, RECURSOS[slug], resultado)) || conclusionBase(slug, ctx, resultado);

  const o = b.origen && typeof b.origen === 'object' ? b.origen : {};
  const origen = {};
  for (const k of ['kw', 'utm_source', 'utm_medium', 'utm_campaign', 'ref']) if (o[k]) origen[k] = sanitize(o[k], 120);

  const row = {
    id: uid(), token: uid(), recurso: slug, negocio: contacto.negocio, rubro: contacto.rubro, comuna: contacto.comuna,
    respuestas, resultado, puntaje: resultado.puntaje, nivel: resultado.nivel, plan_sugerido: resultado.plan_sugerido, origen,
  };

  let guardado = false;
  if (SB && KEY) {
    try {
      row.lead_id = await upsertLead(SB, KEY, contacto, slug, row);
      const r = await httpsRequest('POST', `${SB}/rest/v1/resource_responses`, sbHeaders(KEY, { Prefer: 'return=minimal' }), row);
      if (r.status >= 400) throw new Error('resource_responses ' + r.status + ' ' + r.body);
      guardado = true;
    } catch (err) {
      console.error('[recursos] error al guardar:', err.message);
    }
  }

  // El resultado se entrega igual aunque falle el guardado: el recurso tiene que servirle a quien lo llenó.
  return res.status(200).json({ ok: true, guardado, token: guardado ? row.token : null, recurso: slug, negocio: contacto.negocio, resultado });
};
