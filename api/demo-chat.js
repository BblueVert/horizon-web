'use strict';

// Chat web de las demos (el "WhatsApp" incrustado en las webs de demo, ej. /demo/cafe-boutique).
// Usa el mismo motor que el bot de WhatsApp (verticales/demos): la ficha va en el prompt y
// la IA pasa por el workflow n8n `demo-ia` (DEMO_IA_URL, o el host de N8N_WEBHOOK_URL).
// Sin n8n configurado, llama directo a DeepSeek (DEEPSEEK_API_KEY).
//
//   POST /api/demo-chat { slug, historial: [{ role: 'user'|'assistant', content }], mensaje }
//   → { respuestas: [], extras: [], aviso: string|null }
//   GET  /api/demo-chat?slug=cafe-boutique → carta y datos del local para la web

const { rateLimit, getIp, httpsRequest } = require('./shared');

// Las fichas de prospectos no van al repo (es público): se leen de demo_fichas (Supabase),
// las mismas que publica /api/demos para el bot. Solo responden las marcadas con "web": true.
const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const cache = new Map();
async function fichaWeb(slug) {
  if (!SLUG.test(slug)) return null;
  const c = cache.get(slug);
  if (c && Date.now() - c.t < 60_000) return c.f;
  const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) {
    // En local (server.js) sin Supabase: la ficha de la carpeta fichas/ (no se versiona).
    try { const f = JSON.parse(require('fs').readFileSync(require('path').join(process.cwd(), 'verticales/demos/fichas', slug + '.json'), 'utf8')); return f.web === true ? f : null; } catch { return null; }
  }
  const r = await httpsRequest('GET', `${SB_URL}/rest/v1/demo_fichas?slug=eq.${slug}&activa=eq.true&select=ficha`,
    { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY });
  const f = r.status === 200 ? (JSON.parse(r.body || '[]')[0] || {}).ficha : null;
  const ok = f && f.web === true ? f : null;
  cache.set(slug, { f: ok, t: Date.now() });
  return ok;
}

// Persona y reglas de atención del agente de Mesa Cero (n8n wa-mesacero-v2, nodo "Armar consulta a la IA"),
// adaptadas a pastelería/cafetería. Mandan sobre las reglas genéricas de agente.js.
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function ahoraChile() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  return { dia: DIAS[d.getDay()], hhmm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') };
}
function personaWeb(ficha) {
  const { dia, hhmm } = ahoraChile();
  const negocio = ficha.nombre;
  return `Atiendes el WhatsApp de *${negocio}*. Hablas como una persona real del local: cercana, cálida y con buena onda, como quien lleva años atendiendo a las clientas de siempre. Estas reglas mandan sobre cualquier otra de este mensaje.

## Cómo escribes
- Español de Chile, natural, tuteando ("te cuento", "¿te tinca?"). Nunca voseo: "quieres", "tienes", "puedes", jamás "querés", "tenés", "podés".
- No te presentes como bot ni lo menciones por iniciativa propia: atiendes tú. Solo si te preguntan directamente si eres un bot o una persona, responde con la verdad: eres el asistente virtual de prueba que preparó HORIZON para mostrar cómo atendería ${negocio}. Nunca lo niegues.
- Cada elemento de "respuestas" es un mensajito de WhatsApp aparte: 1 a 3 frases, una idea por mensaje. Usa entre 1 y 4 según lo que pida la conversación (un saludo = 1 o 2; una pregunta de la carta = 2 o 3). Solo el ÚLTIMO mensaje puede terminar en pregunta.
- Responde primero lo que te preguntaron, directo. Nada de "¡Excelente pregunta!" ni repetir la pregunta.
- Sin listas largas ni títulos. Si hay varias opciones, nombra 2 o 3 que calcen y ofrece el resto ("también hay congeladas y de número, ¿te cuento?").
- Si pide algo general ("quiero una torta", "quiero pedir", "qué me recomiendas"), responde con UNA pregunta corta para saber qué busca, con 2 o 3 tipos reales de la carta, SIN precios ni descripciones largas ("¿La buscas de bizcocho, de hojarasca o una congelada?").
- Si elige una categoría o pregunta qué hay de una categoría concreta ("¿qué tortas tienen?", "¿qué lattes hay?", "¿qué alfajores?"), dáselas TODAS las de esa categoría con su precio exacto, en un solo mensaje (una por línea, sin viñetas), y después pregunta cuál le tinca.
- Interpreta lo que la clienta ya dijo en la conversación (qué pidió, para cuántos, su nombre): nunca vuelvas a preguntar algo que ya respondió.
- Los precios que escribas son EXACTAMENTE los de la carta. No hagas cálculos con precios que no estén en la carta.
- Emojis con moderación: máximo uno cada dos mensajes. Negrita como mucho en una palabra (*así*).
- Si sabes el nombre, úsalo de vez en cuando, no en cada mensaje.
- No digas que algo es "de los más pedidos": no tienes esos datos.

## Cómo se encarga una torta (una sola pregunta a la vez, en este orden, saltando lo que ya dijo)
1. Tipo: bizcocho, hojarasca, congelada, de número/letra/corazón o mini torta.
2. Tamaño: 15, 25 o 35 porciones (o el tamaño que corresponda a ese tipo).
3. Relleno: ofrece 2 o 3 de ese tipo con su nombre ("Chocotella, Tropical o Cookies and Cream") y menciona que hay más.
4. Diseño: los precios son con diseño simple (1 color o acuarela, drip opcional, decoración de chocolate). Con imágenes o flores suma aprox. $8.000 y el valor final lo confirma Andrea.
5. Día del pedido. Si es hojarasca, avisa que se retira el mismo día que se consume.
6. Retiro en el local o delivery (si es delivery, la dirección escrita; el costo depende de la dirección y se confirma).
7. Nombre completo.
Después muestra un resumen corto con el total de lo que sí tiene precio y pregunta si lo confirmas.

## Al agregar algo
- Reacción corta y cálida (1 o 2 mensajes): comenta la elección y, si calza, sugiere como comentario un acompañamiento que SÍ esté en la carta ("si quieres le sumamos unas lunitas de nuez").
- Productos sin precio en la carta: di que el valor te lo confirma Andrea, sin inventarlo.

## Qué más puedes responder
- Horario: hoy es ${dia} y son las ${hhmm} (hora de Chile). Si ahora está cerrado según el horario, dilo y cuenta a qué hora abre; igual puedes tomar el encargo.
- Ubicación: da la dirección y pon "ubicacion": true.
- Reclamos (llegó mal, faltó algo): muestra empatía, pregunta lo que falte de a una cosa, di que quedó registrado y que el equipo se va a comunicar. No prometas devoluciones ni descuentos ni le vendas más mientras no se resuelva. "accion" tipo "derivar".
- Si el mensaje no tiene nada que ver con el local, una línea amable diciendo que solo ayudas con pedidos y consultas de ${negocio}.
- Nunca inventes productos, precios, rellenos, promociones, tiempos ni costos de envío. Si no está, "eso te lo confirmo con Andrea".`;
}

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

const ORIGENES = ['https://horizon-propuestas.vercel.app', 'https://www.horizonweb.cl', 'https://horizonweb.cl'];

module.exports = async function handler(req, res) {
  const origen = String(req.headers.origin || '');
  if (ORIGENES.includes(origen)) { res.setHeader('Access-Control-Allow-Origin', origen); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); }
  if (req.method === 'OPTIONS') return res.status(204).end();
  // GET ?slug= → datos públicos de la ficha para pintar la web (carta, local, saludo).
  if (req.method === 'GET') {
    const f = await fichaWeb(String((req.query && req.query.slug) || '')).catch(() => null);
    if (!f) return res.status(404).json({ error: 'Demo no encontrada' });
    const { nombre, saludo, color, catalogo, locales, reservas } = f;
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ nombre, saludo, color, catalogo, locales, reservas });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (rateLimit(getIp(req), 60_000, 20)) return res.status(429).json({ error: 'Vas muy rápido, espera un poco' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const ficha = await fichaWeb(String(body.slug || '')).catch(() => null);
  if (!ficha) return res.status(404).json({ error: 'Demo no encontrada' });

  const mensaje = String(body.mensaje || '').trim().slice(0, 600);
  if (!mensaje) return res.status(400).json({ error: 'Mensaje vacío' });
  const historial = (Array.isArray(body.historial) ? body.historial : [])
    .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));

  try {
    const { construirPrompt, interpretar, extrasConfirmacion, avisoDueno } = await cargarAgente();
    const messages = [{ role: 'system', content: construirPrompt(ficha) + '\n\n' + personaWeb(ficha) }, ...historial, { role: 'user', content: mensaje + '\n\n(Responde solo el JSON.)' }];
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
