'use strict';

// Lo que toman las demos (web /demo/<slug> y bot de WhatsApp) → panel real de Mesa Cero.
// Cada demo es un tenant "demo-<slug>" en el Supabase de Mesa Cero, con el panel del dueño en
// https://mesa-cero.vercel.app/panel/demo-<slug>: pedidos y caja (restaurantes y tiendas) o
// agenda de reservas y consultas (servicios, automotora).
// Usa demo_horizon_sync/_rubro/_pedido/_accion de ese proyecto
// (mesa-cero: supabase-migration-demos-horizon*.sql), que solo aceptan estos slugs.
// La anon key de Mesa Cero es pública (va en su front); se puede cambiar por env.

const { httpsRequest } = require('./shared');

const MC_URL = process.env.MESA_CERO_SUPABASE_URL || 'https://wpljybwutgxvjjlmbdxc.supabase.co';
const MC_KEY = process.env.MESA_CERO_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbGp5Ynd1dGd4dmpqbG1iZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NjI5MDIsImV4cCI6MjEwMzUzODkwMn0.bGCgjoMqTwO-NQ0DZJQtcVyAn1r-e_1IW24BLR1qrcY';
const MC_PANEL = process.env.MESA_CERO_PANEL_URL || 'https://mesa-cero.vercel.app';
const SLUGS = ['hamburgueseria', 'sushi', 'sangucheria', 'pasteleria-cafe', 'pasteleria', 'cafeteria', 'floreria', 'ropa',
  'barberia', 'estetica', 'dental', 'clinica-dental', 'centro-dental', 'kine', 'veterinaria', 'gimnasio', 'automotora', 'general'];

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
async function sincronizar(ficha) {
  const { slug, nombre, color, descripcion, horario, locales, catalogo, flujo, rubro } = ficha;
  await rpc('demo_horizon_sync', { p_slug: slug, p_ficha: { nombre, color, descripcion, horario, locales, catalogo, flujo, rubro } });
  // El rubro adapta el menú del panel; si falla, el pedido igual entra.
  await rpc('demo_horizon_rubro', { p_slug: slug, p_ficha: { flujo, rubro } }).catch(e => console.error('mesa-cero rubro:', e.message));
}

async function enviarPedido(ficha, pedido) {
  const slug = ficha && ficha.slug;
  if (!esTenant(slug)) return null;
  try {
    await sincronizar(ficha);
    const items = Array.isArray(pedido.items) && pedido.items.length ? pedido.items : itemsDeDetalle(pedido.detalle);
    return await rpc('demo_horizon_pedido', { p_slug: slug, p_pedido: { ...pedido, items } });
  } catch (e) {
    console.error('mesa-cero demo:', e.message);
    return null;
  }
}

// Reserva, consulta o "quiere hablar con alguien" → agenda del panel (rest_solicitudes).
// accion: { tipo, codigo, canal, cliente, telefono, detalle, cuando, total, resumen }
async function enviarAccion(ficha, accion) {
  const slug = ficha && ficha.slug;
  if (!esTenant(slug) || !['reserva', 'consulta', 'derivar'].includes(accion.tipo)) return null;
  try {
    await sincronizar(ficha);
    return await rpc('demo_horizon_accion', { p_slug: slug, p_accion: accion });
  } catch (e) {
    console.error('mesa-cero demo:', e.message);
    return null;
  }
}

// Cualquier acción del agente (formato de verticales/demos/src/agente.js) al panel que corresponde.
function enviarDelAgente(ficha, accion, { telefono, canal }) {
  const d = (accion && accion.datos) || {};
  if (!accion) return null;
  if (accion.tipo === 'pedido') {
    return enviarPedido(ficha, {
      codigo: accion.codigo || d.codigo, canal, cliente: d.cliente, telefono, direccion: d.direccion, hora: d.hora,
      entrega: /deliv|despacho/i.test(String(d.entrega || '')) ? 'delivery' : 'retiro',
      total: Number(String(d.total || '').replace(/\D/g, '')) || 0, detalle: d.detalle || accion.resumen,
    });
  }
  return enviarAccion(ficha, {
    tipo: accion.tipo, codigo: accion.codigo || d.codigo, canal, cliente: d.cliente, telefono,
    detalle: d.detalle, cuando: d.hora, total: d.total, resumen: [accion.resumen, d.otros].filter(Boolean).join(' · '),
  });
}

module.exports = { enviarPedido, enviarAccion, enviarDelAgente, panelUrl, esTenant, itemsDeDetalle };
