// Agente demo genérico: la ficha del negocio completa va en el prompt y la IA
// conversa como el asistente de ese negocio. Es para mostrar, no para producción:
// un agente "de verdad" (ej. verticales/minimarket) separa entender de calcular.

import { config } from './config.js';

const dinero = (n) => '$' + Math.round(Number(n)).toLocaleString('es-CL');

function catalogoTexto(ficha) {
  return (ficha.catalogo || []).map(c => {
    const items = (c.items || []).map(it => {
      const precio = it.precio === null || it.precio === undefined ? 'precio a confirmar' : dinero(it.precio);
      const variantes = (it.variantes || []).map(v => `${v.nombre}${v.precio != null ? ` ${dinero(v.precio)}` : ''}`).join(' / ');
      return `  - ${it.nombre}: ${precio}${it.descripcion ? ` — ${it.descripcion}` : ''}${variantes ? ` [${variantes}]` : ''}`;
    }).join('\n');
    return `${c.categoria}:\n${items}`;
  }).join('\n');
}

function locales(ficha) {
  return (ficha.locales || []).map(l =>
    `- ${[l.nombre, l.direccion, l.comuna].filter(Boolean).join(', ')}${l.horario ? ` · ${l.horario}` : ''}${l.telefono ? ` · ${l.telefono}` : ''}`).join('\n');
}

const OBJETIVO = {
  pedidos: 'Toma pedidos: ayuda a elegir, arma el pedido, pregunta lo necesario para despacharlo o retirarlo, muestra un resumen con el total y pide confirmación.',
  reservas: 'Agenda reservas o citas: pregunta servicio, día y hora, y los datos necesarios; muestra un resumen y pide confirmación. No tienes acceso a la agenda real: propone el horario pedido como disponible si cae dentro del horario de atención.',
  consultas: 'Responde dudas y capta al interesado: resuelve con la información de la ficha y, si la persona quiere avanzar, pide nombre y lo que necesita para que el negocio lo contacte.',
};

export function construirPrompt(ficha) {
  const e = ficha.entrega || {};
  const r = ficha.reservas || {};
  const bloques = [
    `Eres ${ficha.asistente ? `${ficha.asistente}, ` : ''}el asistente de WhatsApp de ${ficha.nombre}${ficha.rubro ? ` (${ficha.rubro})` : ''}. Hablas en nombre del negocio con sus clientes.`,
    ficha.descripcion && `Sobre el negocio: ${ficha.descripcion}`,
    `Tu objetivo: ${OBJETIVO[ficha.flujo] || OBJETIVO.consultas}`,
    ficha.tono && `Tono: ${ficha.tono}`,
    ficha.saludo && `Saludo sugerido para el primer mensaje: "${ficha.saludo}"`,
    locales(ficha) && `Locales:\n${locales(ficha)}`,
    ficha.horario && `Horario: ${ficha.horario}`,
    (ficha.catalogo || []).length && `Catálogo (precios en CLP):\n${catalogoTexto(ficha)}`,
    (e.retiro || e.delivery) && `Entrega: ${[e.retiro && 'retiro en local', e.delivery && 'delivery'].filter(Boolean).join(' y ')}${e.zonas ? `. Zonas: ${e.zonas}` : ''}${e.costo ? `. Costo: ${e.costo}` : ''}${e.minimo ? `. Mínimo: ${dinero(e.minimo)}` : ''}${(e.apps || []).length ? `. También en ${e.apps.join(', ')}` : ''}.`,
    r.activo && `Reservas: piden ${(r.datos || ['nombre', 'día', 'hora']).join(', ')}.${r.notas ? ` ${r.notas}` : ''}`,
    (ficha.pagos || []).length && `Medios de pago: ${ficha.pagos.join(', ')}.`,
    (ficha.faq || []).length && `Preguntas frecuentes:\n${ficha.faq.map(f => `- ${f.p} → ${f.r}`).join('\n')}`,
    (ficha.reglas || []).length && `Cómo funciona la atención (respétalo):\n${ficha.reglas.map(x => `- ${x}`).join('\n')}`,
    (ficha.datos_pedido || []).length && `Para cerrar un ${ficha.flujo === 'reservas' ? 'agendamiento' : 'pedido'} necesitas: ${ficha.datos_pedido.join(', ')}.`,
    ficha.derivar_a && `Si no puedes resolver algo: ${ficha.derivar_a}`,
  ].filter(Boolean);

  bloques.push(`Reglas:
- Español de Chile con tuteo ("tú tienes", "puedes", "escríbeme"). Nunca voseo ("vos", "tenés", "podés", "querés").
- Mensajes cortos como en WhatsApp: 1 a 3 mensajes por turno, sin párrafos largos. Máximo un emoji por mensaje.
- Usa SOLO la información de arriba. Nunca inventes productos, precios, promociones, horarios ni direcciones. Si algo no está o dice "precio a confirmar", di que lo confirmas con el local.
- Calcula totales solo con precios que estén en el catálogo, y muéstralos en el resumen.
- Si preguntan si eres un bot o una persona: eres un asistente virtual de prueba que preparó HORIZON para mostrar cómo atendería ${ficha.nombre}.
- "accion" va SOLO cuando el cliente confirmó explícitamente un resumen que le mostraste en un mensaje anterior. Si no, "accion": null.

Responde SIEMPRE con un JSON (sin markdown):
{"respuestas": ["mensaje 1", "mensaje 2 opcional"], "accion": null | {"tipo": "pedido" | "reserva" | "consulta" | "derivar", "resumen": "resumen en una línea para el dueño", "datos": {"cliente": "...", "detalle": "...", "total": numero o null, "otros": "..."}}}`);

  return bloques.join('\n\n');
}

export async function responder(ficha, historial, mensaje) {
  if (!config.llm.apiKey) throw new Error('Falta DEEPSEEK_API_KEY en .env');
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({
      model: config.llm.modelo,
      messages: [
        { role: 'system', content: construirPrompt(ficha) },
        ...historial,
        { role: 'user', content: mensaje },
      ],
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 900,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`IA respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return interpretar(data?.choices?.[0]?.message?.content);
}

export function interpretar(raw) {
  let out = {};
  try {
    out = JSON.parse(String(raw || '{}').replace(/```json/g, '').replace(/```/g, '').trim());
  } catch {
    // Si no vino JSON, se usa el texto tal cual como respuesta.
    return { respuestas: raw ? [String(raw).trim()] : [], accion: null };
  }
  const respuestas = (Array.isArray(out.respuestas) ? out.respuestas : [out.respuestas])
    .filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, 3);
  const a = out.accion;
  const accion = a && ['pedido', 'reserva', 'consulta', 'derivar'].includes(a.tipo)
    ? { tipo: a.tipo, resumen: String(a.resumen || '').slice(0, 500), datos: a.datos && typeof a.datos === 'object' ? a.datos : {} }
    : null;
  return { respuestas, accion };
}

export function avisoDueno(ficha, accion, telefono) {
  const titulo = { pedido: 'Nuevo pedido', reserva: 'Nueva reserva', consulta: 'Nueva consulta', derivar: 'Cliente pide hablar con alguien' }[accion.tipo];
  const d = accion.datos || {};
  const lineas = [
    `🔔 *${titulo}* · ${ficha.nombre}`,
    accion.resumen,
    d.cliente && `Cliente: ${d.cliente}`,
    d.detalle && `Detalle: ${d.detalle}`,
    Number.isFinite(d.total) && `Total: ${dinero(d.total)}`,
    d.otros && d.otros,
    telefono && `WhatsApp: +${telefono}`,
  ];
  return lineas.filter(Boolean).join('\n');
}
