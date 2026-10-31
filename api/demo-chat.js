'use strict';

// Chat web de las demos (el "WhatsApp" incrustado en las webs de demo, ej. /demo/cafe-boutique).
// Usa el mismo motor que el bot de WhatsApp (verticales/demos): la ficha va en el prompt y
// la IA pasa por el workflow n8n `demo-ia` (DEMO_IA_URL, o el host de N8N_WEBHOOK_URL).
// Sin n8n configurado, llama directo a DeepSeek (DEEPSEEK_API_KEY).
//
//   POST /api/demo-chat { slug, historial: [{ role: 'user'|'assistant', content }], mensaje }
//   → { respuestas: [], extras: [], aviso: string|null }
//   GET  /api/demo-chat?slug=cafe-boutique → carta y datos del local para la web

const { rateLimit, getIp } = require('./shared');

// Solo fichas publicadas a propósito como demo web.
const FICHAS = {
  'cafe-boutique': require('../verticales/demos/fichas/cafe-boutique.json'),
};

let agente;
async function cargarAgente() {
  if (!agente) agente = await import('../verticales/demos/src/agente.js');
  return agente;
}

async function llamarIA(ficha, messages) {
  // DEMO_IA_URL explícita, o el mismo n8n de los leads (N8N_WEBHOOK_URL) con el webhook demo-ia.
  let url = process.env.DEMO_IA_URL;
  if (!url && process.env.N8N_WEBHOOK_URL) {
    try { url = new URL('/webhook/demo-ia', process.env.N8N_WEBHOOK_URL).toString(); } catch { url = ''; }
  }
  if (url) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ficha.slug, messages }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`n8n demo-ia ${r.status}`);
    return (await r.json().catch(() => ({}))).content;
  }
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('sin motor configurado');
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.LLM_MODELO || 'deepseek-v4-flash', messages,
      thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, temperature: 0.4, max_tokens: 900,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`IA ${r.status}`);
  return (await r.json())?.choices?.[0]?.message?.content;
}

module.exports = async function handler(req, res) {
  // GET ?slug= → datos públicos de la ficha para pintar la web (carta, local, saludo).
  if (req.method === 'GET') {
    const f = FICHAS[String((req.query && req.query.slug) || '')];
    if (!f) return res.status(404).json({ error: 'Demo no encontrada' });
    const { nombre, saludo, color, catalogo, locales, reservas } = f;
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ nombre, saludo, color, catalogo, locales, reservas });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (rateLimit(getIp(req), 60_000, 20)) return res.status(429).json({ error: 'Vas muy rápido, espera un poco' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const ficha = FICHAS[String(body.slug || '')];
  if (!ficha) return res.status(404).json({ error: 'Demo no encontrada' });

  const mensaje = String(body.mensaje || '').trim().slice(0, 600);
  if (!mensaje) return res.status(400).json({ error: 'Mensaje vacío' });
  const historial = (Array.isArray(body.historial) ? body.historial : [])
    .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));

  try {
    const { construirPrompt, interpretar, extrasConfirmacion, avisoDueno } = await cargarAgente();
    const messages = [{ role: 'system', content: construirPrompt(ficha) }, ...historial, { role: 'user', content: mensaje }];
    const out = interpretar(await llamarIA(ficha, messages));
    let extras = [], aviso = null;
    if (out.accion) {
      const r = extrasConfirmacion(ficha, out.accion, '');
      extras = r.mensajes;
      aviso = avisoDueno(ficha, r.accion, null);
    }
    return res.status(200).json({ respuestas: out.respuestas, accion: out.accion, extras, aviso });
  } catch (e) {
    console.error('demo-chat:', e.message);
    return res.status(502).json({ error: 'El asistente no está disponible en este momento' });
  }
};
