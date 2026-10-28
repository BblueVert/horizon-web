// Lógica de chats, separada de Baileys para poder probarla.
// Devuelve siempre una lista de mensajes a enviar: [{ jid, texto }].

import { config } from './config.js';
import { codigoDemo, linkDemo } from './ficha.js';
import { responder as responderIA, avisoDueno } from './agente.js';

const AYUDA = [
  '*Comandos del bot de demos* (escríbelos desde este teléfono):',
  '• #demos → lista de demos con su link · #demos recargar → vuelve a leer las fichas',
  '• #demo <slug> → en un chat: conecta ese chat a la demo (aquí mismo, para probarla tú)',
  '• #demo off → desconecta el chat · #demo off todos → todos',
  '• #bot off / #bot on → silencia o reactiva el bot en un chat',
].join('\n');

export function crearConversacion({ estado, fichas, responder = responderIA, registrarAccion = async () => {}, log = console }) {
  let yo = null;      // jid del chat contigo mismo
  let numero = '';    // número vinculado (para los links)

  const aYo = (texto) => (yo ? [{ jid: yo, texto }] : []);

  async function turno(jid, telefono, texto, ficha) {
    let r;
    try {
      r = await responder(ficha, estado.historial(jid), texto);
    } catch (e) {
      log.error(`[demo ${ficha.slug}] IA falló:`, e.message);
      return [{ jid, texto: 'Perdona, se me cruzó algo. ¿Me lo repites?' }];
    }
    estado.agregarTurno(jid, texto, JSON.stringify(r));
    const salida = r.respuestas.map(t => ({ jid, texto: t }));
    if (r.accion) {
      const aviso = avisoDueno(ficha, r.accion, telefono);
      if (['chat', 'ambos'].includes(config.bot.aviso)) salida.push({ jid, texto: `📲 _Así le llegaría este aviso al dueño de ${ficha.nombre}:_\n\n${aviso}` });
      if (['yo', 'ambos'].includes(config.bot.aviso) && jid !== yo) salida.push(...aYo(aviso));
      registrarAccion({ slug: ficha.slug, telefono, ...r.accion }).catch(e => log.warn('[demo] no se registró la acción:', e.message));
    }
    return salida;
  }

  // Mensaje de un cliente/prospecto (o tuyo en tu propio chat, si lo conectaste a una demo).
  async function entrante({ jid, telefono, texto }) {
    let slug = estado.demoDe(jid);
    const codigo = codigoDemo(texto);

    if (codigo && codigo !== slug) {
      const ficha = fichas.obtener(codigo);
      if (!ficha) {
        return [
          { jid, texto: 'Esa demo no está disponible en este momento. Si te la mostró alguien de HORIZON, pídele que la active de nuevo 🙂' },
          ...aYo(`⚠️ +${telefono} pidió la demo "${codigo}", que no existe o no está activa.`),
        ];
      }
      estado.asignar(jid, codigo, telefono);
      const salida = await turno(jid, telefono, 'Hola', ficha);
      if (jid !== yo) salida.push(...aYo(`▶️ +${telefono} empezó la demo de ${ficha.nombre}.`));
      return salida;
    }

    if (!slug && config.bot.porDefecto && fichas.obtener(config.bot.porDefecto)) {
      estado.asignar(jid, config.bot.porDefecto, telefono);
      slug = config.bot.porDefecto;
    }
    if (!slug || estado.enPausa(jid)) return [];
    const ficha = fichas.obtener(slug);
    if (!ficha) return [];
    return turno(jid, telefono, texto, ficha);
  }

  // Mensaje escrito desde el teléfono vinculado (Benja o alguien de HORIZON).
  async function delLocal({ jid, texto, telefono }) {
    const t = String(texto || '').trim();
    const tl = t.toLowerCase();

    if (tl === '#demos' || tl === '#ayuda') {
      const lista = fichas.todas().map(f => `• *${f.nombre}* (${f.slug})\n  ${linkDemo(numero, f)}`).join('\n');
      const activos = estado.activos().length;
      return aYo(`${lista || 'No hay demos cargadas.'}\n\nChats en demo ahora: ${activos}\n\n${AYUDA}`);
    }
    if (tl === '#demos recargar') {
      fichas.cargarLocales?.();
      await fichas.sincronizar?.().catch(() => {});
      return aYo(`Fichas recargadas: ${fichas.todas().length} demos.`);
    }
    if (tl === '#demo off todos') return aYo(`Listo, desconecté ${estado.soltarTodos()} chats de sus demos.`);
    if (tl === '#demo off') { estado.soltar(jid); return aYo('Chat desconectado de la demo.'); }
    if (tl === '#bot off') { estado.pausar(jid, 'siempre'); return aYo('Bot silenciado en ese chat. #bot on para reactivarlo.'); }
    if (tl === '#bot on') { estado.pausar(jid, null); return aYo('Bot reactivado en ese chat.'); }

    const m = tl.match(/^#demo\s+([a-z0-9][a-z0-9-]{1,40})$/);
    if (m) {
      const ficha = fichas.obtener(m[1]);
      if (!ficha) return aYo(`No tengo la demo "${m[1]}". Escribe #demos para ver las disponibles.`);
      estado.asignar(jid, ficha.slug, telefono);
      const salida = await turno(jid, telefono, 'Hola', ficha);
      if (jid !== yo) salida.push(...aYo(`Chat conectado a la demo de ${ficha.nombre}.`));
      return salida;
    }

    // En tu propio chat, si está conectado a una demo, tú haces de cliente.
    if (jid === yo) return estado.demoDe(jid) ? entrante({ jid, telefono, texto: t }) : [];

    // Alguien del local respondió a mano en un chat de demo: el bot se calla un rato.
    if (estado.demoDe(jid) && !estado.enPausa(jid)) estado.pausar(jid, Date.now() + config.bot.pausaHumanoMin * 60000);
    return [];
  }

  function fichaLista(ficha, esNueva) {
    return aYo(`${esNueva ? '✅ Demo lista' : '🔄 Demo actualizada'}: *${ficha.nombre}*\n${linkDemo(numero, ficha)}\n\nPruébala aquí con: #demo ${ficha.slug}`);
  }

  return {
    entrante,
    delLocal,
    fichaLista,
    conectado(jidPropio, numeroPropio) { yo = jidPropio; numero = numeroPropio; },
    get yo() { return yo; },
  };
}
