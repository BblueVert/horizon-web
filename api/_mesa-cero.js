'use strict';

// Pedidos de las demos (web /demo/<slug> y bot de WhatsApp) → panel real de Mesa Cero.
// Cada demo de pedidos es un tenant "demo-<slug>" en el Supabase de Mesa Cero: el panel del
// dueño queda en https://mesa-cero.vercel.app/panel/demo-<slug> (pedidos, clientes, caja).
// Usa las funciones demo_horizon_sync() y demo_horizon_pedido() de ese proyecto
// (mesa-cero: supabase-migration-demos-horizon.sql), que solo aceptan estos slugs.
// La anon key de Mesa Cero es pública (va en su front); se puede cambiar por env.

const { httpsRequest } = require('./shared');

const MC_URL = process.env.MESA_CERO_SUPABASE_URL || 'https://wpljybwutgxvjjlmbdxc.supabase.co';
const MC_KEY = process.env.MESA_CERO_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbGp5Ynd1dGd4dmpqbG1iZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NjI5MDIsImV4cCI6MjEwMzUzODkwMn0.bGCgjoMqTwO-NQ0DZJQtcVyAn1r-e_1IW24BLR1qrcY';
const MC_PANEL = process.env.MESA_CERO_PANEL_URL || 'https://mesa-cero.vercel.app';
const SLUGS = ['hamburgueseria', 'sushi', 'sangucheria', 'pasteleria-cafe', 'pasteleria', 'cafeteria', 'floreria', 'ropa'];

const esTenant = (slug) => SLUGS.includes(slug);
const panelUrl = (slug) => (esTenant(slug) ? `${MC_PANEL}/panel/demo-${slug}` : null);

async function rpc(fn, body) {
  const r = await httpsRequest('POST', `${MC_URL}/rest/v1/rpc/${fn}`,
    { apikey: MC_KEY, Authorization: 'Bearer ' + MC_KEY, 'Content-Type': 'application/json' }, body, 8000);
  if (r.status >= 300) throw new Error(`mesa-cero ${fn} ${r.status}: ${String(r.body).slice(0, 200)}`);
  return JSON.parse(r.body || 'null');
}

// "2 × Cortado, 1 × Americano (grande)" → [{ nombre, cant }]
function itemsDeDetalle(detalle) {
  return String(detalle || '').split(/,|\n|\s\+\s/).map(s => s.trim()).filter(Boolean).map(s => {
    const m = s.match(/^(\d{1,2})\s*[×xX*]\s*(.+)$/);
    return m ? { nombre: m[2].trim(), cant: Number(m[1]) } : { nombre: s, cant: 1 };
  }).slice(0, 30);
}

// pedido: { codigo, canal: 'web'|'whatsapp', entrega, cliente, telefono, direccion, hora, total, items?, detalle? }
// Nunca rompe el flujo de la demo: si Mesa Cero falla, se registra en el log y sigue.
async function enviarPedido(ficha, pedido) {
  const slug = ficha && ficha.slug;
  if (!esTenant(slug)) return null;
  try {
    const { nombre, color, descripcion, horario, locales, catalogo } = ficha;
    await rpc('demo_horizon_sync', { p_slug: slug, p_ficha: { nombre, color, descripcion, horario, locales, catalogo } });
    const items = Array.isArray(pedido.items) && pedido.items.length ? pedido.items : itemsDeDetalle(pedido.detalle);
    return await rpc('demo_horizon_pedido', { p_slug: slug, p_pedido: { ...pedido, items } });
  } catch (e) {
    console.error('mesa-cero demo:', e.message);
    return null;
  }
}

module.exports = { enviarPedido, panelUrl, esTenant, itemsDeDetalle };
