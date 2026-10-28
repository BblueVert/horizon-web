// Capa 2 — motor de pedidos. Función pura: recibe lo que entendió la IA + el
// estado guardado + el catálogo real, y devuelve qué responder, el estado nuevo
// y (si el cliente confirmó) el pedido a crear. Todo precio, stock y total sale
// de aquí, nunca de la IA.

import { cotizarCarrito, consejoMayorista, fichaPrecio } from './precios.js';
import { dinero, cantidadTexto, nombreProducto, primerNombre } from './texto.js';
import { productosDeCategoria } from './catalogo.js';

const PAGOS = { efectivo: 'efectivo', transferencia: 'transferencia', tarjeta: 'tarjeta (débito o crédito al recibir)' };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function normalizarCantidad(cantidad, unidad) {
  const n = Number(cantidad);
  if (!Number.isFinite(n) || n <= 0) return 1;
  if (unidad === 'kg') return Math.max(0.25, Math.round(n * 4) / 4);
  return Math.max(1, Math.round(n));
}

function lineaCarrito(l) {
  const cant = l.unidad === 'kg' ? cantidadTexto(l.cantidad, 'kg') : `${l.cantidad} x`;
  const unit = l.unidad === 'kg' ? `${dinero(l.precioUnitario)} el kilo` : `${dinero(l.precioUnitario)} c/u`;
  const tramo = l.tramo !== 'detalle' ? ` (${l.tramo})` : '';
  return `• ${cant} ${l.nombre} — ${unit}${tramo} = ${dinero(l.subtotal)}`;
}

export function resumenPedido(cot, contexto, negocio) {
  const filas = cot.lineas.map(lineaCarrito);
  filas.push('', `Subtotal: ${dinero(cot.subtotal)}`);
  if (cot.ahorro > 0) filas.push(`Ahorro por precio mayorista: ${dinero(cot.ahorro)}`);
  if (contexto.entrega === 'despacho') {
    filas.push(cot.despacho ? `Despacho: ${dinero(cot.despacho)}` : 'Despacho: gratis');
  }
  filas.push(`*Total: ${dinero(cot.total)}*`);
  return filas.join('\n');
}

export function estaAbierto(negocio, fecha = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(fecha).map(p => [p.type, p.value]));
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partes.weekday);
  const ahora = `${partes.hour}:${partes.minute}`;
  const rango = negocio.horario?.[String(dia)];
  return !!rango && ahora >= rango[0] && ahora < rango[1];
}

function textoHorario(negocio) {
  const grupos = [];
  for (const d of [1, 2, 3, 4, 5, 6, 0]) {
    const r = negocio.horario?.[String(d)];
    const txt = r ? `${r[0]} a ${r[1]}` : 'cerrado';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.txt === txt) ultimo.hasta = d;
    else grupos.push({ desde: d, hasta: d, txt });
  }
  return grupos.map(g => `${g.desde === g.hasta ? DIAS[g.desde] : `${DIAS[g.desde]} a ${DIAS[g.hasta]}`}: ${g.txt}`).join(' · ');
}

function respuestaConsulta(tipo, negocio) {
  switch (tipo) {
    case 'horario': return `Atendemos ${textoHorario(negocio)}.`;
    case 'ubicacion': return `Estamos en ${negocio.direccion}, ${negocio.comuna}.`;
    case 'pago': return `Aceptamos ${negocio.medios_pago.map(m => PAGOS[m] || m).join(', ')}.`;
    case 'despacho':
      if (!negocio.despacho_activo) return 'Por ahora solo trabajamos con retiro en el local.';
      return `Despachamos en ${negocio.comunas_despacho.join(' y ')}. Pedido mínimo ${dinero(negocio.minimo_despacho)}, despacho ${dinero(negocio.costo_despacho)} y gratis sobre ${dinero(negocio.despacho_gratis_desde)}.`;
    case 'mayorista':
      return 'Vendemos al por mayor con precio por cantidad: cada producto tiene precio detalle, precio mayorista desde cierta cantidad y precio por caja completa. El precio baja solo cuando llegas a la cantidad. Pregúntame por cualquier producto y te paso sus tramos.';
    default: return null;
  }
}

function base(contexto, respuestas, extra = {}) {
  return { respuestas: respuestas.filter(Boolean), contexto, pedido: null, ...extra };
}

/**
 * @param {object} p
 * @param {object} p.ext       JSON de la capa 1 (puede venir incompleto o vacío)
 * @param {object} p.contexto  estado guardado de la sesión
 * @param {object} p.catalogo  catálogo indexado (indexarCatalogo)
 * @param {object} p.negocio   fila de mm_negocio
 * @param {object} [p.cliente] fila de mm_clientes si existe
 */
export function procesar({ ext = {}, contexto = {}, catalogo, negocio, cliente = null }) {
  const ctx = structuredClone(contexto);
  ctx.carrito = Array.isArray(ctx.carrito) ? ctx.carrito : [];
  const tipoCliente = cliente?.tipo || 'detalle';
  const respuestas = [];
  const replyIA = Array.isArray(ext.reply) ? ext.reply.filter(Boolean).slice(0, 1) : [];

  // ── Cancelar ──
  if (ext.cancelar) {
    return base({ nombre: ctx.nombre }, [replyIA[0] || 'Listo, dejé el pedido sin efecto. Cuando quieras armamos otro 🙂']);
  }

  // ── Datos del pedido que vienen en el mensaje ──
  if (!negocio.despacho_activo) ctx.entrega = 'retiro';
  let datoNuevo = false;
  if (ext.nombre && !ctx.nombre) { ctx.nombre = String(ext.nombre).trim(); datoNuevo = true; }
  if (ext.direccion) { ctx.direccion = String(ext.direccion).trim(); datoNuevo = true; }
  if (ext.pago && negocio.medios_pago.includes(ext.pago)) { ctx.pago = ext.pago; datoNuevo = true; }
  if (ext.entrega === 'retiro' || ext.entrega === 'despacho') {
    if (ext.entrega === 'despacho' && !negocio.despacho_activo) {
      respuestas.push('Por ahora no estamos despachando, solo retiro en el local.');
      ctx.entrega = 'retiro';
    } else {
      ctx.entrega = ext.entrega;
    }
    datoNuevo = true;
  }

  // ── Productos: validar cada uno contra el catálogo real ──
  const agregados = [];
  const noEncontrados = [];
  const ambiguos = [];
  const avisosStock = [];
  let cambioCarrito = false;

  for (const it of Array.isArray(ext.items) ? ext.items : []) {
    let p = it.sku ? catalogo.porSku.get(it.sku) : null;
    const opciones = (it.opciones || []).map(s => catalogo.porSku.get(s)).filter(Boolean);
    if (!p && opciones.length === 1) p = opciones[0];
    if (!p) {
      if (opciones.length > 1) ambiguos.push({ mencionado: it.mencionado, opciones: opciones.slice(0, 5), cantidad: it.cantidad });
      else if (it.mencionado) noEncontrados.push(it.mencionado);
      continue;
    }

    const idx = ctx.carrito.findIndex(c => c.sku === p.sku);
    const actual = idx >= 0 ? ctx.carrito[idx].cantidad : 0;
    const accion = it.accion || 'agregar';

    if (accion === 'quitar') {
      if (idx < 0) continue;
      const nueva = it.cantidad ? actual - normalizarCantidad(it.cantidad, p.unidad) : 0;
      if (nueva > 0) ctx.carrito[idx].cantidad = nueva; else ctx.carrito.splice(idx, 1);
      cambioCarrito = true;
      agregados.push({ p, quitado: nueva <= 0, cantidad: Math.max(0, nueva) });
      continue;
    }

    let nueva = accion === 'cambiar'
      ? normalizarCantidad(it.cantidad, p.unidad)
      : actual + normalizarCantidad(it.cantidad, p.unidad);

    const stock = Number(p.stock);
    if (stock <= 0) { avisosStock.push(`${nombreProducto(p)} no nos queda por ahora.`); continue; }
    if (nueva > stock) {
      nueva = p.unidad === 'kg' ? stock : Math.floor(stock);
      avisosStock.push(`De ${nombreProducto(p)} solo me quedan ${cantidadTexto(stock, p.unidad)}, te dejé esa cantidad.`);
    }
    if (idx >= 0) ctx.carrito[idx].cantidad = nueva; else ctx.carrito.push({ sku: p.sku, cantidad: nueva });
    cambioCarrito = true;
    agregados.push({ p, cantidad: nueva });
  }

  if (cambioCarrito) ctx.esperandoConfirmacion = false;
  ctx.ultimasOpciones = ambiguos.flatMap(a => a.opciones.map(o => o.sku));

  // ── Consultas (respuestas con datos reales) ──
  const consultados = (ext.consultaPrecios || []).map(s => catalogo.porSku.get(s)).filter(Boolean).slice(0, 6);
  ctx.ultimosConsultados = consultados.map(p => p.sku);
  if (consultados.length) respuestas.push(consultados.map(fichaPrecio).join('\n'));

  if (ext.consultaCategoria) {
    const cat = catalogo.categorias.find(c => c.id === ext.consultaCategoria);
    const lista = cat ? productosDeCategoria(catalogo, cat.id, 12) : [];
    if (lista.length) {
      respuestas.push(`De ${cat.nombre.toLowerCase()} tenemos, entre otros:\n${lista.map(p => `• ${nombreProducto(p)} — ${dinero(p.precio_detalle)}${p.unidad === 'kg' ? ' el kilo' : ''}`).join('\n')}\n¿Buscas algo en particular?`);
      ctx.ultimosConsultados = lista.map(p => p.sku);
    }
  }
  const txtConsulta = respuestaConsulta(ext.consulta, negocio);
  if (txtConsulta) respuestas.push(txtConsulta);

  // ── Lo que cambió en el carrito ──
  if (agregados.length) {
    const partes = agregados.map(a => a.quitado
      ? `saqué ${nombreProducto(a.p)}`
      : `${a.p.unidad === 'kg' ? cantidadTexto(a.cantidad, 'kg') : `${a.cantidad} x`} ${nombreProducto(a.p)}`);
    respuestas.push(`Anotado: ${partes.join(', ')}.`);
    const consejos = agregados.filter(a => !a.quitado).map(a => consejoMayorista(a.p, a.cantidad, tipoCliente)).filter(Boolean);
    if (consejos.length) respuestas.push(consejos.slice(0, 2).join('\n'));
  }
  respuestas.push(...avisosStock);
  for (const a of ambiguos) {
    respuestas.push(`¿Cuál ${a.mencionado ? `de "${a.mencionado}" ` : ''}quieres?\n${a.opciones.map((o, i) => `${i + 1}. ${nombreProducto(o)} — ${dinero(o.precio_detalle)}${o.unidad === 'kg' ? ' el kilo' : ''}`).join('\n')}`);
  }
  if (noEncontrados.length) {
    respuestas.push(`No encontré "${noEncontrados.join('", "')}" en el catálogo. ¿Me lo dices de otra forma o con la marca?`);
  }

  const cot = cotizarCarrito(ctx.carrito, catalogo, negocio, ctx.entrega, tipoCliente);

  if (ext.verCarrito) {
    respuestas.push(ctx.carrito.length ? `Llevas:\n${resumenPedido(cot, ctx, negocio)}` : 'Tu pedido está vacío por ahora. ¿Qué te anoto?');
  }

  // ── Carrito vacío: saludo / fuera de tema / pregunta abierta ──
  if (!ctx.carrito.length) {
    if (ext.fueraDeTema && !respuestas.length) {
      return base(ctx, [replyIA[0] || `Te ayudo con pedidos de ${negocio.nombre}: abarrotes, bebidas, aseo, golosinas y más. ¿Qué necesitas?`]);
    }
    if (!respuestas.length) {
      const hola = ext.saludo || !contexto.carrito
        ? (replyIA[0] || `¡Hola! Bienvenido a ${negocio.nombre} 👋`)
        : null;
      return base(ctx, [hola, 'Dime qué necesitas y te armo el pedido. Si llevas cantidad, el precio baja solo (detalle, mayorista y caja).']);
    }
    return base(ctx, respuestas);
  }

  // ── Confirmación ──
  const completo = ctx.nombre && ctx.entrega && ctx.pago && (ctx.entrega === 'retiro' || ctx.direccion);
  const minimoOk = ctx.entrega !== 'despacho' || cot.subtotal >= negocio.minimo_despacho;

  if (ext.confirmar === 'no' && contexto.esperandoConfirmacion && !cambioCarrito) {
    ctx.esperandoConfirmacion = false;
    return base(ctx, [...respuestas, 'Ya, ¿qué quieres cambiar? Puedes agregar, quitar o cambiar cantidades.']);
  }

  if (ext.confirmar === 'si' && contexto.esperandoConfirmacion && !cambioCarrito && completo && minimoOk) {
    return base({ nombre: ctx.nombre }, [], {
      pedido: {
        telefono: null, // lo completa el agente
        nombre: ctx.nombre,
        entrega: ctx.entrega,
        direccion: ctx.entrega === 'despacho' ? ctx.direccion : null,
        medio_pago: ctx.pago,
        items: ctx.carrito.map(i => ({ sku: i.sku, cantidad: i.cantidad })),
      },
      cotizacion: cot,
      contextoPrevio: ctx,
    });
  }

  // ── ¿Qué falta? Se pregunta una cosa a la vez ──
  const debePreguntar = cambioCarrito || datoNuevo || ext.confirmar || !respuestas.length;
  if (!debePreguntar) return base(ctx, respuestas);

  if (!ctx.nombre) {
    respuestas.push('¿A nombre de quién dejo el pedido?');
  } else if (!ctx.entrega) {
    respuestas.push(`¿Lo retiras en el local o te lo despachamos? (despacho ${dinero(negocio.costo_despacho)}, gratis sobre ${dinero(negocio.despacho_gratis_desde)})`);
  } else if (ctx.entrega === 'despacho' && !ctx.direccion) {
    respuestas.push(`¿A qué dirección te lo mando, ${primerNombre(ctx.nombre)}? (calle, número y comuna)`);
  } else if (!minimoOk) {
    respuestas.push(`Para despacho el mínimo es ${dinero(negocio.minimo_despacho)} y llevas ${dinero(cot.subtotal)}. ¿Agregas algo más o prefieres retirarlo?`);
  } else if (!ctx.pago) {
    respuestas.push(`¿Cómo vas a pagar? ${negocio.medios_pago.map(m => PAGOS[m] || m).join(', ')}.`);
  } else {
    const entrega = ctx.entrega === 'despacho' ? `Despacho a ${ctx.direccion}` : `Retiro en ${negocio.direccion}`;
    respuestas.push(`Tu pedido:\n${resumenPedido(cot, ctx, negocio)}\n${entrega} · Pago: ${PAGOS[ctx.pago] || ctx.pago}`);
    respuestas.push('¿Lo confirmo? Responde *sí* o dime qué cambio.');
    ctx.esperandoConfirmacion = true;
  }

  return base(ctx, respuestas);
}

// Mensaje final después de que la base creó el pedido.
export function mensajePedidoCreado(resultado, pedido, negocio, abierto) {
  const nombre = primerNombre(pedido.nombre);
  const msgs = [`¡Listo${nombre ? ` ${nombre}` : ''}! Tu pedido *${resultado.codigo}* quedó confirmado por ${dinero(resultado.total)}.`];
  if (resultado.descuento_mayorista > 0) msgs.push(`Te ahorraste ${dinero(resultado.descuento_mayorista)} por precio mayorista.`);
  if (pedido.entrega === 'despacho') {
    msgs.push(abierto ? 'Lo estamos preparando y te avisamos cuando salga.' : `Ahora estamos cerrados: sale apenas abramos. Atendemos ${textoHorario(negocio)}.`);
  } else {
    msgs.push(abierto ? `Te avisamos cuando esté listo para retirar en ${negocio.direccion}.` : `Ahora estamos cerrados: lo tenemos listo apenas abramos. Atendemos ${textoHorario(negocio)}.`);
  }
  if (pedido.medio_pago === 'transferencia' && negocio.datos_transferencia) msgs.push(negocio.datos_transferencia);
  return msgs;
}

// Traduce los errores de mm_crear_pedido a algo que el cliente entienda.
export function mensajeErrorPedido(error, catalogo) {
  const msg = String(error?.message || error);
  const sinStock = msg.match(/sin_stock:([A-Z]+-\d+):([\d.]+)/);
  if (sinStock) {
    const p = catalogo.porSku.get(sinStock[1]);
    const quedan = Number(sinStock[2]);
    return { sku: sinStock[1], quedan, texto: `Justo se vendió parte del stock: de ${p ? nombreProducto(p) : sinStock[1]} quedan ${cantidadTexto(quedan, p?.unidad)}. Ajusté tu pedido, revísalo:` };
  }
  const minimo = msg.match(/minimo_despacho:(\d+)/);
  if (minimo) return { texto: `Para despacho el mínimo es ${dinero(minimo[1])}. ¿Agregas algo más o lo retiras?` };
  const noDisp = msg.match(/producto_no_disponible:([A-Z]+-\d+)/);
  if (noDisp) return { sku: noDisp[1], quedan: 0, texto: `Uno de los productos ya no está disponible. Lo saqué del pedido, revísalo:` };
  return { texto: 'Tuve un problema guardando el pedido. ¿Me escribes "confirmo" de nuevo en un momento?' };
}

