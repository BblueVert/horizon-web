// Lógica de chats, separada de Baileys para poder probarla.
// Devuelve siempre una lista de mensajes a enviar: [{ jid, texto }].

import { config } from './config.js';
import { codigoDemo, linkDemo } from './ficha.js';
import { responder as responderIA, avisoDueno, extrasConfirmacion } from './agente.js';
import { mapaDe } from './ficha.js';
import { responderMotor as motorReal } from './motores.js';

const AYUDA = [
  '*Comandos del bot de demos* (escríbelos desde este teléfono):',
  '• #demos → lista de demos con su link · #demos recargar → vuelve a leer las fichas',
  `• #<slug> o #demo <slug> aquí → deja la demo activada: el próximo número nuevo que le escriba a este WhatsApp (en ${config.bot.armadaMin} min) queda conectado a ella (ej. #cafeteria, #tia-julia)`,
  '• #<slug> en el chat de un cliente → conecta ese chat a la demo',
  '• #demo off → desconecta el chat (aquí: desactiva la demo pendiente) · #demo off todos → todos',
  '• #bot off / #bot on → silencia o reactiva el bot en un chat',
].join('\n');

export function crearConversacion({ estado, fichas, responder = responderIA, responderMotor = motorReal, registrarAccion = async () => {}, log = console }) {
  let yo = null;      // jid del chat contigo mismo
  let numero = '';    // número vinculado (para los links)

  const aYo = (texto) => (yo ? [{ jid: yo, texto }] : []);

  async function turno(jid, telefono, texto, ficha) {
    let r;
    try {
      r = ficha.motor
        ? await responderMotor(ficha.motor, telefono, texto, ficha)
        : await responder(ficha, estado.historial(jid), texto);
    } catch (e) {
      log.error(`[demo ${ficha.slug}] ${ficha.motor ? `motor ${ficha.motor}` : 'IA'} falló:`, e.message);
      return [{ jid, texto: 'Perdona, se me cruzó algo. ¿Me lo repites?' }];
    }
    estado.agregarTurno(jid, texto, JSON.stringify(r));
    const salida = r.respuestas.map(t => ({ jid, texto: t }));
    if (r.ubicacion) salida.push(...ubicacion(jid, ficha));
    if (r.accion) {
      const extras = extrasConfirmacion(ficha, r.accion, numero);
      r.accion = extras.accion;
      salida.push(...extras.mensajes.map(t => ({ jid, texto: t })));
      const aviso = avisoDueno(ficha, r.accion, telefono);
      if (['chat', 'ambos'].includes(config.bot.aviso)) salida.push({ jid, texto: `📲 _Así le llegaría este aviso al dueño de ${ficha.nombre}:_\n\n${aviso}` });
      if (['yo', 'ambos'].includes(config.bot.aviso) && jid !== yo) salida.push(...aYo(aviso));
      registrarAccion({ slug: ficha.slug, telefono, ...r.accion }).catch(e => log.warn('[demo] no se registró la acción:', e.message));
    }
    return salida;
  }

  // Pin de WhatsApp si el local tiene coordenadas; si no, link de Google Maps.
  function ubicacion(jid, ficha) {
    const l = (ficha.locales || [])[0];
    if (!l) return [];
    if (Number.isFinite(l.lat) && Number.isFinite(l.lng)) {
      return [{ jid, ubicacion: { lat: l.lat, lng: l.lng, nombre: l.nombre ? `${ficha.nombre} · ${l.nombre}` : ficha.nombre, direccion: [l.direccion, l.comuna].filter(Boolean).join(', ') } }];
    }
    return [{ jid, texto: `📍 ${mapaDe(l)}` }];
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

    // Demo activada desde tu chat (#slug): la toma el primer chat nuevo que escribe.
    if (!slug && jid !== yo && estado.armada()) {
      const ficha = fichas.obtener(estado.armada());
      if (ficha) {
        estado.tomarArmada();
        estado.asignar(jid, ficha.slug, telefono);
        const salida = await turno(jid, telefono, texto, ficha);
        salida.push(...aYo(`▶️ +${telefono} empezó la demo de ${ficha.nombre}.`));
        return salida;
      }
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
      const lista = fichas.todas().map(f => `• *#${f.slug}* · ${f.nombre}\n  ${linkDemo(numero, f)}`).join('\n');
      const activos = estado.activos().length;
      const armada = estado.armada() ? fichas.obtener(estado.armada()) : null;
      const pendiente = armada ? `\nActivada para el próximo número: *${armada.nombre}*` : '';
      return aYo(`${lista || 'No hay demos cargadas.'}\n\nChats en demo ahora: ${activos}${pendiente}\n\n${AYUDA}`);
    }
    if (tl === '#demos recargar') {
      fichas.cargarLocales?.();
      await fichas.sincronizar?.().catch(() => {});
      return aYo(`Fichas recargadas: ${fichas.todas().length} demos.`);
    }
    if (tl === '#demo off todos') return aYo(`Listo, desconecté ${estado.soltarTodos()} chats de sus demos.`);
    if (tl === '#demo off' && jid === yo) {
      const habia = estado.desarmar();
      estado.soltar(jid);
      return aYo(habia ? 'Listo, desactivé la demo pendiente.' : 'No había ninguna demo pendiente.');
    }
    if (tl === '#demo off') { estado.soltar(jid); return aYo('Chat desconectado de la demo.'); }
    if (tl === '#bot off') { estado.pausar(jid, 'siempre'); return aYo('Bot silenciado en ese chat. #bot on para reactivarlo.'); }
    if (tl === '#bot on') { estado.pausar(jid, null); return aYo('Bot reactivado en ese chat.'); }

    // "#demo cafeteria" o el atajo "#cafeteria"
    const m = tl.match(/^#demo\s+([a-z0-9][a-z0-9-]{1,40})$/) || (fichas.obtener(tl.slice(1)) && tl.match(/^#([a-z0-9][a-z0-9-]{1,40})$/));
    if (m) {
      const ficha = fichas.obtener(m[1]);
      if (!ficha) return aYo(`No tengo la demo "${m[1]}". Escribe #demos para ver las disponibles.`);
      // En tu chat: no responde aquí, queda activada para el próximo número que escriba.
      if (jid === yo) {
        estado.armar(ficha.slug, config.bot.armadaMin);
        return aYo(`✅ Demo activada: *${ficha.nombre}*\nEscríbele a este WhatsApp desde otro número (o comparte el link) en los próximos ${config.bot.armadaMin} min: ese chat queda conectado a la demo.\n${linkDemo(numero, ficha)}`);
      }
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
