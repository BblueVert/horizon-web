// Datos en memoria desde db/catalogo.json. Para `npm run simular` y las pruebas:
// mismo contrato que supabase.js y misma lógica que mm_crear_pedido().

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expandirCatalogo, indexarCatalogo } from '../catalogo.js';
import { cotizarCarrito } from '../precios.js';

const rutaCatalogo = join(dirname(fileURLToPath(import.meta.url)), '../../db/catalogo.json');

export function crearMemoria(json = JSON.parse(readFileSync(rutaCatalogo, 'utf8'))) {
  const datos = expandirCatalogo(json);
  const sesiones = new Map();
  const clientes = new Map();
  const pedidos = [];
  const interacciones = [];

  return {
    pedidos, interacciones, clientes, datos,
    async cargarCatalogo() { return datos; },
    async obtenerSesion(tel) { return structuredClone(sesiones.get(tel) || {}); },
    async guardarSesion(tel, ctx) { sesiones.set(tel, structuredClone(ctx)); },
    async obtenerCliente(tel) { return clientes.get(tel) || null; },
    async crearPedido(p) {
      if (!p.items?.length) throw new Error('pedido_vacio');
      const cat = indexarCatalogo(datos);
      for (const it of p.items) {
        const prod = cat.porSku.get(it.sku);
        if (!prod || !(it.cantidad > 0)) throw new Error(`producto_no_disponible:${it.sku}`);
        if (prod.stock < it.cantidad) throw new Error(`sin_stock:${prod.sku}:${prod.stock}`);
      }
      const cliente = clientes.get(p.telefono);
      const cot = cotizarCarrito(p.items, cat, datos.negocio, p.entrega, cliente?.tipo);
      if (p.entrega === 'despacho' && cot.subtotal < datos.negocio.minimo_despacho) {
        throw new Error(`minimo_despacho:${datos.negocio.minimo_despacho}`);
      }
      for (const it of p.items) cat.porSku.get(it.sku).stock -= it.cantidad;
      clientes.set(p.telefono, {
        ...(cliente || { tipo: 'detalle', total_pedidos: 0 }),
        telefono: p.telefono,
        nombre: p.nombre || cliente?.nombre,
        direccion: p.direccion || cliente?.direccion,
        total_pedidos: (cliente?.total_pedidos || 0) + 1,
      });
      const codigo = `MM-${String(pedidos.length + 1).padStart(4, '0')}`;
      const fila = {
        id: codigo, codigo, ...p, lineas: cot.lineas,
        subtotal: cot.subtotal, descuento_mayorista: cot.ahorro, costo_despacho: cot.despacho,
        total: cot.total, es_mayorista: cot.esMayorista,
      };
      pedidos.push(fila);
      return { id: fila.id, codigo, subtotal: fila.subtotal, descuento_mayorista: fila.descuento_mayorista, costo_despacho: fila.costo_despacho, total: fila.total, es_mayorista: fila.es_mayorista };
    },
    async registrarInteraccion(fila) { interacciones.push(fila); },
  };
}
