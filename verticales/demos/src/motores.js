// Fichas con "motor": el chat no lo atiende la IA genérica sino un agente real
// que ya existe y habla el mismo idioma: POST { phone, telefono, mensaje } → { replyChunks }.
//   mesa-cero  → flujo n8n wa-mesacero-v2 (pedidos con la carta real de Tía Julia)
//   minimarket → verticales/minimarket (npm run agente)
// Así un solo puente atiende el número y no hay dos bots respondiendo el mismo chat.

import { config } from './config.js';

// Para mesa-cero, "tenant" (o el slug) dice qué negocio de Supabase responde:
// cada chat puede ser un restaurante distinto sin reiniciar nada.
export async function responderMotor(nombre, telefono, mensaje, ficha = {}) {
  const url = config.motores[nombre];
  if (!url) throw new Error(`motor "${nombre}" sin URL (agrega MOTORES en .env)`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(config.motorToken ? { 'x-agente-token': config.motorToken } : {}) },
    body: JSON.stringify({ phone: telefono, telefono, mensaje, canal: 'whatsapp', tenantSlug: ficha.tenant || ficha.slug }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !Array.isArray(data.replyChunks)) throw new Error(`motor ${nombre} respondió ${res.status}`);
  const respuestas = (Array.isArray(data.replyChunks) ? data.replyChunks : []).filter(t => typeof t === 'string' && t.trim());
  return { respuestas, accion: null };
}
