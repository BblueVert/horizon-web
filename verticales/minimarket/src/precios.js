// Precios por cantidad (detalle → mayorista → caja).
// Misma regla que la función SQL mm_precio_unitario(): gana el tramo con la
// cantidad mínima más alta que la cantidad pedida alcance. Sin tramo = precio detalle.
// Cliente registrado como 'mayorista': paga al menos el primer tramo aunque lleve menos.

import { dinero, cantidadTexto, nombreProducto } from './texto.js';

export function tramosDe(producto) {
  return [...(producto.escalas || [])].sort((a, b) => a.cantidad_min - b.cantidad_min);
}

export function precioUnitario(producto, cantidad, tipoCliente = 'detalle') {
  const tramos = tramosDe(producto);
  const cantPrecio = tipoCliente === 'mayorista' && tramos.length ? Math.max(cantidad, tramos[0].cantidad_min) : cantidad;
  let precio = producto.precio_detalle;
  let tramo = 'detalle';
  for (const t of tramos) {
    if (cantPrecio >= t.cantidad_min) { precio = t.precio_unitario; tramo = t.etiqueta; }
  }
  return { precio, tramo };
}

export function siguienteTramo(producto, cantidad) {
  return tramosDe(producto).find(t => t.cantidad_min > cantidad) || null;
}

export function cotizarLinea(producto, cantidad, tipoCliente) {
  const { precio, tramo } = precioUnitario(producto, cantidad, tipoCliente);
  const subtotal = Math.round(precio * cantidad);
  const subtotalLista = Math.round(producto.precio_detalle * cantidad);
  return {
    sku: producto.sku,
    nombre: nombreProducto(producto),
    unidad: producto.unidad,
    cantidad,
    precioLista: producto.precio_detalle,
    precioUnitario: precio,
    tramo,
    subtotal,
    ahorro: subtotalLista - subtotal,
  };
}

export function cotizarCarrito(carrito, catalogo, negocio, entrega, tipoCliente) {
  const lineas = [];
  for (const item of carrito) {
    const p = catalogo.porSku.get(item.sku);
    if (p) lineas.push(cotizarLinea(p, item.cantidad, tipoCliente));
  }
  const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
  const ahorro = lineas.reduce((s, l) => s + l.ahorro, 0);
  let despacho = 0;
  if (entrega === 'despacho' && subtotal < negocio.despacho_gratis_desde) despacho = negocio.costo_despacho;
  return {
    lineas,
    subtotal,
    ahorro,
    despacho,
    total: subtotal + despacho,
    esMayorista: lineas.some(l => l.tramo !== 'detalle'),
  };
}

// "Si llevas 12 te queda a $1.130 c/u" — solo cuando falta poco para el próximo tramo.
export function consejoMayorista(producto, cantidad, tipoCliente = 'detalle') {
  const tramos = tramosDe(producto);
  const cantPrecio = tipoCliente === 'mayorista' && tramos.length ? Math.max(cantidad, tramos[0].cantidad_min) : cantidad;
  const sig = siguienteTramo(producto, cantPrecio);
  if (!sig) return null;
  const falta = sig.cantidad_min - cantidad;
  const cerca = falta <= Math.max(2, Math.ceil(sig.cantidad_min * 0.34));
  if (!cerca) return null;
  const cuanto = producto.unidad === 'kg' ? `${dinero(sig.precio_unitario)} el kilo` : `${dinero(sig.precio_unitario)} c/u`;
  return `Si llevas ${cantidadTexto(sig.cantidad_min, producto.unidad)} de ${producto.nombre.toLowerCase()} te queda a ${cuanto} (precio ${sig.etiqueta}).`;
}

// Ficha corta para responder "¿a cuánto está...?".
export function fichaPrecio(producto) {
  const por = producto.unidad === 'kg' ? ' el kilo' : '';
  const base = `${nombreProducto(producto)}: ${dinero(producto.precio_detalle)}${por}`;
  const tramos = tramosDe(producto).map(t =>
    `desde ${cantidadTexto(t.cantidad_min, producto.unidad)} a ${dinero(t.precio_unitario)}${producto.unidad === 'kg' ? '' : ' c/u'}`);
  const stock = Number(producto.stock) <= 0 ? ' (sin stock por ahora)' : '';
  return tramos.length ? `${base} · ${tramos.join(' · ')}${stock}` : `${base}${stock}`;
}
