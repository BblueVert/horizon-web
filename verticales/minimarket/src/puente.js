// Puente WhatsApp ↔ agente con Baileys (WhatsApp Web, sin API de Meta).
// Escanea el QR con el teléfono del minimarket y el puente:
//   1. recibe cada mensaje de texto de chats individuales,
//   2. agrupa los mensajes que llegan seguidos (la gente escribe en ráfagas),
//   3. los manda a AGENTE_URL y responde cada replyChunk con "escribiendo…".
// Si alguien del local escribe a mano en un chat, el bot se calla en ese chat
// PAUSA_HUMANO_MIN minutos. "#bot off" / "#bot on" desde el teléfono lo apagan o prenden.

import makeWASocket, {
  Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState,
  isJidGroup, isJidBroadcast, isJidNewsletter, isJidStatusBroadcast, isLidUser,
  jidDecode, normalizeMessageContent,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { config } from './config.js';

const cfg = config.puente;
const logger = pino({ level: process.env.LOG_NIVEL || 'warn' });

const enviadosPorBot = new Set();   // ids de mensajes que mandó el bot (para no confundirlos con un humano)
const pausados = new Map();         // jid → timestamp hasta cuándo (Infinity = #bot off)
const buffers = new Map();          // jid → { textos, claves, timer, telefono }
const colas = new Map();            // jid → promesa (un turno a la vez por chat)
const avisadoNoTexto = new Set();

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

function telefonoDe(key) {
  // Baileys 7: los chats pueden venir con LID (@lid). El número real viene en remoteJidAlt.
  const jid = isLidUser(key.remoteJid) && key.remoteJidAlt ? key.remoteJidAlt : key.remoteJid;
  return jidDecode(jid)?.user || jid;
}

function textoDe(m) {
  const c = normalizeMessageContent(m.message);
  if (!c) return null;
  return c.conversation
    || c.extendedTextMessage?.text
    || c.imageMessage?.caption
    || c.videoMessage?.caption
    || null;
}

function enPausa(jid) {
  const hasta = pausados.get(jid);
  if (!hasta) return false;
  if (Date.now() < hasta) return true;
  pausados.delete(jid);
  return false;
}

async function llamarAgente(telefono, mensaje) {
  const res = await fetch(cfg.agenteUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agente-token': config.agente.token },
    body: JSON.stringify({ telefono, mensaje, canal: 'whatsapp' }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.replyChunks) throw new Error(`agente respondió ${res.status}`);
  return Array.isArray(data.replyChunks) ? data.replyChunks : [];
}

async function enviar(sock, jid, texto) {
  await sock.sendPresenceUpdate('composing', jid);
  await esperar(Math.min(3000, 600 + texto.length * 25));
  const enviado = await sock.sendMessage(jid, { text: texto });
  if (enviado?.key?.id) enviadosPorBot.add(enviado.key.id);
  if (enviadosPorBot.size > 5000) enviadosPorBot.clear();
}

function encolar(jid, tarea) {
  const previa = colas.get(jid) || Promise.resolve();
  const actual = previa.catch(() => {}).then(tarea);
  colas.set(jid, actual);
  actual.finally(() => { if (colas.get(jid) === actual) colas.delete(jid); });
}

async function atender(sock, jid) {
  const b = buffers.get(jid);
  buffers.delete(jid);
  if (!b || enPausa(jid)) return;
  try {
    await sock.readMessages(b.claves);
    await sock.sendPresenceUpdate('composing', jid);
    const chunks = await llamarAgente(b.telefono, b.textos.join('\n'));
    for (const c of chunks) if (!enPausa(jid)) await enviar(sock, jid, c);
  } catch (e) {
    console.error(`[puente] ${b.telefono}:`, e.message);
  } finally {
    await sock.sendPresenceUpdate('paused', jid).catch(() => {});
  }
}

function manejarDelLocal(m, jid) {
  // Mensaje escrito desde el teléfono del minimarket (no por el bot).
  if (enviadosPorBot.has(m.key.id)) return;
  const texto = (textoDe(m) || '').trim().toLowerCase();
  if (texto === '#bot off') { pausados.set(jid, Infinity); console.log(`[puente] bot apagado en ${jid}`); return; }
  if (texto === '#bot on') { pausados.delete(jid); console.log(`[puente] bot encendido en ${jid}`); return; }
  if (pausados.get(jid) !== Infinity) pausados.set(jid, Date.now() + cfg.pausaHumanoMin * 60000);
}

function manejarEntrante(sock, m) {
  const jid = m.key.remoteJid;
  if (!jid || !m.message) return;
  if (isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid) || isJidStatusBroadcast(jid)) return;
  if (m.key.fromMe) return manejarDelLocal(m, jid);

  const telefono = telefonoDe(m.key);
  if (cfg.soloNumeros.length && !cfg.soloNumeros.includes(telefono)) return;
  if (enPausa(jid)) return;

  const texto = textoDe(m);
  if (!texto) {
    if (!avisadoNoTexto.has(jid)) {
      avisadoNoTexto.add(jid);
      encolar(jid, () => enviar(sock, jid, 'Por ahora leo solo mensajes de texto ✍️ ¿Me escribes lo que necesitas?'));
    }
    return;
  }

  const b = buffers.get(jid) || { textos: [], claves: [], timer: null, telefono };
  b.textos.push(texto.trim());
  b.claves.push(m.key);
  clearTimeout(b.timer);
  b.timer = setTimeout(() => encolar(jid, () => atender(sock, jid)), cfg.esperaAgruparMs);
  buffers.set(jid, b);
}

let intentos = 0;

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState(cfg.carpetaSesion);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.macOS('Minimarket'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nEscanea este QR con WhatsApp del minimarket (Dispositivos vinculados → Vincular dispositivo):\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      intentos = 0;
      console.log(`[puente] conectado como ${sock.user?.id}. Agente: ${cfg.agenteUrl}`);
      if (cfg.soloNumeros.length) console.log(`[puente] modo demo: solo responde a ${cfg.soloNumeros.join(', ')}`);
    }
    if (connection === 'close') {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      if (codigo === DisconnectReason.loggedOut) {
        console.error(`[puente] sesión cerrada desde el teléfono. Borra ${cfg.carpetaSesion} y vuelve a escanear el QR.`);
        process.exit(1);
      }
      const espera = Math.min(30000, 2000 * 2 ** intentos++);
      console.warn(`[puente] conexión cerrada (${codigo || 'sin código'}), reintento en ${espera / 1000}s`);
      setTimeout(() => conectar().catch(e => console.error('[puente]', e)), espera);
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    // Lo que manda el propio bot llega como 'append'; lo que escribe una persona
    // (cliente o alguien del local desde el teléfono) llega como 'notify'.
    if (type !== 'notify') return;
    for (const m of messages) {
      try { manejarEntrante(sock, m); } catch (e) { console.error('[puente]', e); }
    }
  });
}

conectar().catch(e => { console.error('[puente] no pudo iniciar:', e); process.exit(1); });
