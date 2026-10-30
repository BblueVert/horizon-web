import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearEstado } from '../src/estado.js';
import { crearConversacion } from '../src/conversacion.js';
import { validarFicha, codigoDemo, linkDemo, slugDe } from '../src/ficha.js';
import { construirPrompt, interpretar, avisoDueno, extrasConfirmacion } from '../src/agente.js';

const ejemplo = JSON.parse(readFileSync(new URL('../fichas/ejemplo-sangucheria.json', import.meta.url), 'utf8'));
const silencioso = { error() {}, warn() {}, log() {} };
const YO = '56900000001@s.whatsapp.net';
const CLIENTE = '56911112222@s.whatsapp.net';

function armar(respuestas = []) {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'estado.json'));
  const fichas = new Map([[ejemplo.slug, ejemplo]]);
  const llamadas = [];
  const acciones = [];
  let i = 0;
  const responder = async (ficha, historial, mensaje) => {
    llamadas.push({ ficha: ficha.slug, historial: [...historial], mensaje });
    return respuestas[i++] || { respuestas: ['ok'], accion: null };
  };
  const conv = crearConversacion({
    estado,
    fichas: { obtener: s => fichas.get(s) || null, todas: () => [...fichas.values()] },
    responder,
    registrarAccion: async a => { acciones.push(a); },
    log: silencioso,
  });
  conv.conectado(YO, '56900000001');
  return { conv, estado, llamadas, acciones };
}

test('chat sin demo no se responde (número compartido)', async () => {
  const { conv, llamadas } = armar();
  assert.deepEqual(await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'hola' }), []);
  assert.equal(llamadas.length, 0);
});

test('el link con código conecta el chat y saluda como el negocio', async () => {
  const { conv, estado, llamadas } = armar([{ respuestas: ['¡Hola! Soy Rincón 🥪'], accion: null }]);
  const out = await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'Hola! Quiero probar el asistente de Sanguchería El Rincón (demo: ejemplo-sangucheria)' });
  assert.equal(estado.demoDe(CLIENTE), 'ejemplo-sangucheria');
  assert.equal(llamadas[0].mensaje, 'Hola');
  assert.deepEqual(out[0], { jid: CLIENTE, texto: '¡Hola! Soy Rincón 🥪' });
  assert.match(out[1].texto, /empezó la demo de Sanguchería El Rincón/);
  assert.equal(out[1].jid, YO);
});

test('código inexistente: respuesta amable y aviso a Benja', async () => {
  const { conv } = armar();
  const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'demo: no-existe' });
  assert.match(out[0].texto, /no está disponible/);
  assert.equal(out[1].jid, YO);
});

test('pedido confirmado: aviso "así le llega al dueño" y se registra', async () => {
  const { conv, estado, acciones, llamadas } = armar([
    { respuestas: ['Hola'], accion: null },
    { respuestas: ['¡Listo! Tu pedido quedó confirmado.'], accion: { tipo: 'pedido', resumen: '2 churrascos italianos, delivery', datos: { cliente: 'Ana', total: 15970 } } },
  ]);
  await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'demo ejemplo-sangucheria' });
  const out = await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'sí, confirmo' });
  assert.equal(llamadas[1].historial.length, 2, 'lleva el historial');
  assert.match(out[1].texto, /Tu código de retiro: \*R-\d{4}\*/);
  assert.match(out[2].texto, /Así le llegaría este aviso al dueño[\s\S]*Nuevo pedido[\s\S]*Código: R-\d{4}[\s\S]*Total: \$15\.970[\s\S]*\+56911112222/);
  assert.equal(acciones[0].tipo, 'pedido');
  assert.equal(estado.historial(CLIENTE).length, 4);
});

test('comandos desde el teléfono: #demo, respuesta a mano pausa, #demo off', async () => {
  const { conv, estado } = armar();
  let out = await conv.delLocal({ jid: CLIENTE, telefono: '56911112222', texto: '#demo ejemplo-sangucheria' });
  assert.equal(estado.demoDe(CLIENTE), 'ejemplo-sangucheria');
  assert.equal(out[0].jid, CLIENTE);

  await conv.delLocal({ jid: CLIENTE, telefono: '56911112222', texto: 'hola, soy Benja, te explico' });
  assert.equal(estado.enPausa(CLIENTE), true);
  assert.deepEqual(await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'ok' }), []);

  out = await conv.delLocal({ jid: CLIENTE, telefono: '569', texto: '#demo off' });
  assert.equal(estado.demoDe(CLIENTE), null);
  assert.equal(out[0].jid, YO);
});

test('#demos lista las demos con su link en tu chat', async () => {
  const { conv } = armar();
  const [m] = await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '#demos' });
  assert.equal(m.jid, YO);
  assert.match(m.texto, /Sanguchería El Rincón[\s\S]*https:\/\/wa\.me\/56900000001\?text=/);
});

test('#slug en tu chat activa la demo para el próximo número nuevo (una sola vez), sin responder en tu chat', async () => {
  const { conv, estado, llamadas } = armar();
  const [ok] = await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '#ejemplo-sangucheria' });
  assert.equal(ok.jid, YO);
  assert.match(ok.texto, /Demo activada: \*Sanguchería El Rincón\*/);
  assert.equal(estado.demoDe(YO), null);
  assert.equal(llamadas.length, 0);

  const out = await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: '¿tienen promo?' });
  assert.equal(estado.demoDe(CLIENTE), 'ejemplo-sangucheria');
  assert.equal(llamadas.at(-1).mensaje, '¿tienen promo?');
  assert.equal(out[0].jid, CLIENTE);
  assert.match(out.at(-1).texto, /\+56911112222 empezó la demo/);

  // Ya la tomó un chat: el siguiente número nuevo no se responde
  const otro = await conv.entrante({ jid: '56933334444@s.whatsapp.net', telefono: '56933334444', texto: 'hola' });
  assert.deepEqual(otro, []);
});

test('tu chat contigo mismo nunca responde como demo, aunque haya quedado conectado de antes', async () => {
  const { conv, estado, llamadas } = armar();
  estado.asignar(YO, 'ejemplo-sangucheria', '56900000001'); // conexión vieja guardada
  assert.deepEqual(await conv.delLocal({ jid: YO, telefono: '56900000001', texto: 'hola' }), []);
  assert.deepEqual(await conv.entrante({ jid: YO, telefono: '56900000001', texto: 'hola' }), []);
  await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '#ejemplo-sangucheria' });
  assert.equal(estado.demoDe(YO), null);
  assert.equal(llamadas.length, 0);
});

test('la demo activada la toma tu número personal aunque tuviera una demo vieja sin uso', async () => {
  const { conv, estado } = armar();
  const ahora = Date.now;
  try {
    estado.asignar(CLIENTE, 'otra-demo-vieja', '56911112222');
    Date.now = () => ahora() + 31 * 60000; // 31 min después, sin mensajes en ese chat
    await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '#ejemplo-sangucheria' });
    const out = await conv.entrante({ jid: CLIENTE, telefono: '56911112222', texto: 'hola' });
    assert.equal(estado.demoDe(CLIENTE), 'ejemplo-sangucheria');
    assert.equal(out[0].jid, CLIENTE);
  } finally { Date.now = ahora; }
});

test('si piden la carta, además de la respuesta llegan las imágenes de la carta', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? ejemplo : null), todas: () => [ejemplo] },
    responder: async () => ({ respuestas: ['¡Claro! Te mando la carta'], accion: null }),
    cartaDe: slug => (slug === ejemplo.slug ? ['/c/1.jpg', '/c/2.jpg'] : []), log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: '¿me mandas la carta?' });
  assert.deepEqual(out.filter(m => m.imagen).map(m => m.imagen), ['/c/1.jpg', '/c/2.jpg']);
  assert.match(out.find(m => m.imagen).texto, /Carta de Sanguchería El Rincón/);
  const otro = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'quiero un churrasco' });
  assert.equal(otro.filter(m => m.imagen).length, 0);
});

test('si pregunta por una parte de la carta, llega solo esa imagen y las recomendaciones de la IA', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const carta = ['/c/1-sushiburger.jpg', '/c/2-rolls.jpg', '/c/3-promociones.jpg', '/c/4-sushipleto.jpg'];
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? ejemplo : null), todas: () => [ejemplo] },
    responder: async () => ({ respuestas: ['Te recomiendo el 21 y el 26'], accion: null }),
    cartaDe: slug => (slug === ejemplo.slug ? carta : []), log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  const texto = 'quisiera pedir un roll con champiñón y otro con salmón, qué tienen disponible';
  const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto });
  assert.deepEqual(out.filter(m => m.imagen).map(m => m.imagen), ['/c/2-rolls.jpg']);
  assert.ok(out.some(m => m.texto === 'Te recomiendo el 21 y el 26'));
  assert.ok(out.findIndex(m => m.imagen) < out.findIndex(m => m.texto === 'Te recomiendo el 21 y el 26'));
  const promos = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'me mandas la carta de promos?' });
  assert.deepEqual(promos.filter(m => m.imagen).map(m => m.imagen), ['/c/3-promociones.jpg']);
  const toda = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'mándame la carta completa' });
  assert.equal(toda.filter(m => m.imagen).length, 4);
  assert.ok(!toda.some(m => m.texto === 'Te recomiendo el 21 y el 26'));
  const sushi = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'qué tienen con salmón' });
  assert.equal(sushi.filter(m => m.imagen).length, 0);
  const sinTilde = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'me gustaría pedir unos rolls que tienen disponibles' });
  assert.deepEqual(sinTilde.filter(m => m.imagen).map(m => m.imagen), ['/c/2-rolls.jpg']);
  const siguiente = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'Y de sushi burgers' });
  assert.deepEqual(siguiente.filter(m => m.imagen).map(m => m.imagen), ['/c/1-sushiburger.jpg']);
  assert.ok(siguiente.some(m => m.texto === 'Te recomiendo el 21 y el 26'));
  const juntos = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'unos rolls que tienen\nY de sushi burgers' });
  assert.equal(juntos.filter(m => m.imagen).length, 2);
  for (const pedido of ['la sushiburger clásica mediana', 'y un roll de pollo', 'y de pollo']) {
    const nada = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: pedido });
    assert.equal(nada.filter(m => m.imagen).length, 0, pedido);
  }
});

test('roles, rol y otras formas de decirlo piden la imagen de rolls; una letra mal también calza', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const carta = ['/c/1-sushiburger.jpg', '/c/2-rolls.jpg', '/c/3-promociones.jpg', '/c/4-gohan.jpg', '/c/5-sushipleto.jpg'];
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? ejemplo : null), todas: () => [ejemplo] },
    responder: async () => ({ respuestas: ['Te cuento'], accion: null }),
    cartaDe: slug => (slug === ejemplo.slug ? carta : []), log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  const imgs = async (texto) => (await conv.entrante({ jid: CLIENTE, telefono: '569', texto })).filter(m => m.imagen).map(m => m.imagen);
  for (const texto of ['quisiera pedir unos roles de sushi, me enviarías el menú porfa', 'me mandas la carta de rol', 'el menú de rollos', 'qué rolls tienen', 'el menú de los jandrol']) {
    assert.deepEqual(await imgs(texto), ['/c/2-rolls.jpg'], texto);
  }
  assert.deepEqual(await imgs('me mandas el menú de sushiburguer'), ['/c/1-sushiburger.jpg']);
  assert.deepEqual(await imgs('la carta de gojan'), ['/c/4-gohan.jpg']);
  assert.equal((await imgs('mándame el menú de sushi')).length, 5);
  assert.deepEqual(await imgs('quiero unos roles con pollo'), []);
  const parte = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'me mandas la carta de rolls' });
  assert.equal(parte.at(-1).texto, 'Además tenemos sushiburger, promociones, gohan y sushipleto. Si quieres te mando esa carta también 😊');
  const toda = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'mándame el menú de sushi' });
  assert.ok(!toda.some(m => /^Además tenemos/.test(m.texto || '')));
});

test('con imagen de la carta no se repite la lista larga por escrito', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const larga = 'Clásicos: ' + '1 Pollo furay queso cebollín, '.repeat(15);
  let respuestas = ['Te lo mando por línea', larga];
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? ejemplo : null), todas: () => [ejemplo] },
    responder: async () => ({ respuestas, accion: null }),
    cartaDe: slug => (slug === ejemplo.slug ? ['/c/1-sushiburger.jpg', '/c/2-rolls.jpg'] : []), log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'mándame el menú de rolls' });
  assert.ok(!out.some(m => m.texto === larga || m.texto === 'Te lo mando por línea'));
  assert.ok(out.some(m => /ingrediente/.test(m.texto || '')));
  assert.match(out.at(-1).texto, /^Además tenemos sushiburger/);
  respuestas = ['Te recomiendo el 14 y el 21'];
  const corta = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'mándame el menú de rolls' });
  assert.ok(corta.some(m => m.texto === 'Te recomiendo el 14 y el 21'));
  respuestas = ['Sin imagen: ' + larga];
  const sinFoto = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'qué rolls van con pollo' });
  assert.ok(sinFoto.some(m => m.texto === respuestas[0]));
});

test('"te mando la carta" sale antes de la imagen y las recomendaciones después', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  let respuestas = ['Te mando la carta al tiro 😊', 'Te recomiendo el 14', '¿Buscas algún ingrediente?'];
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? ejemplo : null), todas: () => [ejemplo] },
    responder: async () => ({ respuestas, accion: null }),
    cartaDe: slug => (slug === ejemplo.slug ? ['/c/1-sushiburger.jpg', '/c/2-rolls.jpg'] : []), log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'mándame el menú de rolls' });
  assert.equal(out[0].texto, 'Te mando la carta al tiro 😊');
  assert.ok(out[1].imagen);
  assert.equal(out[2].texto, 'Te recomiendo el 14');
  assert.match(out.at(-1).texto, /^Además tenemos/);
  for (const frase of ['Ahí te va la carta 😊', 'Aquí tienes el menú']) {
    respuestas = [frase, 'Te recomiendo el 14'];
    const r = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'mándame el menú de rolls' });
    assert.equal(r[0].texto, frase);
    assert.ok(r[1].imagen);
  }
  respuestas = ['Te recomiendo el 14'];
  const sinAnuncio = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'mándame el menú de rolls' });
  assert.ok(sinAnuncio[0].imagen);
});

test('un audio lo responde el motor y la carta se decide por lo que dijo el cliente', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const conMotor = { ...ejemplo, motor: 'mesa-cero' };
  let recibido = null;
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? conMotor : null), todas: () => [conMotor] },
    responderMotor: async (_m, _t, _x, _f, audio) => { recibido = audio; return { respuestas: ['Te recomiendo el 21'], accion: null, transcripcion: 'qué rolls tienen' }; },
    cartaDe: () => ['/c/1-sushiburger.jpg', '/c/2-rolls.jpg'], log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: '', audio: { base64: 'QUJD', mime: 'audio/ogg' } });
  assert.equal(recibido.base64, 'QUJD');
  assert.deepEqual(out.filter(m => m.imagen).map(m => m.imagen), ['/c/2-rolls.jpg']);
  assert.ok(out.some(m => m.texto === 'Te recomiendo el 21'));
});

test('un reclamo avisa al dueño si tiene número; si no, a tu chat, y nunca al cliente', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const conMotor = { ...ejemplo, motor: 'mesa-cero' };
  let destino = null;
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? conMotor : null), todas: () => [conMotor] },
    responderMotor: async () => ({ respuestas: ['Qué lata, cuéntame qué pasó'], accion: null, avisoDueno: '🚨 Reclamo', avisoDestino: destino }),
    cartaDe: () => [], log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  const aTuChat = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'llegó frío' });
  assert.deepEqual(aTuChat.filter(m => m.texto === '🚨 Reclamo').map(m => m.jid), [YO]);
  destino = '56911111111';
  const alDueno = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'y faltó un roll' });
  assert.deepEqual(alDueno.filter(m => m.texto === '🚨 Reclamo').map(m => m.jid), ['56911111111@s.whatsapp.net']);
  assert.ok(!alDueno.some(m => m.jid === CLIENTE && m.texto === '🚨 Reclamo'));
});

test('sin motor, un audio pide que lo escriban en vez de quedar sin respuesta', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? ejemplo : null), todas: () => [ejemplo] },
    responder: async () => { throw new Error('no debe llamar a la IA'); }, log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto: '', audio: { base64: 'QUJD', mime: 'audio/ogg' } });
  assert.match(out[0].texto, /escribes/);
});

test('reconoce la carta con tildes, manda imágenes en vez del texto de la IA, y no se dispara al pedir', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const conv = crearConversacion({
    estado, fichas: { obtener: s => (s === ejemplo.slug ? ejemplo : null), todas: () => [ejemplo] },
    responder: async () => ({ respuestas: ['TEXTO DE LA IA'], accion: null }),
    cartaDe: slug => (slug === ejemplo.slug ? ['/c/1.jpg'] : []), log: silencioso,
  });
  conv.conectado(YO, '569');
  estado.asignar(CLIENTE, ejemplo.slug, '569');
  for (const texto of ['Mándame el menú completo', 'Tienes las imágenes del menú', 'me pasas la foto?', 'qué hay']) {
    const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto });
    assert.equal(out.filter(m => m.imagen).length, 1, texto);
    assert.ok(!out.some(m => m.texto === 'TEXTO DE LA IA'), texto);
  }
  for (const texto of ['quiero el 20 de la carta', 'qué tienen de postre', 'quiero sushi', 'fotografía no']) {
    const out = await conv.entrante({ jid: CLIENTE, telefono: '569', texto });
    assert.equal(out.filter(m => m.imagen).length, 0, texto);
    assert.ok(out.some(m => m.texto === 'TEXTO DE LA IA'), texto);
  }
});

test('#demo off en tu chat desactiva la demo pendiente', async () => {
  const { conv, estado } = armar();
  await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '#demo ejemplo-sangucheria' });
  const [m] = await conv.delLocal({ jid: YO, telefono: '56900000001', texto: '#demo off' });
  assert.match(m.texto, /desactivé la demo pendiente/);
  assert.equal(estado.armada(), null);
  assert.deepEqual(await conv.entrante({ jid: CLIENTE, telefono: '569', texto: 'hola' }), []);
});

test('ficha: validación, código del link y slug', () => {
  assert.deepEqual(validarFicha(ejemplo).errores, []);
  assert.ok(validarFicha({ slug: 'X X', nombre: '' }).errores.length >= 3);
  assert.equal(codigoDemo(decodeURIComponent(linkDemo('+56 9 1234 5678', ejemplo).split('text=')[1])), 'ejemplo-sangucheria');
  assert.match(linkDemo('+56 9 1234 5678', ejemplo), /^https:\/\/wa\.me\/56912345678\?text=/);
  assert.equal(slugDe('Tía Julia — Rancagua'), 'tia-julia-rancagua');
});

test('prompt: incluye catálogo con precios, precio a confirmar y tuteo', () => {
  const p = construirPrompt(ejemplo);
  assert.match(p, /Churrasco italiano: \$6\.990/);
  assert.match(p, /Jugo natural del día: precio a confirmar/);
  assert.match(p, /Nunca voseo/);
  assert.match(p, /Mínimo: \$8\.000/);
});

test('interpretar: JSON, texto suelto y acción inválida', () => {
  assert.deepEqual(interpretar('{"respuestas":["a","b"],"accion":null}'), { respuestas: ['a', 'b'], ubicacion: false, accion: null });
  assert.deepEqual(interpretar('hola sin json'), { respuestas: ['hola sin json'], ubicacion: false, accion: null });
  assert.equal(interpretar('{"respuestas":["Estamos en..."],"ubicacion":true}').ubicacion, true);
  assert.equal(interpretar('{"respuestas":["a"],"accion":{"tipo":"otra"}}').accion, null);
  assert.match(avisoDueno(ejemplo, { tipo: 'reserva', resumen: 'Mesa para 4', datos: {} }, '569'), /\*Nueva reserva\* · Sanguchería El Rincón/);
});

test('abono por WhatsApp: link de pago con el 30% y código de reserva', () => {
  const ficha = { ...ejemplo, slug: 'estetica', nombre: 'Studio Lumière', flujo: 'reservas', color: '#B4527A', pago_online: { activo: true, porcentaje: 30 } };
  const { mensajes, accion } = extrasConfirmacion(ficha, { tipo: 'reserva', resumen: 'Pestañas pelo a pelo, viernes 11:00', datos: { total: 25000, hora: 'viernes 11:00' } }, '56976962659', () => 0.5);
  assert.equal(accion.codigo, 'A-5500');
  assert.equal(accion.pago, 7500);
  const url = new URL(mensajes[0].split('\n')[1]);
  assert.equal(url.pathname, '/pago-demo');
  assert.equal(url.searchParams.get('m'), '7500');
  assert.equal(url.searchParams.get('w'), '56976962659');
  assert.match(mensajes[0], /abona el 30% \(\$7\.500\)/);
  assert.match(mensajes[1], /código de reserva: \*A-5500\* · viernes 11:00/);
});

test('pedido con delivery: link por el total y sin código de retiro', () => {
  const ficha = { ...ejemplo, pago_online: { activo: true } };
  const { mensajes } = extrasConfirmacion(ficha, { tipo: 'pedido', resumen: 'x', datos: { total: 14990, entrega: 'delivery' } }, '569');
  assert.equal(mensajes.length, 1);
  assert.match(mensajes[0], /pagar \$14\.990/);
});

test('ubicación: pin nativo si hay coordenadas, link de Maps si no', async () => {
  const conPin = { ...ejemplo, slug: 'con-pin', locales: [{ nombre: 'Centro', direccion: 'Calle 1', comuna: 'Rancagua', lat: -34.17, lng: -70.74 }] };
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const fichas = new Map([[conPin.slug, conPin], [ejemplo.slug, ejemplo]]);
  const conv = crearConversacion({
    estado, fichas: { obtener: s => fichas.get(s) || null, todas: () => [...fichas.values()] },
    responder: async () => ({ respuestas: ['Estamos en Calle 1'], ubicacion: true, accion: null }), log: silencioso,
  });
  conv.conectado(YO, '569');
  const a = await conv.entrante({ jid: 'a@s.whatsapp.net', telefono: '1', texto: 'demo con-pin' });
  assert.deepEqual(a[1].ubicacion, { lat: -34.17, lng: -70.74, nombre: 'Sanguchería El Rincón · Centro', direccion: 'Calle 1, Rancagua' });
  const b = await conv.entrante({ jid: 'b@s.whatsapp.net', telefono: '2', texto: 'demo ejemplo-sangucheria' });
  assert.match(b[1].texto, /^📍 https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Calle%20Ejemplo%20123/);
});

test('atajo #slug activa la demo; un hashtag cualquiera no hace nada', async () => {
  const { conv, estado } = armar();
  await conv.delLocal({ jid: CLIENTE, telefono: '569', texto: '#ejemplo-sangucheria' });
  assert.equal(estado.demoDe(CLIENTE), 'ejemplo-sangucheria');
  await conv.delLocal({ jid: '56933334444@s.whatsapp.net', telefono: '569', texto: '#felizcumple' });
  assert.equal(estado.demoDe('56933334444@s.whatsapp.net'), null);
});

test('si la IA falla, a tu chat llega el motivo (una vez cada 5 min)', async () => {
  const estado = crearEstado(join(mkdtempSync(join(tmpdir(), 'demos-')), 'e.json'));
  const fichas = new Map([[ejemplo.slug, ejemplo]]);
  const conv = crearConversacion({
    estado, fichas: { obtener: s => fichas.get(s) || null, todas: () => [...fichas.values()] },
    responder: async () => { throw new Error('n8n demo-ia respondió 404 (¿está activo el workflow?)'); }, log: silencioso,
  });
  conv.conectado(YO, '569');
  const a = await conv.entrante({ jid: CLIENTE, telefono: '1', texto: 'demo ejemplo-sangucheria' });
  assert.match(a[0].texto, /se me cruzó algo/);
  assert.equal(a[1].jid, YO);
  assert.match(a[1].texto, /ejemplo-sangucheria.*404/);
  const b = await conv.entrante({ jid: CLIENTE, telefono: '1', texto: 'hola' });
  assert.equal(b.length, 1, 'no repite el aviso');
});
