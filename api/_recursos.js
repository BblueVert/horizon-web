'use strict';

// Recursos interactivos de /recursos — definición + evaluación.
// Fuente única: la página pública pide las definiciones a /api/recursos y el
// resultado se calcula acá (el cliente nunca decide su propio puntaje).
// El prefijo "_" evita que Vercel lo publique como función.

const PLAN_INFO = {
  plan01: { codigo: 'Plan 01', nombre: 'Presencia Digital',       url: '/plan-01', precio: '$490.000' },
  plan02: { codigo: 'Plan 02', nombre: 'Ecosistema Digital',      url: '/plan-02', precio: '$990.000' },
  plan04: { codigo: 'Plan 03', nombre: 'Sistema con IA',          url: '/plan-03', precio: '$1.990.000' },
  plan05: { codigo: 'Plan 04', nombre: 'Agente IA Personalizado', url: '/plan-04', precio: 'desde $1.490.000' },
};

const RECURSOS = {
  contexto: {
    slug: 'contexto', kw: 'CONTEXTO', tarea: 'Tarea 01', minutos: 5,
    titulo: 'Ficha de contexto para tu IA',
    bajada: 'Responde 9 preguntas y te entrego el texto listo para pegar en ChatGPT, Claude o Gemini. Desde ahí, todo lo que le pidas parte sabiendo quién eres.',
    campos: [
      { id: 'c1', tipo: 'area', label: 'Nombre y rubro', ayuda: 'Ej.: Panadería Ejemplo, panadería de barrio con pan de masa madre.', req: true },
      { id: 'c2', tipo: 'area', label: 'Ubicación y cómo llegar', ayuda: 'Calle, comuna y una referencia: “frente a la plaza”.', req: true },
      { id: 'c3', tipo: 'area', label: 'Horario', ayuda: 'Incluye domingos y feriados.', req: true },
      { id: 'c4', tipo: 'area', label: 'Qué vendes y a qué precio', ayuda: 'Tus productos estrella y un rango de precios.', req: true },
      { id: 'c5', tipo: 'area', label: 'Lo que te diferencia', ayuda: 'Algo concreto. No “buena atención”: eso lo dicen todos.' },
      { id: 'c6', tipo: 'area', label: 'Tu cliente típico', ayuda: 'Quién te compra y cuándo.' },
      { id: 'c7', tipo: 'area', label: 'Las 5 preguntas que más te hacen', ayuda: 'Las que respondes todos los días. Una por línea.' },
      { id: 'c8', tipo: 'opcion', label: 'Cómo hablas con tus clientes', opciones: [
        { v: 'cercano_emoji', l: 'Cercano, con emojis' }, { v: 'cercano', l: 'Cercano, sin emojis' }, { v: 'formal', l: 'Formal' } ] },
      { id: 'c9', tipo: 'area', label: 'Lo que tu IA nunca debe decir ni prometer', ayuda: 'Ej.: “no confirmes precios de pedidos especiales”.' },
    ],
  },
  prompts: {
    slug: 'prompts', kw: 'PROMPTS', tarea: 'Tarea 02', minutos: 3,
    titulo: '3 prompts para tu negocio',
    bajada: 'Cuéntame cómo hablas y qué te preguntan. Te devuelvo los 3 prompts del carrusel adaptados a tu negocio, listos para copiar.',
    campos: [
      { id: 'tono', tipo: 'opcion', label: '¿Cómo le hablas a tus clientes?', req: true, opciones: [
        { v: 'cercano_emoji', l: 'Cercano, con emojis' }, { v: 'cercano', l: 'Cercano, sin emojis' }, { v: 'formal', l: 'Formal' } ] },
      { id: 'diferencia', tipo: 'texto', label: '¿Qué te diferencia? (en una frase)', ayuda: 'Ej.: pan de masa madre horneado cada mañana.' },
      { id: 'faq', tipo: 'area', label: 'Tus 5 preguntas más frecuentes', ayuda: 'Una por línea.', req: true },
      { id: 'resena', tipo: 'area', label: 'Pega una reseña real que quieras responder (opcional)', ayuda: 'Puede ser buena o mala. Si la pegas, el prompt queda listo con ella.' },
    ],
  },
  ficha: {
    slug: 'ficha', kw: 'FICHA', tarea: 'Tarea 03', minutos: 2,
    titulo: 'Tu ficha de Google en 9 puntos',
    bajada: 'Marca lo que ya tienes en tu ficha de Google. Te digo en qué nivel estás y qué arreglar primero, en orden.',
    campos: [
      { id: 'g1', tipo: 'check', label: 'Nombre exacto del negocio' },
      { id: 'g2', tipo: 'check', label: 'Categoría correcta' },
      { id: 'g3', tipo: 'check', label: 'Dirección y teléfono iguales que en Instagram' },
      { id: 'g4', tipo: 'check', label: 'Horario + feriados' },
      { id: 'g5', tipo: 'check', label: 'Descripción clara (hasta 750 caracteres)' },
      { id: 'g6', tipo: 'check', label: '10 o más fotos reales y recientes' },
      { id: 'g7', tipo: 'check', label: 'Reseñas respondidas (todas)' },
      { id: 'g8', tipo: 'check', label: 'Productos o servicios cargados' },
      { id: 'g9', tipo: 'check', label: 'Una novedad publicada al mes' },
    ],
  },
  auditoria: {
    slug: 'auditoria', kw: 'AUDITORÍA', tarea: 'Mini-auditoría', minutos: 4,
    titulo: 'Mini-auditoría digital de tu negocio',
    bajada: '10 preguntas sobre cómo te encuentran, cómo atiendes y cómo ordenas tu negocio. Te entrego tu diagnóstico, tus 3 prioridades y qué camino te conviene.',
    campos: [
      { id: 'a1', bloque: 'presencia', tipo: 'opcion', label: '¿Tienes página web propia?', req: true, opciones: [
        { v: 'no', l: 'No', p: 0 }, { v: 'plataforma', l: 'Solo un catálogo o link de una plataforma', p: 1 }, { v: 'si', l: 'Sí, con dominio propio', p: 2 } ] },
      { id: 'a2', bloque: 'presencia', tipo: 'opcion', label: '¿Cómo está tu ficha de Google?', req: true, opciones: [
        { v: 'no', l: 'No tengo / no sé', p: 0 }, { v: 'basica', l: 'Existe, pero incompleta', p: 1 }, { v: 'completa', l: 'Completa y al día', p: 2 } ] },
      { id: 'a3', bloque: 'presencia', tipo: 'opcion', label: '¿Cuántas reseñas tienes en Google?', req: true, opciones: [
        { v: '0', l: 'Ninguna o menos de 10', p: 0 }, { v: '10', l: 'Entre 10 y 50', p: 1 }, { v: '50', l: 'Más de 50', p: 2 } ] },
      { id: 'a4', bloque: 'conversion', tipo: 'opcion', label: '¿Usas WhatsApp Business con respuestas rápidas?', req: true, opciones: [
        { v: 'no', l: 'Uso WhatsApp normal', p: 0 }, { v: 'business', l: 'Business, pero sin configurar', p: 1 }, { v: 'config', l: 'Business configurado', p: 2 } ] },
      { id: 'a5', bloque: 'conversion', tipo: 'opcion', label: 'Si te escriben fuera de horario, ¿qué pasa?', req: true, opciones: [
        { v: 'nada', l: 'Responden al otro día (o nunca)', p: 0 }, { v: 'ausencia', l: 'Mensaje automático de ausencia', p: 1 }, { v: 'atiende', l: 'Algo les responde y los atiende', p: 2 } ] },
      { id: 'a6', bloque: 'conversion', tipo: 'opcion', label: '¿Cuánto demoras en responder en hora punta?', req: true, opciones: [
        { v: 'horas', l: 'Horas, a veces se escapan', p: 0 }, { v: 'min30', l: 'Unos 30 minutos', p: 1 }, { v: 'min5', l: 'Menos de 5 minutos', p: 2 } ] },
      { id: 'a7', bloque: 'orden', tipo: 'opcion', label: '¿Dónde anotas tus ventas y pedidos?', req: true, opciones: [
        { v: 'cuaderno', l: 'Cuaderno o memoria', p: 0 }, { v: 'planilla', l: 'Planilla (Excel / Sheets)', p: 1 }, { v: 'sistema', l: 'Un sistema o app', p: 2 } ] },
      { id: 'a8', bloque: 'orden', tipo: 'opcion', label: '¿Tienes registrados a tus clientes (nombre y contacto)?', req: true, opciones: [
        { v: 'no', l: 'No', p: 0 }, { v: 'algunos', l: 'Algunos, en el teléfono', p: 1 }, { v: 'si', l: 'Sí, en una lista o sistema', p: 2 } ] },
      { id: 'a9', bloque: 'ia', tipo: 'opcion', label: '¿Usas inteligencia artificial en tu negocio?', req: true, opciones: [
        { v: 'no', l: 'No', p: 0 }, { v: 'aveces', l: 'A veces, para textos', p: 1 }, { v: 'si', l: 'Sí, con el contexto de mi negocio', p: 2 } ] },
      { id: 'a10', bloque: 'ventas', tipo: 'opcion', label: '¿Cuánto vendes al mes por apps de delivery (PedidosYa, Uber Eats, Rappi)?', req: true, opciones: [
        { v: '0', l: 'No uso apps', m: 0 }, { v: '500', l: 'Menos de $500.000', m: 300000 },
        { v: '2000', l: 'Entre $500.000 y $2.000.000', m: 1200000 }, { v: '5000', l: 'Más de $2.000.000', m: 3000000 } ] },
    ],
  },
};

const BLOQUES = {
  presencia:  'Que te encuentren',
  conversion: 'Que nadie quede sin respuesta',
  orden:      'Que el negocio esté ordenado',
  ia:         'Que la IA trabaje para ti',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function txt(v, max = 1200) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}
const clp = n => '$' + Math.round(n).toLocaleString('es-CL');
function nivelDe(p) { return p < 40 ? 'urgente' : p < 75 ? 'en camino' : 'sólido'; }
const TONO = {
  cercano_emoji: 'cercano y cálido, con algún emoji',
  cercano: 'cercano y cálido, sin emojis',
  formal: 'formal y respetuoso, sin emojis',
};

// Limpia las respuestas según la definición (descarta campos desconocidos).
function limpiarRespuestas(def, raw) {
  const out = {};
  const r = raw && typeof raw === 'object' ? raw : {};
  for (const c of def.campos) {
    if (c.tipo === 'check') out[c.id] = r[c.id] === true || r[c.id] === 'true' || r[c.id] === 'on';
    else if (c.tipo === 'opcion') out[c.id] = (c.opciones.find(o => o.v === r[c.id]) || {}).v || '';
    else out[c.id] = txt(r[c.id], c.tipo === 'area' ? 1200 : 200);
  }
  return out;
}

function faltantes(def, resp) {
  return def.campos.filter(c => c.req && c.tipo !== 'check' && !resp[c.id]).map(c => c.label);
}

// ── Evaluación por recurso ───────────────────────────────────────────────────
function evalContexto(def, r, ctx) {
  const llenos = def.campos.filter(c => (c.tipo === 'opcion' ? !!r[c.id] : r[c.id].length >= 8));
  const puntaje = Math.round(llenos.length / def.campos.length * 100);
  const vacios = def.campos.filter(c => !llenos.includes(c));
  const lineas = def.campos.map((c, i) => {
    const v = c.tipo === 'opcion' ? (TONO[r[c.id]] || '') : r[c.id];
    return `${i + 1}. ${c.label}: ${v || '(por completar)'}`;
  });
  const contenido = [
    `CONTEXTO DE MI NEGOCIO — ${ctx.negocio}`, '', ...lineas, '',
    'Instrucción: Usa este contexto en todas tus respuestas. Escribe como si fueras el dueño de este negocio, en español de Chile. Si no sabes algo, dilo y no lo inventes.',
  ].join('\n');
  return {
    puntaje, nivel: nivelDe(puntaje), plan_sugerido: null,
    titular: puntaje === 100 ? 'Tu IA ya puede hablar como tu negocio' : `Tu ficha está al ${puntaje}%`,
    acciones: [
      'Copia el texto de abajo.',
      'Pégalo en ChatGPT → Proyectos → Instrucciones, en Claude → Proyectos → Instrucciones, o en Gemini → Gems.',
      vacios.length ? `Completa lo que falta: ${vacios.map(c => c.label.toLowerCase()).join(', ')}.` : 'Pruébalo: pídele que responda una reseña o que escriba tu descripción de Google.',
    ],
    entregable: { titulo: 'Tu contexto, listo para pegar', contenido },
    datos: { completos: llenos.length, total: def.campos.length },
  };
}

function evalPrompts(def, r, ctx) {
  const tono = TONO[r.tono] || TONO.cercano;
  const quien = `${ctx.negocio}${ctx.rubro ? ` (${ctx.rubro}${ctx.comuna ? ', ' + ctx.comuna : ''})` : ''}`;
  const dif = r.diferencia ? ` Lo que nos diferencia: ${r.diferencia}.` : '';
  const faq = r.faq.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const p1 = `Responde esta reseña como dueño de ${quien}, con un tono ${tono}, breve y sin prometer nada que no esté en mi contexto:\n\n${r.resena || '[pega aquí la reseña]'}`;
  const p2 = `Escribe la descripción de la ficha de Google de ${quien} en máximo 750 caracteres: qué vendemos, dónde estamos, horario y qué nos diferencia.${dif} Tono ${tono}. Sin exagerar.`;
  const p3 = `Con el contexto de ${quien}, escribe respuestas cortas, con tono ${tono}, para estas preguntas frecuentes, para usarlas como respuestas rápidas en WhatsApp Business:\n${(faq.length ? faq : ['[pregunta 1]', '[pregunta 2]', '[pregunta 3]']).map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
  return {
    puntaje: null, nivel: null, plan_sugerido: faq.length >= 4 ? 'plan05' : null,
    titular: 'Tus 3 prompts, hechos para tu negocio',
    acciones: [
      'Úsalos dentro del proyecto donde pegaste tu contexto (tarea 01): las respuestas salen mucho mejores.',
      'La IA escribe, tú decides: lee siempre antes de publicar.',
      faq.length >= 4 ? `Respondes ${faq.length} preguntas todos los días. Un agente de IA podría responderlas solo, a cualquier hora.` : 'Anota las preguntas que más te hacen esta semana: son oro para tu IA.',
    ],
    entregable: { titulo: 'Copia y pega', prompts: [
      { t: '1 · Responde tus reseñas', p: p1 },
      { t: '2 · Tu descripción de Google', p: p2 },
      { t: '3 · Respuestas para WhatsApp', p: p3 },
    ] },
    datos: { preguntas: faq.length },
  };
}

const COMO_FICHA = {
  g1: 'Usa el nombre exacto del letrero, sin palabras clave extra (Google lo penaliza).',
  g2: 'Elige la categoría principal más específica posible y suma 2–3 secundarias.',
  g3: 'Revisa que la dirección y el teléfono sean idénticos en Google, Instagram y WhatsApp.',
  g4: 'Carga el horario normal y los horarios especiales de feriados.',
  g5: 'Escribe qué vendes, dónde estás y qué te diferencia (el prompt 2 te la escribe).',
  g6: 'Sube 10 fotos reales: fachada, interior, productos y equipo. Desde el celular basta.',
  g7: 'Responde todas las reseñas, también las malas, de forma breve y cálida (prompt 1).',
  g8: 'Carga tus productos o servicios con foto y precio de referencia.',
  g9: 'Publica una novedad al mes: una promo, un producto nuevo o un cambio de horario.',
};
function evalFicha(def, r) {
  const si = def.campos.filter(c => r[c.id]);
  const no = def.campos.filter(c => !r[c.id]);
  const n = si.length;
  const nivel = n <= 3 ? 'urgente' : n <= 6 ? 'en camino' : 'sólido';
  return {
    puntaje: Math.round(n / 9 * 100), nivel, plan_sugerido: n <= 6 ? 'plan01' : null,
    titular: n <= 3 ? `${n} de 9 · Urgente` : n <= 6 ? `${n} de 9 · Vas bien` : `${n} de 9 · Arriba del promedio`,
    acciones: no.slice(0, 3).map(c => `${c.label}: ${COMO_FICHA[c.id]}`)
      .concat(no.length ? [] : ['Tu ficha está completa. Ahora el foco es sumar reseñas y publicar novedades.']),
    entregable: { titulo: 'Tu checklist', checklist: def.campos.map(c => ({ l: c.label, ok: !!r[c.id], como: r[c.id] ? '' : COMO_FICHA[c.id] })) },
    datos: { marcados: n, total: 9 },
  };
}

const ACCION_AUD = {
  a1: 'Una web propia con tu marca, conectada a Google y WhatsApp (base del Plan 01).',
  a2: 'Completa tu ficha de Google con el checklist de 9 puntos (recurso FICHA).',
  a3: 'Pide reseñas activamente: un QR en el mesón con un incentivo simple funciona.',
  a4: 'Configura WhatsApp Business: catálogo, mensaje de bienvenida y 5 respuestas rápidas.',
  a5: 'Que algo responda cuando no estás: desde un mensaje de ausencia hasta un agente de IA.',
  a6: 'En hora punta cada minuto cuenta: respuestas rápidas o un agente que responda al instante.',
  a7: 'Deja el cuaderno: un sistema simple de pedidos y ventas te muestra el negocio en números.',
  a8: 'Registra a tus clientes: es la base para que vuelvan (promos, cumpleaños, recordatorios).',
  a9: 'Dale contexto a tu IA (recurso CONTEXTO) y úsala para reseñas, Google y WhatsApp.',
};
function evalAuditoria(def, r) {
  const sum = {}, max = {};
  const fallas = [];
  for (const c of def.campos) {
    if (!c.bloque || c.bloque === 'ventas') continue;
    const o = c.opciones.find(x => x.v === r[c.id]);
    const p = o ? o.p : 0;
    sum[c.bloque] = (sum[c.bloque] || 0) + p;
    max[c.bloque] = (max[c.bloque] || 0) + 2;
    if (p < 2) fallas.push({ id: c.id, p, bloque: c.bloque });
  }
  const bloques = Object.keys(BLOQUES).map(k => ({ k, nombre: BLOQUES[k], pct: Math.round((sum[k] || 0) / (max[k] || 1) * 100) }));
  const pct = Object.fromEntries(bloques.map(b => [b.k, b.pct]));
  const total = Object.values(sum).reduce((a, b) => a + b, 0);
  const totalMax = Object.values(max).reduce((a, b) => a + b, 0);
  const puntaje = Math.round(total / totalMax * 100);

  let plan;
  if (pct.presencia < 50) plan = 'plan01';
  else if (pct.orden < 50) plan = 'plan02';
  else if (pct.conversion < 50) plan = 'plan05';
  else plan = 'plan04';

  const ventasApps = (def.campos.find(c => c.id === 'a10').opciones.find(o => o.v === r.a10) || {}).m || 0;
  const comision = Math.round(ventasApps * 0.30);
  const ahorro = Math.round(comision * 0.20); // si 1 de cada 5 pedidos pasa a canal propio

  // 3 prioridades: las preguntas con peor puntaje, primero las del bloque más débil
  fallas.sort((a, b) => a.p - b.p || pct[a.bloque] - pct[b.bloque]);
  const acciones = fallas.slice(0, 3).map(f => ACCION_AUD[f.id]);
  if (ahorro > 0) acciones.push(`Las apps se llevan cerca de ${clp(comision)} al mes en comisiones. Pasando 1 de cada 5 pedidos a tu canal propio ahorras ~${clp(ahorro)} al mes.`);

  return {
    puntaje, nivel: nivelDe(puntaje), plan_sugerido: plan,
    titular: `Tu negocio digital: ${puntaje}/100`,
    acciones,
    entregable: { titulo: 'Tu diagnóstico por área', bloques },
    datos: { bloques: pct, ventas_apps: ventasApps, comision_mes: comision, ahorro_mes: ahorro },
  };
}

const EVAL = { contexto: evalContexto, prompts: evalPrompts, ficha: evalFicha, auditoria: evalAuditoria };

function evaluar(slug, respuestasRaw, ctx) {
  const def = RECURSOS[slug];
  if (!def) return null;
  const respuestas = limpiarRespuestas(def, respuestasRaw);
  const falta = faltantes(def, respuestas);
  if (falta.length) return { error: 'Faltan respuestas: ' + falta.join(', ') };
  const resultado = EVAL[slug](def, respuestas, ctx);
  if (resultado.plan_sugerido) resultado.plan = PLAN_INFO[resultado.plan_sugerido];
  return { respuestas, resultado };
}

// Conclusión determinística (se usa si la IA no está disponible).
function conclusionBase(slug, ctx, res) {
  const n = ctx.negocio;
  if (slug === 'contexto') return res.puntaje === 100
    ? `${n} ya tiene su contexto completo. Desde ahora, cada respuesta de tu IA parte sabiendo qué vendes, dónde estás y cómo hablas. El siguiente paso: usarla para responder reseñas y escribir tu ficha de Google.`
    : `Vas bien: tu IA ya conoce lo básico de ${n}. Completa lo que falta y sus respuestas van a sonar mucho más a ti y mucho menos a una IA genérica.`;
  if (slug === 'prompts') return `Estos 3 prompts ya hablan como ${n}. Úsalos esta semana en tus reseñas, tu ficha de Google y tu WhatsApp, y mide cuánto tiempo te ahorran.`;
  if (slug === 'ficha') return res.nivel === 'urgente'
    ? `Hoy Google tiene muy poca información de ${n}, y por eso le muestra primero a otros. La buena noticia: los arreglos son simples y se hacen en una tarde.`
    : `${n} ya tiene una base en Google. Completando los puntos que faltan vas a aparecer antes que negocios que hoy te ganan solo por tener la ficha más completa.`;
  return `${n} obtuvo ${res.puntaje}/100. Tu área más débil marca por dónde empezar: atacar esas 3 prioridades es lo que más rápido se traduce en clientes.`;
}

module.exports = { RECURSOS, PLAN_INFO, BLOQUES, evaluar, conclusionBase, txt };
