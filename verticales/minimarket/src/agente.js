// Orquestador: el mismo recorrido del flujo de Mesa Cero, escrito como código.
//   mensaje → sesión + cliente + catálogo → candidatos → IA (capa 1, JSON)
//   → motor (capa 2, valida y cotiza) → pedido (RPC que recalcula y descuenta stock)
//   → guardar sesión → registrar costo → { replyChunks }

import { indexarCatalogo, buscarCandidatos } from './catalogo.js';
import { construirPrompt } from './prompt.js';
import { procesar, estaAbierto, mensajePedidoCreado, mensajeErrorPedido } from './motor.js';
import { costoClp } from './llm.js';

const CACHE_MS = 5 * 60 * 1000;
const SESION_VENCE_MS = 6 * 60 * 60 * 1000; // carrito abandonado: se olvida a las 6 h

export function crearAgente({ db, extraer, ahora = () => new Date(), log = console }) {
  let cache = null;
  let cacheEn = 0;

  async function catalogoActual(forzar = false) {
    if (forzar || !cache || Date.now() - cacheEn > CACHE_MS) {
      const datos = await db.cargarCatalogo();
      cache = { negocio: datos.negocio, catalogo: indexarCatalogo(datos) };
      cacheEn = Date.now();
    }
    return cache;
  }

  async function manejarMensaje({ telefono, mensaje, canal = 'whatsapp' }) {
    const tel = String(telefono || '').trim();
    const texto = String(mensaje || '').trim().slice(0, 1500);
    if (!tel || !texto) return { replyChunks: [] };

    const [{ negocio, catalogo }, guardado, cliente] = await Promise.all([
      catalogoActual(), db.obtenerSesion(tel), db.obtenerCliente(tel),
    ]);

    let contexto = guardado || {};
    if (contexto._ts && Date.now() - contexto._ts > SESION_VENCE_MS) {
      contexto = { nombre: contexto.nombre, direccion: contexto.direccion };
    }
    if (!contexto.nombre && cliente?.nombre) contexto.nombre = cliente.nombre;
    if (!contexto.direccion && cliente?.direccion) contexto.direccion = cliente.direccion;

    const extra = [
      ...(contexto.carrito || []).map(i => i.sku),
      ...(contexto.ultimasOpciones || []),
      ...(contexto.ultimosConsultados || []),
    ];
    const candidatos = buscarCandidatos(catalogo, texto, extra);
    const systemPrompt = construirPrompt({ negocio, catalogo, candidatos, contexto, cliente });

    let ia;
    try {
      ia = await extraer(systemPrompt, texto);
    } catch (e) {
      log.error('[agente] IA falló:', e.message);
      return { replyChunks: ['Perdona, se me cruzó algo. ¿Me lo repites en un ratito?'] };
    }
    let r = procesar({ ext: ia.ext, contexto, catalogo, negocio, cliente });
    let respuestas = r.respuestas;
    let contextoNuevo = r.contexto;
    let pedidoCreado = null;

    if (r.pedido) {
      try {
        pedidoCreado = await db.crearPedido({ ...r.pedido, telefono: tel, canal });
        respuestas = mensajePedidoCreado(pedidoCreado, r.pedido, negocio, estaAbierto(negocio, ahora()));
        await catalogoActual(true); // el stock cambió
      } catch (e) {
        log.warn('[agente] pedido rechazado:', e.message);
        const err = mensajeErrorPedido(e, catalogo);
        const ctx = structuredClone(r.contextoPrevio);
        if (err.sku) {
          const linea = ctx.carrito.find(i => i.sku === err.sku);
          if (linea && err.quedan > 0) linea.cantidad = err.quedan;
          else ctx.carrito = ctx.carrito.filter(i => i.sku !== err.sku);
        }
        ctx.esperandoConfirmacion = false;
        const fresco = await catalogoActual(true);
        const r2 = procesar({ ext: {}, contexto: ctx, catalogo: fresco.catalogo, negocio: fresco.negocio, cliente });
        respuestas = [err.texto, ...r2.respuestas];
        contextoNuevo = r2.contexto;
      }
    }

    contextoNuevo._ts = Date.now();
    await db.guardarSesion(tel, contextoNuevo);

    db.registrarInteraccion({
      telefono: tel,
      canal,
      mensaje: texto,
      respuesta: respuestas.join('\n---\n'),
      tokens_entrada: ia.tokensEntrada,
      tokens_salida: ia.tokensSalida,
      costo_clp: costoClp(ia.tokensEntrada, ia.tokensSalida),
      pedido_id: pedidoCreado?.id || null,
    }).catch(e => log.warn('[agente] no se pudo registrar la interacción:', e.message));

    return { replyChunks: respuestas, pedido: pedidoCreado?.codigo || null };
  }

  return { manejarMensaje, catalogoActual };
}
