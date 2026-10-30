// Qué demo atiende cada chat, su historial y las pausas. Se guarda en datos/estado.json
// para que un reinicio del bot no corte una demo a la mitad.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';

export function crearEstado(ruta = join(config.bot.carpetaDatos, 'estado.json')) {
  let chats = {};
  // Demo "armada" desde tu chat: la toma el próximo chat nuevo que escriba (una sola vez).
  let armada = null;
  try {
    if (existsSync(ruta)) ({ chats = {}, armada = null } = JSON.parse(readFileSync(ruta, 'utf8')));
  } catch {}
  let timer = null;

  function guardar() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      mkdirSync(config.bot.carpetaDatos, { recursive: true });
      writeFileSync(ruta, JSON.stringify({ chats, armada }, null, 1));
    }, 500);
  }

  const vencido = (c) => c.asignadoEn && Date.now() - c.asignadoEn > config.bot.venceHoras * 3600_000;

  return {
    demoDe(jid) {
      const c = chats[jid];
      if (!c?.slug) return null;
      if (vencido(c)) { delete chats[jid]; guardar(); return null; }
      return c.slug;
    },
    asignar(jid, slug, telefono) {
      chats[jid] = { slug, telefono, asignadoEn: Date.now(), historial: [] };
      guardar();
    },
    soltar(jid) { delete chats[jid]; guardar(); },
    soltarTodos() { const n = Object.keys(chats).length; chats = {}; guardar(); return n; },
    historial(jid) { return chats[jid]?.historial || []; },
    agregarTurno(jid, usuario, asistente) {
      const c = chats[jid];
      if (!c) return;
      c.historial.push({ role: 'user', content: usuario }, { role: 'assistant', content: asistente });
      c.historial = c.historial.slice(-config.bot.historial);
      guardar();
    },
    pausar(jid, hasta) { if (chats[jid]) { chats[jid].pausaHasta = hasta; guardar(); } },
    enPausa(jid) {
      const h = chats[jid]?.pausaHasta;
      if (!h) return false;
      if (h === 'siempre' || Date.now() < h) return true;
      delete chats[jid].pausaHasta;
      return false;
    },
    activos() { return Object.entries(chats).filter(([, c]) => c.slug && !vencido(c)); },
    armar(slug, minutos) { armada = { slug, hasta: Date.now() + minutos * 60000 }; guardar(); },
    armada() {
      if (armada && Date.now() > armada.hasta) { armada = null; guardar(); }
      return armada?.slug || null;
    },
    // Entrega la demo armada a quien la pide y la desarma (la toma un solo chat).
    tomarArmada() { const s = this.armada(); if (s) { armada = null; guardar(); } return s; },
    desarmar() { const habia = !!armada; armada = null; guardar(); return habia; },
  };
}
