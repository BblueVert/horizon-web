// Datos en Supabase vía REST (PostgREST) con la service_role key. Solo servidor.

import { config } from '../config.js';

const { supabaseUrl, serviceKey } = config.db;

async function rest(ruta, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${ruta}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const texto = await res.text();
  if (!res.ok) {
    let detalle = texto;
    try { detalle = JSON.parse(texto).message || texto; } catch {}
    throw new Error(detalle);
  }
  return texto ? JSON.parse(texto) : null;
}

const enc = encodeURIComponent;

export function crearSupabase() {
  if (!supabaseUrl || !serviceKey) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  return {
    async cargarCatalogo() {
      const [negocio, categorias, productos, escalas] = await Promise.all([
        rest('mm_negocio?id=eq.1&select=*'),
        rest('mm_categorias?select=*&order=orden'),
        rest('mm_productos?activo=eq.true&select=*&order=sku'),
        rest('mm_precios_escala?select=sku,cantidad_min,precio_unitario,etiqueta&order=cantidad_min'),
      ]);
      const porSku = new Map();
      for (const e of escalas) {
        if (!porSku.has(e.sku)) porSku.set(e.sku, []);
        porSku.get(e.sku).push({ ...e, cantidad_min: Number(e.cantidad_min) });
      }
      return {
        negocio: negocio[0],
        categorias,
        productos: productos.map(p => ({ ...p, stock: Number(p.stock), escalas: porSku.get(p.sku) || [] })),
      };
    },
    async obtenerSesion(telefono) {
      const filas = await rest(`mm_bot_sesiones?telefono=eq.${enc(telefono)}&select=contexto`);
      return filas[0]?.contexto || {};
    },
    async guardarSesion(telefono, contexto) {
      await rest('mm_bot_sesiones?on_conflict=telefono', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { telefono, contexto, updated_at: new Date().toISOString() },
      });
    },
    async obtenerCliente(telefono) {
      const filas = await rest(`mm_clientes?telefono=eq.${enc(telefono)}&select=*`);
      return filas[0] || null;
    },
    async crearPedido(pedido) {
      return rest('rpc/mm_crear_pedido', { method: 'POST', body: { p: pedido } });
    },
    async registrarInteraccion(fila) {
      await rest('mm_interacciones', { method: 'POST', prefer: 'return=minimal', body: fila });
    },
  };
}
