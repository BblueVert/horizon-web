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

// Persona y reglas de atención del agente de Qué Rolls / Mesa Cero (n8n wa-mesacero-v2, nodo "Armar consulta a la IA"),
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

// ── Capas del flujo Qué Rolls (n8n wa-mesacero-v2, v4): Reglas → IA (+reintento) → Verificar → Corregir → Respuesta final ──
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
// "Reglas": respuestas fijas sin IA.
function reglaFija(texto) {
  const n = norm(texto);
  if (!n) return ['Por ahora solo leo mensajes de texto 🙂 ¿Me lo escribes?'];
  if (/^\/?(reiniciar|empezar de nuevo|nueva conversacion|borrar conversacion)[.!]*$/.test(n)) return ['Listo, empecemos de nuevo 🙂 ¿Qué te gustaría pedir?'];
  if (/(no quiero (recibir )?(mas )?mensajes|no me escriban|^(stop|baja)[.!]*$)/.test(n)) return ['Listo, no te escribiremos más. Si algún día quieres pedir, aquí estamos.'];
  return null;
}
// "Verificar respuesta" + "Corregir respuesta": precios = carta o totales, sin links inventados,
// una sola pregunta por turno, sin voseo, sin "de los más vendidos", largo máximo.
const VOSEO = { 'querés': 'quieres', 'tenés': 'tienes', 'podés': 'puedes', 'sabés': 'sabes', 'decime': 'dime', 'mirá': 'mira', 'contame': 'cuéntame' };
const SIN_DATOS = /(de|una de|uno de) (los|las) (que )?m[aá]s (sale|salen|pedid|vendid)/i;
function preciosDe(ficha, historial, accion) {
  const base = [];
  for (const c of ficha.catalogo || []) for (const it of c.items || []) {
    if (Number.isFinite(it.precio)) base.push(it.precio);
    for (const v of it.variantes || []) if (Number.isFinite(v.precio)) base.push(v.precio);
  }
  const validos = new Set(base);
  // Totales: sumas de hasta 4 precios que ya aparecieron en la conversación (cantidades incluidas).
  const vistos = [...new Set(historial.map(m => m.content).join(' ').match(/\$\s?\d{1,3}(?:[.,]\d{3})+/g) || [])].map(s => Number(s.replace(/\D/g, ''))).filter(n => validos.has(n));
  const sumar = (i, acc, k) => { if (k > 4) return; for (let j = i; j < vistos.length; j++) for (let q = 1; q <= 3; q++) { const s = acc + vistos[j] * q; validos.add(s); sumar(j + 1, s, k + 1); } };
  sumar(0, 0, 1);
  for (const p of base) for (let q = 2; q <= 6; q++) validos.add(p * q);
  if (accion?.datos && Number.isFinite(Number(accion.datos.total))) validos.add(Number(accion.datos.total));
  return validos;
}
function verificarYCorregir(ficha, historial, out) {
  const validos = preciosDe(ficha, historial, out.accion);
  const l = (ficha.locales || [])[0];
  const mapa = l?.direccion ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([l.direccion, l.comuna, 'Chile'].filter(Boolean).join(', ')) : null;
  let chunks = (out.respuestas || []).map(s => String(s).replace(/(?<![\p{L}])(querés|tenés|podés|sabés|decime|mirá|contame)(?![\p{L}])/giu, m => { const r = VOSEO[m.toLowerCase()] || m; return m[0] === m[0].toUpperCase() ? r[0].toUpperCase() + r.slice(1) : r; }).trim()).filter(Boolean);
  const sinInventar = chunks.filter(s => !SIN_DATOS.test(s)); if (sinInventar.length) chunks = sinInventar;
  const fuera = new Set(), problemas = [];
  chunks = chunks.map((c, i) => {
    for (const m of c.matchAll(/\$\s?(\d{1,3}(?:[.,]\d{3})+|\d+)/g)) {
      if (!validos.has(Number(m[1].replace(/[.,]/g, '')))) { fuera.add(i); problemas.push('precio_inventado ' + m[0]); }
    }
    const limpio = c.replace(/https?:\/\/\S+/g, u => (u.replace(/[.,;:!?)]+$/, '') === mapa ? u : (problemas.push('link ' + u), ''))).replace(/[ \t]{2,}/g, ' ').trim();
    return limpio !== c && limpio.length < 15 ? '' : limpio;
  });
  const conPregunta = chunks.map((c, i) => (/\?\s*\S{0,3}$/.test(c) ? i : -1)).filter(i => i >= 0);
  if (conPregunta.length > 1) { conPregunta.slice(0, -1).forEach(i => fuera.add(i)); problemas.push('varias_preguntas'); }
  chunks = chunks.filter((c, i) => c && !fuera.has(i)).slice(0, 4);
  if (chunks.join('\n').length > 1500) chunks = chunks.slice(0, 3);
  if (!chunks.length) chunks = ['Déjame confirmarte bien ese dato 🙏 ¿Me cuentas qué te gustaría pedir?'];
  if (problemas.length) console.warn('demo-chat corrigió:', problemas.join(', '));
  return { ...out, respuestas: chunks };
}
// "Respuesta final": aviso fijo de alergias y no repetir una respuesta casi igual a la anterior.
function respuestaFinal(mensaje, historial, out) {
  const chunks = [...out.respuestas];
  if (/al[eé]rg|intoleran|cel[ií]ac/i.test(mensaje)) chunks.splice(Math.max(0, chunks.length - 1), 0, 'Ojo: esto es lo que lista la carta. Por tu alergia, confírmalo directo con Andrea antes de pedir 🙏');
  const palabras = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter(x => x.length > 2));
  const ultima = [...historial].reverse().find(m => m.role === 'assistant');
  let previa = ''; try { previa = (JSON.parse(ultima?.content || '{}').respuestas || []).join('\n\n'); } catch { previa = ultima?.content || ''; }
  const nueva = chunks.join('\n\n'), A = palabras(previa), B = palabras(nueva);
  const parecido = A.size && B.size ? [...B].filter(x => A.has(x)).length / new Set([...A, ...B]).size : 0;
  const cifras = (s) => [...new Set(String(s).match(/\d[\d.]*/g) || [])].sort().join();
  if (nueva.length > 120 && parecido >= 0.8 && cifras(previa) === cifras(nueva) && !out.accion && !/Total/.test(nueva)) {
    const pregunta = [...chunks].reverse().find(c => /\?\s*\S{0,3}$/.test(c));
    return { ...out, respuestas: ['Sí, es lo que te acabo de pasar 😊', ...(pregunta ? [pregunta.length > 200 ? '¿Me cuentas qué necesitas?' : pregunta] : [])] };
  }
  return { ...out, respuestas: chunks };
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
  const historial = (Array.isArray(body.historial) ? body.historial : [])
    .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }));

  try {
    const { construirPrompt, interpretar, extrasConfirmacion, avisoDueno } = await cargarAgente();
    const messages = [{ role: 'system', content: construirPrompt(ficha) + '\n\n' + personaWeb(ficha) }, ...historial, { role: 'user', content: mensaje + '\n\n(Responde solo el JSON.)' }];
    const fija = reglaFija(mensaje);
    if (fija) return res.status(200).json({ respuestas: fija, accion: null, extras: [], aviso: null });
    const esJSON = (raw) => { try { return Array.isArray(JSON.parse(String(raw || '').replace(/```json|```/g, '').trim()).respuestas); } catch { return false; } };
    let raw = await llamarIA(ficha, messages);
    // "Reintentar IA": si no vino un JSON con respuestas, una vez más con instrucción estricta.
    if (!esJSON(raw)) {
      const raw2 = await llamarIA(ficha, [...messages, { role: 'assistant', content: String(raw || '').slice(0, 800) }, { role: 'user', content: 'Tu respuesta anterior no era un JSON válido. Responde SOLO el JSON con el formato pedido, sin texto extra.' }]);
      if (esJSON(raw2) || !String(raw || '').trim()) raw = raw2;
    }
    let out = interpretar(raw);
    out = respuestaFinal(mensaje, historial, verificarYCorregir(ficha, historial, out));
    let extras = [], aviso = null;
    if (out.accion) {
      const r = extrasConfirmacion(ficha, out.accion, '');
      extras = r.mensajes;
      aviso = avisoDueno(ficha, r.accion, null);
      // Queda en el panel de demos de OPS (/ops/demos), igual que lo que llega por el bot de WhatsApp.
      const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (SB_URL && SB_KEY && ['pedido', 'reserva', 'consulta', 'derivar'].includes(r.accion.tipo)) {
        await httpsRequest('POST', `${SB_URL}/rest/v1/demo_acciones`,
          { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          { slug: ficha.slug, telefono: 'web', tipo: r.accion.tipo, resumen: String(r.accion.resumen || '').slice(0, 2000),
            datos: { ...(r.accion.datos || {}), codigo: r.accion.codigo || null } }).catch(e => console.error('demo-chat acción:', e.message));
      }
    }
    return res.status(200).json({ respuestas: out.respuestas, accion: out.accion, extras, aviso });
  } catch (e) {
    console.error('demo-chat:', e.message);
    return res.status(502).json({ error: 'El asistente no está disponible en este momento' });
  }
};
