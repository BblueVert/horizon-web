// Lógica de chats, separada de Baileys para poder probarla.
// Devuelve siempre una lista de mensajes a enviar: [{ jid, texto }].

import { config } from './config.js';
import { codigoDemo, linkDemo } from './ficha.js';
import { responder as responderIA, avisoDueno, extrasConfirmacion } from './agente.js';
import { mapaDe } from './ficha.js';
import { responderMotor as motorReal } from './motores.js';
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

// Imágenes de la carta de una demo: fichas/cartas/<slug>/*.jpg|png|webp, en orden de nombre.
function cartaLocal(slug) {
  const dir = join(config.bot.carpetaFichas, 'cartas', slug);
  try { return readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort().map(f => join(dir, f)); } catch { return []; }
}
// "¿me mandas la carta?", "el menú", "qué tienen", "las fotos": se mandan las imágenes.
// \b no sirve con tildes ("menú" no calzaba). "el 20 de la carta" o "qué tienen de postre" no la piden.
const PIDE_CARTA = /(?<![\p{L}\p{N}])(carta|men[uú]|im[aá]gen(es)?|fotos?|qu[eé] (\p{L}+ )?(tienen|venden|hay))(?![\p{L}\p{N}])/iu;
const SIGUE_PREGUNTANDO = /^\s*(y\s+(de|las?|los?)|de)\s/i; // "y de sushi burgers", "y las promos"
const PREGUNTA_ACOTADA =/qu[eé] (tienen|venden|hay)\s+(de|con|sin|para)(?![\p{L}])/iu; // "qué tienen de postre" no es toda la carta
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Si nombra una parte ("rolls", "promos"), solo esa imagen: la que tiene esa palabra en su nombre de archivo.
function imagenesDelTema(texto, imagenes) {
  const elegidas = new Set();
  for (const palabra of sinTildes(texto).split(/[^a-z0-9]+/)) {
    const raiz = palabra.replace(/s$/, '');
    if (raiz.length < 4) continue;
    const calzan = imagenes.filter(f => sinTildes(basename(f).replace(/\.\w+$/, '')).includes(raiz));
    if (calzan.length === 1) elegidas.add(calzan[0]);
  }
  return imagenes.filter(f => elegidas.has(f));
}
// { imagenes, completa }: completa = toda la carta, va en vez del texto de la IA.
function cartaPedida(texto, imagenes) {
  if (/\d/.test(texto)) return { imagenes: [], completa: false };
  const tema = imagenesDelTema(texto, imagenes);
  const pide = PIDE_CARTA.test(texto);
  if (!pide && !(SIGUE_PREGUNTANDO.test(texto) && tema.length)) return { imagenes: [], completa: false };
  if (tema.length) return { imagenes: tema, completa: false };
  return PREGUNTA_ACOTADA.test(texto) ? { imagenes: [], completa: false } : { imagenes, completa: imagenes.length > 0 };
}

const AYUDA = [
  '*Comandos del bot de demos* (escríbelos desde este teléfono):',
  '• #demos → lista de demos con su link · #demos recargar → vuelve a leer las fichas',
  `• #<slug> o #demo <slug> aquí → deja la demo activada: el próximo número nuevo que le escriba a este WhatsApp (en ${config.bot.armadaMin} min) queda conectado a ella (ej. #cafeteria, #tia-julia)`,
  '• #<slug> en el chat de un cliente → conecta ese chat a la demo',
  '• #demo off → desconecta el chat (aquí: desactiva la demo pendiente) · #demo off todos → todos',
  '• #bot off / #bot on → silencia o reactiva el bot en un chat',
].join('\n');

export function crearConversacion({ estado, fichas, responder = responderIA, responderMotor = motorReal, registrarAccion = async () => {}, cartaDe = cartaLocal, log = console }) {
  let yo = null;      // jid del chat contigo mismo
  let numero = '';    // número vinculado (para los links)

  const aYo = (texto) => (yo ? [{ jid: yo, texto }] : []);

  async function turno(jid, telefono, textoEscrito, ficha, audio) {
    // Los audios los transcribe e interpreta el motor (flujo n8n); la IA genérica solo lee texto.
    if (audio && !ficha.motor) return [{ jid, texto: 'Por ahora solo puedo leer mensajes escritos. ¿Me lo escribes? 🙏' }];
    let r;
    try {
      r = ficha.motor
        ? await responderMotor(ficha.motor, telefono, textoEscrito, ficha, audio)
        : await responder(ficha, estado.historial(jid), textoEscrito);
    } catch (e) {
      log.error(`[demo ${ficha.slug}] ${ficha.motor ? `motor ${ficha.motor}` : 'IA'} falló:`, e.message);
      return [{ jid, texto: 'Perdona, se me cruzó algo. ¿Me lo repites?' }];
    }
    const texto = r.transcripcion || textoEscrito; // en un audio, lo que dijo el cliente
    estado.agregarTurno(jid, texto, JSON.stringify(r));
    // Toda la carta va en vez del texto de la IA; una parte va antes de sus recomendaciones.
    const { imagenes, completa } = cartaPedida(texto, cartaDe(ficha.slug));
    const fotos = imagenes.map((imagen, i) => ({ jid, imagen, texto: i === 0 ? `📋 Carta de ${ficha.nombre}` : '' }));
    const salida = completa
      ? [{ jid, texto: '¡Altiro! Te mando la carta 👇' }, ...fotos]
      : [...fotos, ...r.respuestas.map(t => ({ jid, texto: t }))];
    if (r.ubicacion) salida.push(...ubicacion(jid, ficha));
    if (completa) salida.push({ jid, texto: 'Cuéntame qué te tinca 🙂' });
    // Reclamo: le llega al dueño del local; sin su número configurado, a tu chat (demos con prospectos).
    if (r.avisoDueno) {
      salida.push(...(r.avisoDestino ? [{ jid: `${r.avisoDestino}@s.whatsapp.net`, texto: r.avisoDueno }] : aYo(r.avisoDueno)));
    }
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

  // Mensaje de un cliente/prospecto. Tu chat contigo mismo nunca hace de demo: ahí solo llegan avisos.
  async function entrante({ jid, telefono, texto, audio }) {
    if (jid === yo) return [];
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

    // Demo activada desde tu chat (#slug): la toma el primer chat que escribe sin una demo en curso
    // (sin demo, o con una que lleva 30 min sin mensajes, como tu número personal de una prueba anterior).
    if ((!slug || estado.inactivo(jid, 30)) && estado.armada()) {
      const ficha = fichas.obtener(estado.armada());
      if (ficha) {
        estado.tomarArmada();
        estado.asignar(jid, ficha.slug, telefono);
        const salida = await turno(jid, telefono, texto, ficha, audio);
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
    return turno(jid, telefono, texto, ficha, audio);
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
        estado.soltar(yo); // por si quedó conectado a una demo de antes
        estado.armar(ficha.slug, config.bot.armadaMin);
        return aYo(`✅ Demo activada: *${ficha.nombre}*\nEscríbele a este WhatsApp desde otro número (o comparte el link) en los próximos ${config.bot.armadaMin} min: ese chat queda conectado a la demo.\n${linkDemo(numero, ficha)}`);
      }
      estado.asignar(jid, ficha.slug, telefono);
      const salida = await turno(jid, telefono, 'Hola', ficha);
      if (jid !== yo) salida.push(...aYo(`Chat conectado a la demo de ${ficha.nombre}.`));
      return salida;
    }

    // Tu chat contigo mismo no responde como demo: pruébala escribiéndole desde otro número.
    if (jid === yo) return [];

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
