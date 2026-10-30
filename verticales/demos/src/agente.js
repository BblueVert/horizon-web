// Agente demo genérico: la ficha del negocio completa va en el prompt y la IA
// conversa como el asistente de ese negocio. Es para mostrar, no para producción:
// un agente "de verdad" (ej. verticales/minimarket) separa entender de calcular.

import { config } from './config.js';
import { mapaDe } from './ficha.js';

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
    `- ${[l.nombre, l.direccion, l.comuna].filter(Boolean).join(', ')}${l.horario ? ` · ${l.horario}` : ''}${l.telefono ? ` · ${l.telefono}` : ''}${l.referencia ? ` · ${l.referencia}` : ''} · mapa: ${mapaDe(l)}`).join('\n');
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
    r.activo && `Reservas: piden ${(r.datos || ['nombre', 'día', 'hora']).join(', ')}.${r.horarios ? ` Horas disponibles: ${r.horarios}.` : ''}${r.notas ? ` ${r.notas}` : ''}`,
    ficha.pago_online?.activo && `Pago por WhatsApp: al confirmar, el sistema le manda al cliente un link de pago ${ficha.pago_online.porcentaje ? `por el abono del ${ficha.pago_online.porcentaje}%` : 'por el total'}. Avísale que le llega el link; nunca escribas un link tú.`,
    ficha.flujo === 'pedidos' && e.retiro && 'Retiro: pregunta a qué hora pasa. Al confirmar, el sistema le manda un código de retiro para que lo entreguen sin esperar.',
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
- Si preguntan dónde están o cómo llegar, responde la dirección y pon "ubicacion": true (el sistema envía el pin del mapa).
- Si el cliente dice que ya pagó, agradécele y confírmale que quedó listo.
- "accion" va SOLO cuando el cliente confirmó explícitamente un resumen que le mostraste en un mensaje anterior. Si no, "accion": null.

Responde SIEMPRE con un JSON (sin markdown):
{"respuestas": ["mensaje 1", "mensaje 2 opcional"], "ubicacion": false, "accion": null | {"tipo": "pedido" | "reserva" | "consulta" | "derivar", "resumen": "resumen en una línea para el dueño", "datos": {"cliente": "...", "detalle": "...", "total": numero en CLP o null, "entrega": "retiro" | "delivery" | null, "hora": "...", "otros": "..."}}}`);

  return bloques.join('\n\n');
}

export async function responder(ficha, historial, mensaje) {
  const messages = [
    { role: 'system', content: construirPrompt(ficha) },
    ...historial,
    { role: 'user', content: mensaje },
  ];

  if (config.llm.via === 'n8n') {
    const res = await fetch(config.llm.n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: ficha.slug, messages }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`n8n demo-ia respondió ${res.status} (¿está activo el workflow?)`);
    const data = await res.json().catch(() => ({}));
    return interpretar(data.content);
  }

  if (!config.llm.apiKey) throw new Error('LLM_VIA=deepseek necesita DEEPSEEK_API_KEY en .env');
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({
      model: config.llm.modelo,
      messages,
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
    return { respuestas: raw ? [String(raw).trim()] : [], ubicacion: false, accion: null };
  }
  const respuestas = (Array.isArray(out.respuestas) ? out.respuestas : [out.respuestas])
    .filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()).slice(0, 3);
  const a = out.accion;
  const accion = a && ['pedido', 'reserva', 'consulta', 'derivar'].includes(a.tipo)
    ? { tipo: a.tipo, resumen: String(a.resumen || '').slice(0, 500), datos: a.datos && typeof a.datos === 'object' ? a.datos : {} }
    : null;
  return { respuestas, ubicacion: out.ubicacion === true, accion };
}

export function avisoDueno(ficha, accion, telefono) {
  const titulo = { pedido: 'Nuevo pedido', reserva: 'Nueva reserva', consulta: 'Nueva consulta', derivar: 'Cliente pide hablar con alguien' }[accion.tipo];
  const d = accion.datos || {};
  const lineas = [
    `🔔 *${titulo}* · ${ficha.nombre}`,
    accion.resumen,
    accion.codigo && `Código: ${accion.codigo}`,
    d.cliente && `Cliente: ${d.cliente}`,
    d.hora && `Hora: ${d.hora}`,
    d.entrega && `Entrega: ${d.entrega}`,
    d.detalle && `Detalle: ${d.detalle}`,
    Number.isFinite(d.total) && `Total: ${dinero(d.total)}`,
    accion.pago && `Pago: link enviado por ${dinero(accion.pago)}`,
    d.otros && d.otros,
    telefono && `WhatsApp: +${telefono}`,
  ];
  return lineas.filter(Boolean).join('\n');
}

// Lo que agrega el sistema después de una confirmación: código, link de pago.
export function extrasConfirmacion(ficha, accion, numero, azar = Math.random) {
  if (!['pedido', 'reserva'].includes(accion.tipo)) return { mensajes: [], accion };
  const d = accion.datos || {};
  const codigo = `${accion.tipo === 'pedido' ? 'R' : 'A'}-${String(Math.floor(1000 + azar() * 9000))}`;
  const mensajes = [];
  let pago = null;
  const po = ficha.pago_online;
  const total = Number(d.total);
  if (po?.activo && Number.isFinite(total) && total > 0) {
    pago = po.porcentaje ? Math.round((total * po.porcentaje) / 100 / 10) * 10 : Math.round(total);
    const url = new URL(config.pagoDemoUrl);
    url.search = new URLSearchParams({
      n: ficha.nombre, m: String(pago), d: accion.resumen || d.detalle || '', r: codigo,
      w: String(numero || ''), ...(ficha.color ? { c: ficha.color } : {}), ...(po.porcentaje ? { a: String(po.porcentaje) } : {}),
    }).toString();
    mensajes.push(po.porcentaje
      ? `💳 Para dejarlo reservado, abona el ${po.porcentaje}% (${dinero(pago)}) aquí:\n${url}`
      : `💳 Puedes pagar ${dinero(pago)} aquí mismo:\n${url}`);
  }
  if (accion.tipo === 'pedido' && d.entrega !== 'delivery') {
    mensajes.push(`🧾 Tu código de retiro: *${codigo}*${d.hora ? ` · ${d.hora}` : ''}\nMuéstralo en caja y te lo entregamos al tiro, sin fila.`);
  } else if (accion.tipo === 'reserva') {
    mensajes.push(`📅 Tu código de reserva: *${codigo}*${d.hora ? ` · ${d.hora}` : ''}. Te recordamos un día antes.`);
  }
  return { mensajes, accion: { ...accion, codigo, pago } };
}
