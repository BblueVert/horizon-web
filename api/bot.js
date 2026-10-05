'use strict';

// /api/bot/<accion> — cerebro del agente de mensajes (Instagram + WhatsApp)
//
// Desde n8n (Authorization: Bearer HORIZON_BOT_SECRET):
//   POST mensaje       { canal, contacto_id, nombre?, texto, mensaje_id? }
//                      → { accion: 'responder'|'espera'|'silencio'|'duplicado', texto?, notificar? }
//   GET  seguimientos  → { items: [{ canal, contacto_id, texto }] }  (dentro de la ventana de 24 h)
//
// Desde OPS (sesión de admin):
//   POST aprobar       { message_id, texto, guardar?: { titulo, tipo, categoria } }  → envía vía n8n
//   POST descartar     { message_id }
//   POST estado        { conversation_id, estado: 'bot'|'humano'|'cerrada' }
//   POST enviar        { conversation_id, texto }  → mensaje manual de Benjamín

const https = require('https');
const crypto = require('crypto');
const { httpsRequest, rateLimit, getIp, uid, opsAuth } = require('./shared');
const core = require('./_bot-core');

const SB = () => process.env.SUPABASE_URL;
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = (extra = {}) => ({ apikey: KEY(), Authorization: 'Bearer ' + KEY(), 'Content-Type': 'application/json', ...extra });

async function sb(method, path, body, extra) {
  const r = await httpsRequest(method, `${SB()}/rest/v1/${path}`, H(extra), body);
  if (r.status >= 400) throw new Error(`${method} ${path.split('?')[0]} ${r.status} ${r.body.slice(0, 200)}`);
  return r.body ? JSON.parse(r.body) : null;
}
const one = rows => (Array.isArray(rows) ? rows[0] : rows) || null;

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function botAuth(req) {
  const s = process.env.HORIZON_BOT_SECRET;
  const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return !!s && !!t && safeEqual(s, t);
}
const limpio = (v, n = 2000) => String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n);

// ── IA (mismo proveedor que el Agente OPS) ───────────────────────────────────
function deepseek(system, user) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return Promise.resolve(null);
  const payload = JSON.stringify({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', max_tokens: 500, temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  return new Promise(resolve => {
    const req = https.request({
      hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST', timeout: 20_000,
      headers: { Authorization: 'Bearer ' + apiKey, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
    }, res => {
      let d = ''; res.on('data', c => (d += c));
      res.on('end', () => {
        try { resolve(res.statusCode === 200 ? JSON.parse(JSON.parse(d).choices[0].message.content) : null); }
        catch { resolve(null); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.write(payload); req.end();
  });
}

// ── Envío por n8n (lo usa OPS: aprobar / enviar) ─────────────────────────────
async function enviarPorN8n(canal, contacto_id, texto) {
  const url = process.env.N8N_SEND_URL;
  if (!url) throw new Error('Falta N8N_SEND_URL');
  const r = await httpsRequest('POST', url, { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.HORIZON_BOT_SECRET },
    { canal, contacto_id, texto }, 15_000);
  if (r.status >= 400) throw new Error('n8n respondió ' + r.status);
}

// ── Lead ────────────────────────────────────────────────────────────────────
async function asegurarLead(conv, canal, contacto_id, nombre, lead) {
  if (conv.lead_id) return conv.lead_id;
  const interesa = lead && ['alto', 'medio'].includes(lead.interes);
  if (canal === 'instagram' && !interesa) return null; // en Instagram solo se crea lead si hay interés
  if (canal === 'whatsapp') {
    const tel = '+' + String(contacto_id).replace(/\D/g, '');
    const ex = one(await sb('GET', `leads?select=id&telefono=eq.${encodeURIComponent(tel)}&limit=1`));
    if (ex) return ex.id;
  }
  const id = uid();
  await sb('POST', 'leads', {
    id, nombre: nombre || (canal === 'instagram' ? 'Instagram ' + contacto_id.slice(-4) : null),
    empresa: lead?.negocio || null, sector: lead?.rubro || null,
    telefono: canal === 'whatsapp' ? '+' + String(contacto_id).replace(/\D/g, '') : null,
    canal, origen: 'agente', status: 'new', prioridad: lead?.interes === 'alto' ? 'Alta' : 'Media', tipoprecio: 'fundador',
    nota: `Llegó por ${canal === 'instagram' ? 'Instagram DM' : 'WhatsApp'} (agente)`, historial: [], hooks_respuestas: {},
  }, { Prefer: 'return=minimal' });
  return id;
}

// ── POST mensaje ────────────────────────────────────────────────────────────
async function mensaje(req, res) {
  const b = req.body || {};
  const canal = ['instagram', 'whatsapp'].includes(b.canal) ? b.canal : null;
  const contacto_id = limpio(b.contacto_id, 64);
  const texto = limpio(b.texto, 2000);
  const nombre = limpio(b.nombre, 80) || null;
  const mensaje_id = limpio(b.mensaje_id, 128) || null;
  if (!canal || !contacto_id || !texto) return res.status(400).json({ error: 'canal, contacto_id y texto son obligatorios' });

  const ahora = new Date().toISOString();
  let conv = one(await sb('GET', `agent_conversations?select=*&canal=eq.${canal}&contacto_id=eq.${encodeURIComponent(contacto_id)}&limit=1`));
  if (!conv) {
    try {
      conv = one(await sb('POST', 'agent_conversations', { canal, contacto_id, nombre }, { Prefer: 'return=representation' }));
    } catch (e) {
      if (!/23505|duplicate/i.test(e.message)) throw e; // otro mensaje la creó al mismo tiempo
      conv = one(await sb('GET', `agent_conversations?select=*&canal=eq.${canal}&contacto_id=eq.${encodeURIComponent(contacto_id)}&limit=1`));
    }
  }

  // Guardar el mensaje del cliente (si Meta lo reintenta, el índice único lo frena)
  try {
    await sb('POST', 'agent_messages', { conversation_id: conv.id, rol: 'cliente', texto, mensaje_id }, { Prefer: 'return=minimal' });
  } catch (e) {
    if (/23505|duplicate/i.test(e.message)) return res.status(200).json({ accion: 'duplicado' });
    throw e;
  }
  await sb('PATCH', `agent_conversations?id=eq.${conv.id}`, {
    ultimo_cliente_at: ahora, seguimiento_paso: 0, proximo_seguimiento: null, ...(nombre && !conv.nombre ? { nombre } : {}),
  }, { Prefer: 'return=minimal' });

  if (conv.estado !== 'bot') return res.status(200).json({ accion: 'silencio', motivo: 'conversación en manos de ' + conv.estado });

  const kb = await sb('GET', 'kb_items?select=id,slug,tipo,titulo,contenido,variantes,keywords,link,auto,activo&activo=eq.true');

  // 1) Palabra clave de los reels → respuesta directa
  const kw = core.palabraClave(texto, kb);
  let decision, ia = null;
  if (kw) {
    decision = { auto: true, texto: kw.contenido, usados: [kw], confianza: 1, motivo: 'palabra clave' };
    ia = { lead: { interes: 'medio' } };
  } else {
    // 2) Búsqueda + IA
    const encontrados = core.buscar(texto, kb, 6);
    const candidatos = encontrados.map(e => e.item);
    const historial = (await sb('GET', `agent_messages?select=rol,texto&conversation_id=eq.${conv.id}&estado=eq.enviado&order=created_at.desc&limit=9`)).reverse().slice(0, -1);
    const reglas = kb.filter(i => i.tipo === 'politica' && i.slug.startsWith('pol-'));
    ia = await deepseek(core.promptSistema(reglas), core.promptUsuario({ texto, historial, candidatos, resumen: conv.resumen, canal, nombre: conv.nombre || nombre }));
    if (ia && ia.respuesta) {
      const d = core.decidir(ia, candidatos);
      decision = { ...d, texto: limpio(ia.respuesta, 1000) };
    } else {
      decision = core.decidirSinIA(encontrados);
    }
  }

  const pideHumano = decision.usados.some(u => u.slug === 'humano');
  const kb_ids = decision.usados.map(u => u.id);

  // Lead y resumen
  let lead_id = conv.lead_id;
  try { lead_id = await asegurarLead(conv, canal, contacto_id, conv.nombre || nombre, ia && ia.lead); } catch (e) { console.error('[bot] lead:', e.message); }
  const interes = ia && ia.lead && ia.lead.interes;
  const patchConv = { ultimo_agente_at: ahora, ...(lead_id ? { lead_id } : {}), ...(ia && ia.resumen ? { resumen: limpio(ia.resumen, 400) } : {}) };

  if (decision.auto && !pideHumano) {
    await sb('POST', 'agent_messages', { conversation_id: conv.id, rol: 'agente', texto: decision.texto, accion: 'auto', confianza: decision.confianza, kb_ids }, { Prefer: 'return=minimal' });
    if (kb_ids.length) await sb('POST', 'rpc/kb_sumar_usos', { ids: kb_ids }).catch(() => {});
    // Un seguimiento automático dentro de la ventana de 24 h si hay interés y no vuelve a escribir
    if (['alto', 'medio'].includes(interes)) Object.assign(patchConv, { proximo_seguimiento: new Date(Date.now() + 20 * 3600e3).toISOString() });
    await sb('PATCH', `agent_conversations?id=eq.${conv.id}`, patchConv, { Prefer: 'return=minimal' });
    return res.status(200).json({ accion: 'responder', texto: decision.texto, confianza: decision.confianza });
  }

  // Borrador para Benjamín + lo anota como "por aprender"
  await sb('POST', 'agent_messages', { conversation_id: conv.id, rol: 'agente', texto: decision.texto || '(sin borrador)', accion: pideHumano ? 'escalado' : 'borrador', estado: 'borrador', confianza: decision.confianza, kb_ids }, { Prefer: 'return=minimal' });
  if (pideHumano) patchConv.estado = 'humano'; // el bot se calla hasta que Benjamín la devuelva
  if (!pideHumano) await sb('POST', 'kb_pendientes', { pregunta: texto, borrador: decision.texto || null, conversation_id: conv.id }, { Prefer: 'return=minimal' });

  // Mensaje de espera, máximo uno cada 6 h por conversación
  const ult = one(await sb('GET', `agent_messages?select=created_at&conversation_id=eq.${conv.id}&accion=eq.espera&order=created_at.desc&limit=1`));
  const mandarEspera = !ult || Date.now() - new Date(ult.created_at) > 6 * 3600e3;
  const espera = pideHumano ? decision.texto : core.ESPERA;
  if (mandarEspera) await sb('POST', 'agent_messages', { conversation_id: conv.id, rol: 'agente', texto: espera, accion: 'espera' }, { Prefer: 'return=minimal' });
  await sb('PATCH', `agent_conversations?id=eq.${conv.id}`, patchConv, { Prefer: 'return=minimal' });

  return res.status(200).json({
    accion: mandarEspera ? 'espera' : 'silencio', texto: mandarEspera ? espera : undefined,
    notificar: { canal, nombre: conv.nombre || nombre || contacto_id, pregunta: texto, borrador: decision.texto, motivo: decision.motivo, ops: 'https://horizonweb.cl/ops/bandeja' },
  });
}

// ── GET seguimientos ─────────────────────────────────────────────────────────
async function seguimientos(req, res) {
  const ahora = new Date();
  const desde = new Date(ahora - 23 * 3600e3).toISOString(); // ventana de Meta: 24 h desde el último mensaje del cliente
  const rows = await sb('GET', `agent_conversations?select=id,canal,contacto_id,nombre,resumen&estado=eq.bot&seguimiento_paso=eq.0&proximo_seguimiento=lte.${ahora.toISOString()}&ultimo_cliente_at=gte.${desde}&limit=20`);
  const items = [];
  for (const c of rows) {
    let texto = `¡Hola${c.nombre ? ' ' + c.nombre.split(' ')[0] : ''}! ¿Pudiste revisar lo que te mandé? Si quieres, te ayudo a ver qué te conviene para tu negocio 🙌`;
    const ia = await deepseek(
      'Escribes un seguimiento breve por DM para HORIZON (Rancagua). Español de Chile, tuteo, cálido, sin presionar, máximo 30 palabras, sin inventar precios. Devuelve JSON {"texto": string}.',
      JSON.stringify({ lo_que_sabemos: c.resumen, nombre: c.nombre }));
    if (ia && ia.texto) texto = limpio(ia.texto, 400);
    await sb('POST', 'agent_messages', { conversation_id: c.id, rol: 'agente', texto, accion: 'seguimiento' }, { Prefer: 'return=minimal' });
    await sb('PATCH', `agent_conversations?id=eq.${c.id}`, { seguimiento_paso: 1, proximo_seguimiento: null, ultimo_agente_at: ahora.toISOString() }, { Prefer: 'return=minimal' });
    items.push({ canal: c.canal, contacto_id: c.contacto_id, texto });
  }
  return res.status(200).json({ items });
}

// ── OPS ─────────────────────────────────────────────────────────────────────
function slugify(s) {
  return core.norm(s).replace(/[^a-z0-9 ]/g, '').trim().split(' ').slice(0, 6).join('-') + '-' + crypto.randomBytes(2).toString('hex');
}

async function aprobar(req, res) {
  const b = req.body || {};
  const msg = one(await sb('GET', `agent_messages?select=id,conversation_id,estado&id=eq.${encodeURIComponent(b.message_id)}&limit=1`));
  if (!msg || msg.estado !== 'borrador') return res.status(404).json({ error: 'Borrador no encontrado' });
  const texto = limpio(b.texto, 1000);
  if (!texto) return res.status(400).json({ error: 'Texto vacío' });
  const conv = one(await sb('GET', `agent_conversations?select=id,canal,contacto_id,ultimo_cliente_at&id=eq.${msg.conversation_id}`));
  if (Date.now() - new Date(conv.ultimo_cliente_at) > 24 * 3600e3) return res.status(409).json({ error: 'Pasaron más de 24 h desde su último mensaje: Meta no permite responder automáticamente. Escríbele desde la app.' });
  await enviarPorN8n(conv.canal, conv.contacto_id, texto);
  await sb('PATCH', `agent_messages?id=eq.${msg.id}`, { texto, estado: 'enviado', rol: 'humano' }, { Prefer: 'return=minimal' });
  await sb('PATCH', `agent_conversations?id=eq.${conv.id}`, { ultimo_agente_at: new Date().toISOString() }, { Prefer: 'return=minimal' });

  let kb_item_id = null;
  const g = b.guardar;
  if (g && g.titulo) {
    const tipo = ['glosario', 'respuesta', 'objecion', 'politica'].includes(g.tipo) ? g.tipo : 'respuesta';
    const pend = one(await sb('GET', `kb_pendientes?select=id,pregunta&conversation_id=eq.${conv.id}&estado=eq.pendiente&order=created_at.desc&limit=1`));
    const item = one(await sb('POST', 'kb_items', {
      slug: slugify(g.titulo), tipo, categoria: limpio(g.categoria, 40) || 'aprendido', titulo: limpio(g.titulo, 200),
      contenido: texto, variantes: pend ? [limpio(pend.pregunta, 300)] : [], keywords: [], auto: g.auto !== false,
    }, { Prefer: 'return=representation' }));
    kb_item_id = item && item.id;
    if (pend) await sb('PATCH', `kb_pendientes?id=eq.${pend.id}`, { estado: 'resuelta', kb_item_id }, { Prefer: 'return=minimal' });
  }
  return res.status(200).json({ ok: true, kb_item_id });
}

async function descartar(req, res) {
  const id = encodeURIComponent((req.body || {}).message_id || '');
  await sb('PATCH', `agent_messages?id=eq.${id}&estado=eq.borrador`, { estado: 'descartado' }, { Prefer: 'return=minimal' });
  return res.status(200).json({ ok: true });
}

async function estado(req, res) {
  const b = req.body || {};
  if (!['bot', 'humano', 'cerrada'].includes(b.estado)) return res.status(400).json({ error: 'Estado inválido' });
  await sb('PATCH', `agent_conversations?id=eq.${encodeURIComponent(b.conversation_id)}`, { estado: b.estado, ...(b.estado !== 'bot' ? { proximo_seguimiento: null } : {}) }, { Prefer: 'return=minimal' });
  return res.status(200).json({ ok: true });
}

async function enviar(req, res) {
  const b = req.body || {};
  const texto = limpio(b.texto, 1000);
  const conv = one(await sb('GET', `agent_conversations?select=id,canal,contacto_id,ultimo_cliente_at&id=eq.${encodeURIComponent(b.conversation_id)}`));
  if (!conv || !texto) return res.status(400).json({ error: 'Datos incompletos' });
  if (Date.now() - new Date(conv.ultimo_cliente_at) > 24 * 3600e3) return res.status(409).json({ error: 'Pasaron más de 24 h desde su último mensaje. Escríbele desde la app de Instagram o WhatsApp.' });
  await enviarPorN8n(conv.canal, conv.contacto_id, texto);
  await sb('POST', 'agent_messages', { conversation_id: conv.id, rol: 'humano', texto, accion: 'manual' }, { Prefer: 'return=minimal' });
  await sb('PATCH', `agent_conversations?id=eq.${conv.id}`, { ultimo_agente_at: new Date().toISOString() }, { Prefer: 'return=minimal' });
  return res.status(200).json({ ok: true });
}

const N8N = { mensaje: ['POST', mensaje], seguimientos: ['GET', seguimientos] };
const OPS = { aprobar, descartar, estado, enviar };

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB() || !KEY()) return res.status(503).json({ error: 'Supabase no configurado' });
  const accion = String((req.query || {}).accion || '');
  try {
    if (N8N[accion]) {
      if (!botAuth(req)) return res.status(401).json({ error: 'No autorizado' });
      if (req.method !== N8N[accion][0]) return res.status(405).end();
      return await N8N[accion][1](req, res);
    }
    if (OPS[accion]) {
      if (req.method !== 'POST') return res.status(405).end();
      if (rateLimit('bot:' + getIp(req), 60_000, 60)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
      if (!await opsAuth(req)) return res.status(401).json({ error: 'No autorizado' });
      return await OPS[accion](req, res);
    }
    return res.status(404).json({ error: 'Acción desconocida' });
  } catch (e) {
    console.error('[bot]', accion, e.message);
    return res.status(500).json({ error: e.message.startsWith('Falta') ? e.message : 'Error interno' });
  }
};
