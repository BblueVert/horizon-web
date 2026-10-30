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
// Dictado o escrito de otra forma ("roles", "jan rol") sigue siendo roll; a los demás nombres se les perdona una letra.
const ES_ROLL = /^(rol|rols|role|roles|rolls?|rool|rools|rolo|rolos|rollo|rollos|rulo|rulos|handrolls?|jandrol|jandroll)$/;
function aUnaLetra(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, cambios = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++cambios > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return cambios + (a.length - i) + (b.length - j) <= 1;
}
function imagenesDelTema(texto, imagenes) {
  const elegidas = new Set();
  for (const palabra of sinTildes(texto).split(/[^a-z0-9]+/)) {
    const raiz = ES_ROLL.test(palabra) ? 'roll' : palabra.replace(/s$/, '');
    if (raiz.length < 4) continue;
    const calzan = imagenes.filter(f => {
      const nombre = sinTildes(basename(f).replace(/\.\w+$/, ''));
      return nombre.includes(raiz) || (raiz.length >= 5 && nombre.split(/[^a-z]+/).some(p => aUnaLetra(raiz, p.replace(/s$/, ''))));
    });
    if (calzan.length === 1) elegidas.add(calzan[0]);
  }
  return imagenes.filter(f => elegidas.has(f));
}
// Si ya va la imagen, no se repite la carta por escrito: la IA a veces la transcribe entera.
const MAX_LARGO_CON_FOTO = 280;
function textoConFotos(imagenes, respuestas) {
  if (!imagenes.length) return respuestas;
  const cortas = respuestas.filter(t => t.length <= MAX_LARGO_CON_FOTO);
  return cortas.length === respuestas.length && cortas.length ? cortas : ['¿Buscas algún ingrediente en particular o te recomiendo alguno? 😊'];
}
// "Te mando la carta" va antes de la imagen; el resto del mensaje, después.
const ANUNCIA_CARTA = /\b(te\s+(mando|env[ií]o|paso|dejo)|ah[ií]\s+(te\s+)?va|aqu[ií]\s+(te\s+)?(va|tienes))\b.*(?<![\p{L}])(carta|men[uú]|imagen)(?![\p{L}])/iu;
function conAnuncioPrimero(fotos, mensajes) {
  if (!fotos.length || !mensajes.length) return [...fotos, ...mensajes];
  const [primero, ...resto] = mensajes;
  return primero.texto.length <= 80 && !/\d/.test(primero.texto) && ANUNCIA_CARTA.test(primero.texto)
    ? [primero, ...fotos, ...resto]
    : [...fotos, ...mensajes];
}
const nombreSeccion = (f) => basename(f).replace(/\.\w+$/, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ');
const unirConY = (l) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0]);
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
        ? await responderMotor(ficha.motor, telefono, textoEscrito, { ...ficha, cartaEnImagen: cartaDe(ficha.slug).length > 0 }, audio)
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
      : conAnuncioPrimero(fotos, textoConFotos(imagenes, r.respuestas).map(t => ({ jid, texto: t })));
    if (r.ubicacion) salida.push(...ubicacion(jid, ficha));
    if (completa) salida.push({ jid, texto: 'Cuéntame qué te tinca 🙂' });
    // Mandó solo una parte: al final, en corto, lo demás que hay (sale de las imágenes de la carta).
    if (imagenes.length && !completa) {
      const resto = cartaDe(ficha.slug).filter(f => !imagenes.includes(f)).map(nombreSeccion);
      if (resto.length) salida.push({ jid, texto: `Además tenemos ${unirConY(resto)}. Si quieres te mando esa carta también 😊` });
    }
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
