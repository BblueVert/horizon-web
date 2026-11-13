// Servidor HTTP del agente. El puente (o n8n, o cualquier canal) hace:
//   POST /mensaje  { telefono, mensaje, canal? }  →  { replyChunks: [...], pedido }
// Header obligatorio si AGENTE_TOKEN está definido: x-agente-token.

import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { crearDb } from './db/index.js';
import { crearAgente } from './agente.js';
import { extraer } from './llm.js';

const db = crearDb();
const agente = crearAgente({ db, extraer });

// Una conversación a la vez por teléfono: dos mensajes seguidos no pisan el carrito.
const colas = new Map();
function enCola(clave, tarea) {
  const previa = colas.get(clave) || Promise.resolve();
  const actual = previa.catch(() => {}).then(tarea);
  colas.set(clave, actual);
  actual.finally(() => { if (colas.get(clave) === actual) colas.delete(clave); });
  return actual;
}

function tokenValido(req) {
  if (!config.agente.token) return true;
  const a = Buffer.from(String(req.headers['x-agente-token'] || ''));
  const b = Buffer.from(config.agente.token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function responder(res, status, cuerpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(cuerpo));
}

async function leerJson(req) {
  let datos = '';
  for await (const parte of req) {
    datos += parte;
    if (datos.length > 64 * 1024) throw new Error('cuerpo muy grande');
  }
  return JSON.parse(datos || '{}');
}

const servidor = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/salud') {
      const { negocio, catalogo } = await agente.catalogoActual();
      return responder(res, 200, { ok: true, negocio: negocio.nombre, productos: catalogo.productos.length, db: config.db.modo });
    }
    if (req.method === 'POST' && req.url === '/mensaje') {
      if (!tokenValido(req)) return responder(res, 401, { error: 'token inválido' });
      const body = await leerJson(req);
      const telefono = String(body.telefono || body.phone || '').trim();
      const mensaje = String(body.mensaje || body.text || '').trim();
      if (!telefono || !mensaje) return responder(res, 400, { error: 'faltan telefono o mensaje' });
      const out = await enCola(telefono, () => agente.manejarMensaje({ telefono, mensaje, canal: body.canal || 'whatsapp' }));
      return responder(res, 200, out);
    }
    responder(res, 404, { error: 'no existe' });
  } catch (e) {
    console.error('[servidor]', e);
    responder(res, 500, { error: 'error interno', replyChunks: ['Perdona, tuve un problema. ¿Me escribes de nuevo en un momento?'] });
  }
});

servidor.listen(config.agente.puerto, () => {
  console.log(`[agente] escuchando en http://localhost:${config.agente.puerto} (db: ${config.db.modo})`);
  if (!config.agente.token) console.warn('[agente] AGENTE_TOKEN vacío: cualquiera en la red puede hablarle al agente.');
});
