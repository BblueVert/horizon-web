// Bot de demos: un solo número (Horizon Pruebas) atiende varias demos a la vez,
// una por chat. Los chats sin demo asignada no se responden.
//   npm start → escanea el QR con el WhatsApp de Horizon Pruebas.

import makeWASocket, {
  Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState,
  isJidGroup, isJidBroadcast, isJidNewsletter, isJidStatusBroadcast, isLidUser,
  jidDecode, jidNormalizedUser, normalizeMessageContent, downloadMediaMessage,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { readFileSync } from 'node:fs';
import pino from 'pino';
import { config } from './config.js';
import { crearFichas } from './fichas.js';
import { crearEstado } from './estado.js';
import { crearConversacion } from './conversacion.js';

const logger = pino({ level: process.env.LOG_NIVEL || 'warn' });
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

let sock = null;
const enviadosPorBot = new Set();
const buffers = new Map();
const colas = new Map();

async function registrarAccion(accion) {
  if (!config.api.token) return;
  await fetch(`${config.api.url}?accion=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.api.token}` },
    body: JSON.stringify(accion),
    signal: AbortSignal.timeout(10000),
  });
}

const estado = crearEstado();
const fichas = crearFichas({ alNueva: (f, esNueva) => enviarTodo(conv.fichaLista(f, esNueva)) });
const conv = crearConversacion({ estado, fichas, registrarAccion });

function encolar(jid, tarea) {
  const previa = colas.get(jid) || Promise.resolve();
  const actual = previa.catch(() => {}).then(tarea).catch(e => console.error('[bot]', e.message));
  colas.set(jid, actual);
  actual.finally(() => { if (colas.get(jid) === actual) colas.delete(jid); });
}

async function enviar(jid, texto, ubicacion, imagen) {
  if (!sock) return;
  await sock.sendPresenceUpdate('composing', jid).catch(() => {});
  await esperar(ubicacion || imagen ? 900 : Math.min(3000, 600 + texto.length * 20));
  const contenido = imagen
    ? { image: readFileSync(imagen), ...(texto ? { caption: texto } : {}) }
    : ubicacion
      ? { location: { degreesLatitude: ubicacion.lat, degreesLongitude: ubicacion.lng, name: ubicacion.nombre, address: ubicacion.direccion } }
      : { text: texto };
  const m = await sock.sendMessage(jid, contenido);
  if (m?.key?.id) enviadosPorBot.add(m.key.id);
  if (enviadosPorBot.size > 5000) enviadosPorBot.clear();
}

function enviarTodo(mensajes) {
  for (const { jid, texto, ubicacion, imagen } of mensajes) encolar(jid, () => enviar(jid, texto, ubicacion, imagen));
}

function telefonoDe(key) {
  const jid = isLidUser(key.remoteJid) && key.remoteJidAlt ? key.remoteJidAlt : key.remoteJid;
  return jidDecode(jid)?.user || jid;
}

function textoDe(m) {
  const c = normalizeMessageContent(m.message);
  return c?.conversation || c?.extendedTextMessage?.text || c?.imageMessage?.caption || c?.videoMessage?.caption || null;
}

function esChatPropio(jid) {
  const u = sock?.user;
  if (!u) return false;
  return [u.id, u.lid].filter(Boolean).some(x => jidNormalizedUser(x) === jidNormalizedUser(jid));
}

// Audio de un cliente: se entrega al motor, que lo transcribe e interpreta en el flujo de n8n.
const MAX_SEGUNDOS_AUDIO = 180;
function alRecibirAudio(m, jid, nota) {
  const telefono = telefonoDe(m.key);
  encolar(jid, async () => {
    await sock.readMessages([m.key]).catch(() => {});
    if (Number(nota.seconds) > MAX_SEGUNDOS_AUDIO) {
      return enviarTodo([{ jid, texto: 'Ese audio está muy largo para mí 😅 ¿Me lo resumes en uno más corto o me lo escribes?' }]);
    }
    try {
      const datos = await downloadMediaMessage(m, 'buffer', {});
      await sock.sendPresenceUpdate('composing', jid).catch(() => {});
      enviarTodo(await conv.entrante({ jid, telefono, texto: '', audio: { base64: datos.toString('base64'), mime: nota.mimetype || 'audio/ogg' } }));
    } catch (e) {
      console.error('[bot] audio:', e.message);
      enviarTodo([{ jid, texto: 'No pude escuchar tu audio 😕 ¿Me lo mandas de nuevo o me lo escribes?' }]);
    }
  });
}

function alRecibir(m) {
  const jid = m.key.remoteJid;
  if (!jid || !m.message) return;
  if (isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid) || isJidStatusBroadcast(jid)) return;
  if (m.key.fromMe && enviadosPorBot.has(m.key.id)) return;
  const nota = normalizeMessageContent(m.message)?.audioMessage;
  if (nota && !m.key.fromMe) return alRecibirAudio(m, jid, nota);
  const texto = textoDe(m);
  if (!texto) return;
  const telefono = telefonoDe(m.key);
  const propio = esChatPropio(jid);

  // Comandos y mensajes tuyos: al tiro, sin agrupar.
  if (m.key.fromMe) {
    encolar(jid, async () => enviarTodo(await conv.delLocal({ jid: propio ? conv.yo : jid, texto, telefono })));
    return;
  }

  // Mensajes de clientes: se juntan los que llegan seguidos.
  const b = buffers.get(jid) || { textos: [], claves: [], timer: null, desde: Date.now() };
  b.textos.push(texto.trim());
  b.claves.push(m.key);
  b.responder = () => {
    buffers.delete(jid);
    encolar(jid, async () => {
      await sock.readMessages(b.claves).catch(() => {});
      const salida = await conv.entrante({ jid, telefono, texto: b.textos.join('\n') });
      if (salida.length) await sock.sendPresenceUpdate('composing', jid).catch(() => {});
      enviarTodo(salida);
    });
  };
  buffers.set(jid, b);
  programarRespuesta(b);
  sock.presenceSubscribe(jid).catch(() => {}); // para saber si sigue escribiendo
}

// Espera normal; si el cliente sigue escribiendo o grabando, se alarga hasta un tope.
const MAX_ESPERA_ESCRIBIENDO_MS = 45000;
function programarRespuesta(b, espera = config.bot.esperaAgruparMs) {
  clearTimeout(b.timer);
  const queda = MAX_ESPERA_ESCRIBIENDO_MS - (Date.now() - b.desde);
  b.timer = setTimeout(b.responder, Math.max(0, Math.min(espera, queda)));
}

function alCambiarPresencia({ id, presences }) {
  const b = buffers.get(id);
  if (!b) return;
  const estado = Object.values(presences || {})[0]?.lastKnownPresence;
  if (estado === 'composing' || estado === 'recording') programarRespuesta(b, 15000); // WhatsApp no avisa siempre que dejó de escribir
  else if (estado === 'paused') programarRespuesta(b);
}

let intentos = 0;
let fichasIniciadas = false;

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState(config.bot.carpetaSesion);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  sock = makeWASocket({ version, auth: state, logger, browser: Browsers.macOS('HORIZON Demos'), markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('presence.update', alCambiarPresencia);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nEscanea con el WhatsApp de Horizon Pruebas (Dispositivos vinculados → Vincular dispositivo):\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      intentos = 0;
      const numero = jidDecode(sock.user.id)?.user || '';
      conv.conectado(jidNormalizedUser(sock.user.id), numero);
      fichas.ponerNumero(numero);
      if (!fichasIniciadas) { fichas.iniciar(); fichasIniciadas = true; }
      console.log(`[bot] conectado como +${numero}. Demos cargadas: ${fichas.todas().length}`);
      enviarTodo([{ jid: conv.yo, texto: `🤖 Bot de demos conectado. ${fichas.todas().length} demos disponibles. Escribe #demos para verlas.` }]);
    }
    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      if (codigo === DisconnectReason.loggedOut) {
        console.error(`[bot] sesión cerrada desde el teléfono. Borra ${config.bot.carpetaSesion} y vuelve a escanear.`);
        process.exit(1);
      }
      const espera = Math.min(30000, 2000 * 2 ** intentos++);
      console.warn(`[bot] conexión cerrada (${codigo || 'sin código'}), reintento en ${espera / 1000}s`);
      setTimeout(() => conectar().catch(e => console.error('[bot]', e)), espera);
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    // Lo que manda el propio bot llega como 'append'; lo que escribe una persona, como 'notify'.
    if (type !== 'notify') return;
    for (const m of messages) {
      try { alRecibir(m); } catch (e) { console.error('[bot]', e); }
    }
  });
}

conectar().catch(e => { console.error('[bot] no pudo iniciar:', e); process.exit(1); });
