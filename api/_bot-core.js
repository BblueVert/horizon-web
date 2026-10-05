'use strict';

// Núcleo del agente de mensajes: búsqueda en la base de conocimiento, prompt y decisión.
// Sin dependencias de red para poder probarlo aislado. El prefijo "_" evita que Vercel
// lo publique como función.

const UMBRAL_AUTO = 0.75; // confianza mínima para responder sin aprobación

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s/.-]/g, ' ').replace(/\s+/g, ' ').trim();
}
const STOP = new Set('a al como con de del el en es la las lo los me mi mis o para por que se si su sus te tu tus un una y yo hola buenas buenos dias tardes noches ola holi gracias porfa favor quiero queria saber tienen tiene hay cual cuales esto eso'.split(' '));
function tokens(s) { return norm(s).split(' ').filter(t => t.length > 2 && !STOP.has(t)); }

// Palabra clave exacta de los reels (CONTEXTO, FICHA…): respuesta directa sin IA.
function palabraClave(texto, items) {
  const t = norm(texto).replace(/[^a-z0-9ñ ]/g, '').trim();
  if (!t || t.split(' ').length > 3) return null;
  return items.find(i => i.tipo === 'palabra_clave' && i.activo !== false &&
    (i.keywords || []).some(k => t === norm(k) || t.split(' ').includes(norm(k)))) || null;
}

// Puntaje simple por coincidencia de palabras: keywords pesan más que variantes y título.
function buscar(texto, items, max = 6) {
  const t = norm(texto);
  const tt = new Set(tokens(texto));
  const scored = items.filter(i => i.activo !== false).map(i => {
    let s = 0;
    for (const k of i.keywords || []) { const nk = norm(k); if (nk && (` ${t} `).includes(` ${nk}`)) s += 3; }
    for (const v of [i.titulo, ...(i.variantes || [])]) {
      const vt = tokens(v);
      if (!vt.length) continue;
      const hit = vt.filter(x => tt.has(x)).length;
      s += hit ? 2 * hit / vt.length + hit * 0.5 : 0;
    }
    return { item: i, score: s };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, max);
}

function promptSistema(reglas) {
  return `Eres el asistente de HORIZON en Instagram y WhatsApp. HORIZON es el estudio de Benjamín, diseñador digital de Rancagua, que ayuda a negocios locales a crecer con web, sistemas e inteligencia artificial.

Cómo escribes:
- Español de Chile, tuteo (tú, nunca vos), cercano y directo, como en un DM. Máximo 70 palabras. Un emoji como mucho.
- Respondes SOLO con la información de la BASE que te entrego. No inventes precios, plazos, descuentos ni condiciones.
- Si la pregunta no está cubierta por la BASE, o la persona pide algo sensible (descuentos, cuotas especiales, reembolsos, quejas, temas legales), marca "derivar": true y escribe en "respuesta" el borrador que propondrías, para que Benjamín lo revise.
- Si la persona quiere hablar con un humano, marca "derivar": true.
- Cuando sea natural, termina con una pregunta que avance la conversación (qué negocio tiene, si quiere agendar el diagnóstico, etc.).
- No pidas RUT, datos bancarios ni contraseñas.
${reglas.length ? '\nReglas internas:\n' + reglas.map(r => '- ' + r.contenido).join('\n') : ''}

Devuelve SOLO un JSON con esta forma:
{"respuesta": string, "usa": [slugs de la BASE que usaste], "confianza": número 0 a 1, "derivar": boolean, "motivo": string corto,
 "lead": {"negocio": string|null, "rubro": string|null, "interes": "alto"|"medio"|"bajo"|"ninguno"}, "resumen": string (1 línea: quién es y qué busca)}`;
}

function promptUsuario({ texto, historial, candidatos, resumen, canal, nombre }) {
  return JSON.stringify({
    canal, nombre: nombre || null, lo_que_sabemos: resumen || null,
    historial: historial.map(m => ({ de: m.rol, texto: m.texto })),
    mensaje_nuevo: texto,
    BASE: candidatos.map(c => ({ slug: c.slug, tipo: c.tipo, titulo: c.titulo, contenido: c.contenido, link: c.link || undefined })),
  });
}

// Decide si se envía solo o queda como borrador.
function decidir(ia, candidatos) {
  const usados = candidatos.filter(c => (ia.usa || []).includes(c.slug));
  const noAuto = usados.some(c => c.auto === false);
  const conf = Number(ia.confianza) || 0;
  const auto = !ia.derivar && !noAuto && conf >= UMBRAL_AUTO && usados.length > 0;
  return { auto, usados, confianza: conf, motivo: ia.derivar ? (ia.motivo || 'derivado') : noAuto ? 'tema sensible' : conf < UMBRAL_AUTO ? 'baja confianza' : !usados.length ? 'sin respaldo en la base' : 'ok' };
}

// Sin IA disponible: responde solo si hay un match claro y automático.
function decidirSinIA(encontrados) {
  const top = encontrados[0];
  if (top && top.score >= 4 && top.item.auto !== false && top.item.tipo !== 'politica') {
    return { auto: true, texto: top.item.contenido, usados: [top.item], confianza: Math.min(1, top.score / 8), motivo: 'match directo' };
  }
  return { auto: false, texto: top ? top.item.contenido : '', usados: top ? [top.item] : [], confianza: 0, motivo: 'sin IA y sin match claro' };
}

const ESPERA = '¡Buena pregunta! Se la paso a Benjamín para darte la respuesta exacta y te escribe a la brevedad 🙌';

module.exports = { norm, tokens, palabraClave, buscar, promptSistema, promptUsuario, decidir, decidirSinIA, ESPERA, UMBRAL_AUTO };
