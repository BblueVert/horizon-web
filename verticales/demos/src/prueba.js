// Prueba de 15 días de Mesa Cero creada desde el chat (ficha con "crear_prueba": true, el vendedor).
// El agente junta los datos y manda "accion": { tipo: "prueba", datos: {...} }; acá se llama a la misma
// API que usa el formulario de la web (mesa-cero /api/prueba). El WhatsApp es el del chat: no se pregunta.

import { config } from './config.js';

export const RUBROS_PRUEBA = ['hamburgueseria', 'sangucheria', 'sushi', 'pizzeria', 'cafeteria', 'otro'];
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lo que falta para crearla (vacío = lista). Así el bot no llama a la API con datos a medias.
export function faltanDatos(d = {}) {
  const falta = [];
  if (!String(d.local || '').trim()) falta.push('el nombre del local');
  if (!String(d.nombre || '').trim()) falta.push('tu nombre');
  if (!CORREO.test(String(d.email || '').trim())) falta.push('tu correo');
  return falta;
}

export async function crearPruebaReal(d, telefono) {
  const rubro = RUBROS_PRUEBA.includes(d.rubro) ? d.rubro : 'otro';
  const headers = { 'Content-Type': 'application/json' };
  if (config.mesaCeroWeb.token) headers['x-bot-token'] = config.mesaCeroWeb.token;
  const res = await fetch(`${config.mesaCeroWeb.url}/api/prueba`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      local: String(d.local).trim(), nombre: String(d.nombre).trim(), email: String(d.email).trim(),
      whatsapp: '+' + String(telefono).replace(/\D/g, ''), rubro, comuna: String(d.comuna || '').trim(), origen: 'whatsapp',
    }),
    signal: AbortSignal.timeout(30000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.slug) throw new Error(j.error || `Mesa Cero respondió ${res.status}`);
  return { ...j, panelUrl: `${config.mesaCeroWeb.url}${j.panel || `/admin/dashboard.html?t=${j.slug}`}` };
}
